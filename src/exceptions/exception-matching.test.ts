import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import {
  applySecurityExceptionsToWorkloadScans,
  emptySecurityExceptionData,
  exceptionMatchesWorkload,
  hasObjectSelector,
  isExpired,
  labelsMatchSelector,
  MatchContext,
  matchingExceptions,
  SecurityExceptionData,
  workloadKey,
} from './exception-matching';

function emptyContext(): MatchContext {
  return { namespaceLabelsByName: new Map(), workloadLabelsByKey: new Map() };
}

function makeSE(spec: SecurityException['spec'], namespace = 'production'): SecurityException {
  return {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'SecurityException',
    metadata: { name: 'se', namespace },
    spec,
  };
}

function makeCSE(spec: ClusterSecurityException['spec']): ClusterSecurityException {
  return {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'ClusterSecurityException',
    metadata: { name: 'cse' },
    spec,
  };
}

function makeScan(
  overrides: {
    kind?: string;
    name?: string;
    namespace?: string;
    cluster?: string;
    controlIDs?: string[];
  } = {}
): WorkloadConfigurationScanSummary {
  const {
    kind = 'Deployment',
    name = 'nginx',
    namespace = 'production',
    cluster = 'cluster-a',
    controlIDs = ['C-0034'],
  } = overrides;

  const controls: WorkloadConfigurationScanSummary.Controls = {};
  for (const controlID of controlIDs) {
    controls[controlID] = {
      controlID,
      severity: { scoreFactor: 7, severity: 'High' },
      status: { status: WorkloadConfigurationScanSummary.Status.Failed },
      exceptedByPolicy: false,
    };
  }

  return {
    metadata: {
      creationTimestamp: '',
      name: `${kind.toLowerCase()}-${name}`,
      namespace,
      cluster,
      annotations: {},
      labels: {
        'kubescape.io/workload-kind': kind,
        'kubescape.io/workload-name': name,
        'kubescape.io/workload-namespace': namespace,
      },
    },
    spec: {
      controls,
      severities: { critical: 0, high: 1, low: 0, medium: 0, unknown: 0 },
    },
    exceptedByPolicy: false,
  };
}

describe('workloadKey', () => {
  it('lowercases the kind so it survives a kind spelled either way', () => {
    expect(workloadKey('Deployment', 'production', 'nginx')).toBe('deployment/production/nginx');
    expect(workloadKey('deployment', 'production', 'nginx')).toBe('deployment/production/nginx');
  });
});

describe('isExpired', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('treats a missing expiry as never expiring', () => {
    expect(isExpired(undefined, now)).toBe(false);
  });

  it('detects a past expiry', () => {
    expect(isExpired('2026-05-31T23:59:59Z', now)).toBe(true);
  });

  it('leaves a future expiry alone', () => {
    expect(isExpired('2026-06-02T23:59:59Z', now)).toBe(false);
  });
});

describe('labelsMatchSelector', () => {
  it('matches when every matchLabels pair is present', () => {
    expect(labelsMatchSelector({ matchLabels: { app: 'nginx' } }, { app: 'nginx', tier: 'web' })).toBe(
      true
    );
  });

  it('rejects when a matchLabels value differs', () => {
    expect(labelsMatchSelector({ matchLabels: { app: 'nginx' } }, { app: 'redis' })).toBe(false);
  });

  it('treats an empty selector as matching everything', () => {
    expect(labelsMatchSelector({}, {})).toBe(true);
  });

  it('honours In, NotIn, Exists and DoesNotExist', () => {
    const labels = { env: 'staging' };
    expect(
      labelsMatchSelector(
        { matchExpressions: [{ key: 'env', operator: 'In', values: ['staging', 'prod'] }] },
        labels
      )
    ).toBe(true);
    expect(
      labelsMatchSelector(
        { matchExpressions: [{ key: 'env', operator: 'In', values: ['prod'] }] },
        labels
      )
    ).toBe(false);
    expect(
      labelsMatchSelector(
        { matchExpressions: [{ key: 'env', operator: 'NotIn', values: ['prod'] }] },
        labels
      )
    ).toBe(true);
    expect(labelsMatchSelector({ matchExpressions: [{ key: 'env', operator: 'Exists' }] }, labels)).toBe(
      true
    );
    expect(
      labelsMatchSelector({ matchExpressions: [{ key: 'team', operator: 'Exists' }] }, labels)
    ).toBe(false);
    expect(
      labelsMatchSelector({ matchExpressions: [{ key: 'team', operator: 'DoesNotExist' }] }, labels)
    ).toBe(true);
  });
});

describe('exceptionMatchesWorkload', () => {
  it('scopes a SecurityException to its own namespace', () => {
    const se = makeSE({ match: { resources: [{ kind: 'Deployment', name: 'nginx' }] } });
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'production', emptyContext())).toBe(
      true
    );
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'staging', emptyContext())).toBe(
      false
    );
  });

  it('matches every workload in scope when match is empty', () => {
    const se = makeSE({ match: {} });
    expect(exceptionMatchesWorkload(se, 'StatefulSet', 'redis', 'production', emptyContext())).toBe(
      true
    );
  });

  it('matches a resource entry with no name against every workload of that kind', () => {
    const se = makeSE({ match: { resources: [{ kind: 'Deployment' }] } });
    expect(exceptionMatchesWorkload(se, 'Deployment', 'anything', 'production', emptyContext())).toBe(
      true
    );
    expect(exceptionMatchesWorkload(se, 'StatefulSet', 'anything', 'production', emptyContext())).toBe(
      false
    );
  });

  it('ignores a resource entry with an empty kind instead of matching everything', () => {
    const se = makeSE({ match: { resources: [{ kind: '' }] } });
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'production', emptyContext())).toBe(
      false
    );
  });

  it('applies namespaceSelector only to a ClusterSecurityException', () => {
    const cse = makeCSE({ match: { namespaceSelector: { matchLabels: { env: 'staging' } } } });
    const context: MatchContext = {
      namespaceLabelsByName: new Map([
        ['production', { env: 'staging' }],
        ['other', { env: 'prod' }],
      ]),
      workloadLabelsByKey: new Map(),
    };
    expect(exceptionMatchesWorkload(cse, 'Deployment', 'nginx', 'production', context)).toBe(true);
    expect(exceptionMatchesWorkload(cse, 'Deployment', 'nginx', 'other', context)).toBe(false);
  });

  it('matches on objectSelector against the workload labels', () => {
    const se = makeSE({ match: { objectSelector: { matchLabels: { app: 'nginx' } } } });
    const context: MatchContext = {
      namespaceLabelsByName: new Map(),
      workloadLabelsByKey: new Map([
        ['deployment/production/nginx', { app: 'nginx' }],
        ['deployment/production/redis', { app: 'redis' }],
      ]),
    };
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'production', context)).toBe(true);
    expect(exceptionMatchesWorkload(se, 'Deployment', 'redis', 'production', context)).toBe(false);
  });

  it('fails closed on objectSelector when the workload labels could not be resolved', () => {
    const se = makeSE({ match: { objectSelector: { matchLabels: { app: 'nginx' } } } });
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'production', emptyContext())).toBe(
      false
    );
  });

  it('ANDs objectSelector with resources', () => {
    const se = makeSE({
      match: {
        objectSelector: { matchLabels: { app: 'nginx' } },
        resources: [{ kind: 'StatefulSet' }],
      },
    });
    const context: MatchContext = {
      namespaceLabelsByName: new Map(),
      workloadLabelsByKey: new Map([['deployment/production/nginx', { app: 'nginx' }]]),
    };
    // label matches but the kind does not
    expect(exceptionMatchesWorkload(se, 'Deployment', 'nginx', 'production', context)).toBe(false);
  });
});

describe('hasObjectSelector', () => {
  it('reports whether any exception needs workload labels', () => {
    expect(hasObjectSelector([makeSE({ match: {} })])).toBe(false);
    expect(
      hasObjectSelector([makeSE({ match: { objectSelector: { matchLabels: { a: 'b' } } } })])
    ).toBe(true);
  });
});

describe('matchingExceptions', () => {
  it('skips expired exceptions', () => {
    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({ expiresAt: '2026-01-01T00:00:00Z', match: {}, posture: [] }),
        makeSE({ match: {}, posture: [] }),
      ],
    };
    const now = new Date('2026-06-01T00:00:00Z');
    expect(matchingExceptions(data, 'Deployment', 'nginx', 'production', now)).toHaveLength(1);
  });
});

describe('applySecurityExceptionsToWorkloadScans', () => {
  it('marks a control as excepted for the matching workload only', () => {
    const scans = [
      makeScan({ name: 'nginx' }),
      makeScan({ name: 'redis', controlIDs: ['C-0034'] }),
    ];
    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({
          match: { resources: [{ kind: 'Deployment', name: 'nginx' }] },
          posture: [{ controlID: 'C-0034', action: 'ignore' }],
        }),
      ],
    };

    applySecurityExceptionsToWorkloadScans(scans, new Map([['cluster-a', data]]));

    expect(scans[0].spec.controls['C-0034'].exceptedByPolicy).toBe(true);
    expect(scans[1].spec.controls['C-0034'].exceptedByPolicy).toBe(false);
    expect(scans[0].exceptedByPolicy).toBe(false);
  });

  it('excludes the whole resource when the exception has neither posture nor vulnerability entries', () => {
    const scans = [makeScan()];
    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [makeSE({ match: { resources: [{ kind: 'Deployment', name: 'nginx' }] } })],
    };

    applySecurityExceptionsToWorkloadScans(scans, new Map([['cluster-a', data]]));

    expect(scans[0].exceptedByPolicy).toBe(true);
  });

  it('does not suppress compliance results for a vulnerability-only exception', () => {
    const scans = [makeScan()];
    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({
          match: {},
          vulnerabilities: [{ vulnerability: { id: 'CVE-2024-0001' }, status: 'fixed' }],
        }),
      ],
    };

    applySecurityExceptionsToWorkloadScans(scans, new Map([['cluster-a', data]]));

    expect(scans[0].exceptedByPolicy).toBe(false);
    expect(scans[0].spec.controls['C-0034'].exceptedByPolicy).toBe(false);
  });

  it('does not leak an exception from one cluster onto another cluster workload', () => {
    const scanA = makeScan({ cluster: 'cluster-a' });
    const scanB = makeScan({ cluster: 'cluster-b' });

    const dataA: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({
          match: { resources: [{ kind: 'Deployment', name: 'nginx' }] },
          posture: [{ controlID: 'C-0034', action: 'ignore' }],
        }),
      ],
    };
    const dataB = emptySecurityExceptionData();

    applySecurityExceptionsToWorkloadScans(
      [scanA, scanB],
      new Map([
        ['cluster-a', dataA],
        ['cluster-b', dataB],
      ])
    );

    expect(scanA.spec.controls['C-0034'].exceptedByPolicy).toBe(true);
    expect(scanB.spec.controls['C-0034'].exceptedByPolicy).toBe(false);
  });

  it('still applies in a single cluster view when the scan carries no cluster name', () => {
    const scan = makeScan({ cluster: '' });
    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({
          match: {},
          posture: [{ controlID: 'C-0034', action: 'ignore' }],
        }),
      ],
    };

    applySecurityExceptionsToWorkloadScans([scan], new Map([['cluster-a', data]]));

    expect(scan.spec.controls['C-0034'].exceptedByPolicy).toBe(true);
  });
});

describe('labelsMatchSelector with an unrecognized operator', () => {
  it('fails closed rather than widening the exception', () => {
    const selector = {
      matchExpressions: [{ key: 'app', operator: 'Equals' as any, values: ['nginx'] }],
    };

    expect(labelsMatchSelector(selector, { app: 'nginx' })).toBe(false);
  });

  it('fails closed even when the rest of the selector matches', () => {
    const selector = {
      matchLabels: { tier: 'frontend' },
      matchExpressions: [
        { key: 'app', operator: 'Exists' as const },
        { key: 'env', operator: 'SomethingNew' as any },
      ],
    };

    expect(labelsMatchSelector(selector, { tier: 'frontend', app: 'nginx', env: 'prod' })).toBe(
      false
    );
  });
});

describe('scans returned without spec.controls', () => {
  it('does not throw when the apiserver trimmed the controls out of the list', () => {
    const scan = makeScan();
    delete (scan.spec as any).controls;

    const data: SecurityExceptionData = {
      ...emptySecurityExceptionData(),
      namespaced: [
        makeSE({ match: {}, posture: [{ controlID: 'C-0034', action: 'ignore' }] }),
      ],
    };

    expect(() =>
      applySecurityExceptionsToWorkloadScans([scan], new Map([['cluster-a', data]]))
    ).not.toThrow();
  });
});
