import { vi } from 'vitest';
import {
  ClusterSecurityException,
  SecurityException,
  SecurityExceptionSpec,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import {
  applySecurityExceptionsToWorkloadScans,
  fetchSecurityExceptions,
  formatLabelSelector,
  markScannerExceptions,
  SecurityExceptionData,
} from './apply-security-exceptions';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

function scan(kind: string, namespace: string, name: string) {
  const control = (controlID: string) => ({
    controlID,
    severity: { scoreFactor: 7, severity: 'High' },
    status: { status: 'failed' },
    exceptedByPolicy: false,
  });
  return {
    metadata: {
      name: `${kind.toLowerCase()}-${name}`,
      namespace,
      cluster: 'cluster-a',
      creationTimestamp: '',
      annotations: {},
      labels: {
        'kubescape.io/workload-kind': kind,
        'kubescape.io/workload-name': name,
        'kubescape.io/workload-namespace': namespace,
      },
    },
    spec: {
      controls: { 'C-0001': control('C-0001'), 'C-0002': control('C-0002') },
      severities: { critical: 0, high: 2, medium: 0, low: 0, unknown: 0 },
    },
    exceptedByPolicy: false,
  } as unknown as WorkloadConfigurationScanSummary;
}

function namespacedException(namespace: string, spec: SecurityExceptionSpec): SecurityException {
  return {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'SecurityException',
    metadata: { name: 'exception', namespace },
    spec,
  };
}

function clusterException(spec: SecurityExceptionSpec): ClusterSecurityException {
  return {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'ClusterSecurityException',
    metadata: { name: 'cluster-exception' },
    spec,
  };
}

function exceptionData(
  exceptions: Array<SecurityException | ClusterSecurityException>,
  namespaceLabels: Record<string, Record<string, string>> = {}
): SecurityExceptionData {
  return {
    namespaced: exceptions.filter((e): e is SecurityException => e.kind === 'SecurityException'),
    cluster: exceptions.filter(
      (e): e is ClusterSecurityException => e.kind === 'ClusterSecurityException'
    ),
    namespaceLabelsByName: new Map(Object.entries(namespaceLabels)),
  };
}

function exceptedControls(w: WorkloadConfigurationScanSummary) {
  return Object.values(w.spec.controls)
    .filter(control => control.exceptedByPolicy)
    .map(control => control.controlID);
}

const posture = (controlID: string) => ({ controlID, action: 'ignore' as const });

it('excludes whole workloads in the namespace of a resource-level SecurityException', () => {
  const inScope = scan('Deployment', 'shop', 'web');
  const otherNamespace = scan('Deployment', 'billing', 'web');

  applySecurityExceptionsToWorkloadScans(
    [inScope, otherNamespace],
    exceptionData([namespacedException('shop', {})])
  );

  expect(inScope.exceptedByPolicy).toBe(true);
  expect(otherNamespace.exceptedByPolicy).toBe(false);
});

it('does not let vulnerability-only exceptions exclude compliance results', () => {
  const w = scan('Deployment', 'shop', 'web');
  const vulnerabilities = [
    { vulnerability: { id: 'CVE-2024-0001' }, status: 'not_affected' as const },
  ];

  applySecurityExceptionsToWorkloadScans(
    [w],
    exceptionData([namespacedException('shop', { vulnerabilities })])
  );

  expect(w.exceptedByPolicy).toBe(false);
  expect(exceptedControls(w)).toEqual([]);
});

it('excepts only the controls listed in posture entries', () => {
  const w = scan('Deployment', 'shop', 'web');

  applySecurityExceptionsToWorkloadScans(
    [w],
    exceptionData([namespacedException('shop', { posture: [posture('C-0002')] })])
  );

  expect(w.exceptedByPolicy).toBe(false);
  expect(exceptedControls(w)).toEqual(['C-0002']);
});

it('restricts matching to the listed resources, by kind and optional name', () => {
  const web = scan('Deployment', 'shop', 'web');
  const api = scan('Deployment', 'shop', 'api');
  const db = scan('StatefulSet', 'shop', 'db');

  applySecurityExceptionsToWorkloadScans(
    [web, api, db],
    exceptionData([
      namespacedException('shop', {
        match: { resources: [{ kind: 'deployment', name: 'web' }, { kind: 'StatefulSet' }] },
      }),
    ])
  );

  expect([web, api, db].map(w => w.exceptedByPolicy)).toEqual([true, false, true]);
});

it('ignores expired exceptions', () => {
  const w = scan('Deployment', 'shop', 'web');

  applySecurityExceptionsToWorkloadScans(
    [w],
    exceptionData([namespacedException('shop', { expiresAt: '2000-01-01T00:00:00Z' })])
  );

  expect(w.exceptedByPolicy).toBe(false);
});

it('matches ClusterSecurityExceptions on namespace labels', () => {
  const prod = scan('Deployment', 'shop', 'web');
  const dev = scan('Deployment', 'sandbox', 'web');
  const unlabeled = scan('Deployment', 'tools', 'web');

  applySecurityExceptionsToWorkloadScans(
    [prod, dev, unlabeled],
    exceptionData(
      [
        clusterException({
          match: {
            namespaceSelector: {
              matchLabels: { team: 'commerce' },
              matchExpressions: [{ key: 'env', operator: 'In', values: ['prod'] }],
            },
          },
        }),
      ],
      {
        shop: { team: 'commerce', env: 'prod' },
        sandbox: { team: 'commerce', env: 'dev' },
      }
    )
  );

  expect([prod, dev, unlabeled].map(w => w.exceptedByPolicy)).toEqual([true, false, false]);
});

it('formats label selectors in query parameter syntax', () => {
  expect(
    formatLabelSelector({
      matchLabels: { app: 'web' },
      matchExpressions: [
        { key: 'tier', operator: 'In', values: ['front', 'edge'] },
        { key: 'env', operator: 'NotIn', values: ['dev'] },
        { key: 'owner', operator: 'Exists' },
        { key: 'legacy', operator: 'DoesNotExist' },
      ],
    })
  ).toBe('app=web,tier in (front,edge),env notin (dev),owner,!legacy');
  expect(formatLabelSelector({})).toBe('');
});

it('reads the exceptions that the scanner applied from the control sub-status', () => {
  const partly = scan('Deployment', 'shop', 'web');
  partly.spec.controls['C-0002'].status.subStatus = 'w/exceptions';
  const fully = scan('Deployment', 'shop', 'api');
  Object.values(fully.spec.controls).forEach(control => {
    control.status.subStatus = 'w/exceptions';
  });

  markScannerExceptions([partly, fully]);

  expect(exceptedControls(partly)).toEqual(['C-0002']);
  expect(partly.exceptedByPolicy).toBe(false);
  expect(fully.exceptedByPolicy).toBe(true);
});

describe('objectSelector', () => {
  const objectSelector = { matchLabels: { exempt: 'true' } };
  const selectedQuery = `?${new URLSearchParams({ labelSelector: 'exempt=true' })}`;

  function mockCluster(
    exceptions: { namespaced?: SecurityException[]; cluster?: ClusterSecurityException[] },
    workloads: Record<string, Array<{ namespace: string; name: string }>>
  ) {
    request.mockReset().mockImplementation(async (url: string) => {
      if (url === '/apis/kubescape.io/v1beta1/securityexceptions') {
        return { items: exceptions.namespaced ?? [] };
      }
      if (url === '/apis/kubescape.io/v1beta1/clustersecurityexceptions') {
        return { items: exceptions.cluster ?? [] };
      }
      if (url === '/api/v1/namespaces') return { items: [] };
      if (!(url in workloads)) throw new Error(`forbidden: ${url}`);
      return { items: workloads[url].map(metadata => ({ metadata })) };
    });
  }

  it('lets the API server select the workloads of a SecurityException', async () => {
    const selected = scan('Deployment', 'shop', 'web');
    const unselected = scan('Deployment', 'shop', 'api');
    const otherKind = scan('StatefulSet', 'shop', 'db');
    mockCluster(
      {
        namespaced: [
          namespacedException('shop', {
            match: { objectSelector, resources: [{ kind: 'Deployment' }] },
          }),
        ],
      },
      {
        [`/apis/apps/v1/namespaces/shop/deployments${selectedQuery}`]: [
          { namespace: 'shop', name: 'web' },
        ],
      }
    );

    const scans = [selected, unselected, otherKind];
    const data = await fetchSecurityExceptions('cluster-a', scans);
    applySecurityExceptionsToWorkloadScans(scans, data);

    expect(scans.map(w => w.exceptedByPolicy)).toEqual([true, false, false]);
    // Only kinds that are both scanned and listed in resources are looked up
    expect(request.mock.calls.map(([url]) => url)).not.toContainEqual(
      expect.stringContaining('statefulsets')
    );
    expect(request.mock.calls.every(([, options]) => options.cluster === 'cluster-a')).toBe(true);
  });

  it('looks up workloads cluster-wide for a ClusterSecurityException', async () => {
    const w = scan('DaemonSet', 'monitoring', 'agent');
    mockCluster(
      { cluster: [clusterException({ match: { objectSelector }, posture: [posture('C-0001')] })] },
      { [`/apis/apps/v1/daemonsets${selectedQuery}`]: [{ namespace: 'monitoring', name: 'agent' }] }
    );

    const data = await fetchSecurityExceptions('cluster-a', [w]);
    applySecurityExceptionsToWorkloadScans([w], data);

    expect(exceptedControls(w)).toEqual(['C-0001']);
  });

  it('does not match workloads whose labels cannot be looked up', async () => {
    const listable = scan('Deployment', 'shop', 'web');
    const unknownKind = scan('Service', 'shop', 'web');
    mockCluster({ namespaced: [namespacedException('shop', { match: { objectSelector } })] }, {});

    const scans = [listable, unknownKind];
    const data = await fetchSecurityExceptions('cluster-a', scans);
    applySecurityExceptionsToWorkloadScans(scans, data);

    expect(scans.map(w => w.exceptedByPolicy)).toEqual([false, false]);
  });
});
