import { describe, expect, it, vi } from 'vitest';
import type { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import {
  observedFlows,
  podQueries,
  readPolicyComparison,
  resolveEndpoints,
} from './policyComparison';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));

const prometheus = {
  namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'monitoring' } },
  podSelector: {
    matchLabels: { 'app.kubernetes.io/name': 'prometheus', 'topology.kubernetes.io/zone': 'a' },
  },
};
const api = { podSelector: { matchLabels: { app: 'api' } } };
const gone = { podSelector: { matchLabels: { 'job-name': 'x-1', app: 'cleanup' } } };

const policy = {
  metadata: {
    name: 'deployment-db',
    namespace: 'shop',
    labels: {
      'kubescape.io/workload-kind': 'Deployment',
      'kubescape.io/workload-name': 'db',
      'kubescape.io/workload-namespace': 'shop',
    },
  },
  spec: {
    spec: {
      podSelector: { matchLabels: { app: 'db' } },
      ingress: [
        { from: [prometheus], ports: [{ protocol: 'TCP', port: 9187 }] },
        { from: [api, gone], ports: [{ protocol: 'TCP', port: 5432 }] },
      ],
      egress: [
        { to: [{ ipBlock: { cidr: '10.9.8.7/32' } }], ports: [{ protocol: 'TCP', port: 443 }] },
      ],
    },
  },
  policyRef: [],
} as unknown as GeneratedNetworkPolicy;

const namespaceLabels = new Map<string, Record<string, string>>([
  ['shop', { 'kubernetes.io/metadata.name': 'shop' }],
  ['monitoring', { 'kubernetes.io/metadata.name': 'monitoring', purpose: 'monitoring' }],
]);

const pod = (
  labels: Record<string, string>,
  ports: { name: string; containerPort: number }[] = []
) => ({
  metadata: { labels },
  spec: { containers: [{ ports }] },
});

describe('resolveEndpoints', () => {
  const flows = observedFlows(policy);

  it('looks up the pods of peers without the labels that differ per placement', () => {
    expect([...podQueries(flows, 'shop', namespaceLabels).values()]).toEqual([
      {
        namespace: 'monitoring',
        selector: { matchLabels: { 'app.kubernetes.io/name': 'prometheus' } },
      },
      { namespace: 'shop', selector: { matchLabels: { app: 'api' } } },
      { namespace: 'shop', selector: { matchLabels: { app: 'cleanup' } } },
    ]);
  });

  it('uses the labels of the pods found, once per set of labels, or those of the policy', () => {
    const queries = [...podQueries(flows, 'shop', namespaceLabels).keys()];
    const replica = { 'app.kubernetes.io/name': 'prometheus', 'prometheus-shard': '0' };
    const resolved = resolveEndpoints(
      flows,
      'shop',
      namespaceLabels,
      new Map([
        [
          queries[0],
          [
            pod({ ...replica, 'pod-template-hash': 'a' }, [
              { name: 'metrics', containerPort: 9090 },
            ]),
            pod({ ...replica, 'pod-template-hash': 'b' }),
          ],
        ],
        [queries[1], [pod({ app: 'api', tier: 'backend' })]],
      ])
    );
    expect(resolved[0].endpoints).toEqual([
      {
        namespace: 'monitoring',
        namespaceLabels: namespaceLabels.get('monitoring'),
        podLabels: { ...replica, 'pod-template-hash': 'b' },
        namedPorts: {},
      },
    ]);
    expect(resolved[1].endpoints[0].podLabels).toEqual({ app: 'api', tier: 'backend' });
    // compared without the labels of its run, which no pod has anymore
    expect(resolved[2]).toMatchObject({
      approximate: true,
      endpoints: [{ namespace: 'shop', podLabels: { app: 'cleanup' } }],
    });
    expect(resolved[3].endpoints).toEqual([{ cidr: '10.9.8.7/32' }]);
  });
});

describe('readPolicyComparison', () => {
  it('compares with the policies of the namespace, using the pod template of the workload', async () => {
    mocks.request.mockImplementation(async (path: string) => {
      if (path.endsWith('/networkpolicies')) {
        return {
          items: [
            {
              metadata: { name: 'default-ingress', namespace: 'shop' },
              spec: {
                podSelector: { matchLabels: { tier: 'data' } },
                policyTypes: ['Ingress'],
                ingress: [{ from: [{ podSelector: {} }] }],
              },
            },
          ],
        };
      }
      if (path === '/api/v1/namespaces') {
        return {
          items: [...namespaceLabels].map(([name, labels]) => ({ metadata: { name, labels } })),
        };
      }
      if (path === '/apis/apps/v1/namespaces/shop/deployments/db') {
        return { spec: { template: { metadata: { labels: { app: 'db', tier: 'data' } } } } };
      }
      if (path.startsWith('/api/v1/namespaces/shop/pods?labelSelector=app%3Dapi')) {
        return { items: [pod({ app: 'api' })] };
      }
      return { items: [] };
    });

    const result = await readPolicyComparison(policy, 'prd');
    expect(result.approximateWorkload).toBe(false);
    expect(result.comparison!.selecting.map(p => p.metadata.name)).toEqual(['default-ingress']);
    expect(result.comparison!.flows.map(f => f.status)).toEqual([
      'blocked',
      'allowed',
      'allowed',
      'unrestricted',
    ]);
    expect(mocks.request).toHaveBeenCalledWith(
      '/apis/networking.k8s.io/v1/namespaces/shop/networkpolicies',
      { cluster: 'prd' }
    );
  });
});
