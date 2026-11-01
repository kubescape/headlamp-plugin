import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { comparePolicies, ExistingPolicy, ObservedFlow } from './compare';
import { ExistingPolicies, peerText } from './ExistingPolicies';
import { createNodes } from './layout';
import { nodeFlowStatuses } from './nodes';
import { portsText } from './ports';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: ({ children, routeName, params }: any) => (
    <a href={`/${routeName}/${params.namespace}/${params.name}`}>{children}</a>
  ),
  Table: ({ data, columns }: any) => (
    <table>
      <tbody>
        {data.map((item: any, i: number) => (
          <tr key={i}>
            {columns.map((col: any, j: number) => (
              <td key={j}>
                {col.Cell
                  ? col.Cell({ row: { original: item } })
                  : (col.accessorFn(item) as ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
afterEach(cleanup);

const api = { podSelector: { matchLabels: { app: 'api' } } };
const job = {
  namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'jobs' } },
  podSelector: { matchLabels: { app: 'job' } },
};
const generated = {
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
      ingress: [{ from: [api, job], ports: [{ protocol: 'TCP', port: 5432 }] }],
    },
  },
  policyRef: [],
} as unknown as GeneratedNetworkPolicy;

const policies: ExistingPolicy[] = [
  {
    metadata: { name: 'default-ingress', namespace: 'shop' },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [
        { from: [{ podSelector: {} }] },
        { from: [{ namespaceSelector: { matchLabels: { purpose: 'monitoring' } } }] },
      ],
    },
  },
];

const flows: ObservedFlow[] = [
  {
    direction: 'ingress',
    peer: api,
    ports: [{ protocol: 'TCP', port: '5432' }],
    endpoints: [{ namespace: 'shop', namespaceLabels: {}, podLabels: { app: 'api' } }],
  },
  {
    direction: 'ingress',
    peer: job,
    ports: [{ protocol: 'TCP', port: '5432' }],
    endpoints: [{ namespace: 'jobs', namespaceLabels: {}, podLabels: { app: 'job' } }],
    approximate: true,
  },
];
const comparison = comparePolicies(
  policies,
  { namespace: 'shop', podLabels: { app: 'db' } },
  flows
);

it('describes peers and ports as a policy selects them', () => {
  expect(peerText(api, 'shop')).toBe('pods with app=api in namespace shop');
  expect(peerText(job, 'shop')).toBe('pods with app=job in namespace jobs');
  expect(peerText({ namespaceSelector: { matchLabels: { purpose: 'monitoring' } } }, 'shop')).toBe(
    'all pods in namespaces with purpose=monitoring'
  );
  expect(peerText({ namespaceSelector: {}, podSelector: {} }, 'shop')).toBe(
    'all pods in all namespaces'
  );
  expect(peerText({ ipBlock: { cidr: '10.0.0.0/8', except: ['10.1.0.0/16'] } }, 'shop')).toBe(
    '10.0.0.0/8 except 10.1.0.0/16'
  );
  expect(portsText(undefined)).toBe('all ports');
  expect(
    portsText([
      { port: '8000', endPort: 8010 },
      { protocol: 'UDP', port: '53' },
    ])
  ).toBe('TCP:8000-8010, UDP:53');
});

it('shows which observed traffic the current policies allow, and the rules without traffic', () => {
  render(
    <ExistingPolicies generatedNetworkPolicy={generated} result={{ comparison }} cluster="prd" />
  );
  expect(
    screen.getByText('Ingress is restricted by default-ingress: 1 of 2 observed flows are allowed.')
  ).toBeTruthy();
  expect(screen.getByText('Egress is not restricted: no NetworkPolicy limits it.')).toBeTruthy();
  expect(screen.getByText('Allowed')).toBeTruthy();
  // the peer's pods were not found, so the labels of the generated policy were compared
  expect(screen.getByText('Not allowed *')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'default-ingress' })[0].getAttribute('href')).toBe(
    '/networkpolicy/shop/default-ingress'
  );
  expect(screen.getByText('1 flow')).toBeTruthy();
  expect(screen.getByText('None')).toBeTruthy();
});

it('says when no policy selects the workload', () => {
  render(
    <ExistingPolicies
      generatedNetworkPolicy={generated}
      result={{ comparison: comparePolicies([], { namespace: 'shop', podLabels: {} }, flows) }}
      cluster="prd"
    />
  );
  expect(
    screen.getByText(/No NetworkPolicy selects db, so all its traffic is allowed/)
  ).toBeTruthy();
  expect(screen.getAllByText('Not restricted')).toHaveLength(2);
});

it('gives each node of the diagram the status of the traffic of its peers', () => {
  const { nodes } = createNodes(generated);
  const statuses = nodeFlowStatuses(nodes, comparison.flows);
  const statusOf = (peer: object) =>
    statuses.get(nodes.find(node => (node.data.peers as object[] | undefined)?.includes(peer))!.id);
  expect(statusOf(api)).toEqual({ status: 'allowed', allowedBy: ['default-ingress'] });
  expect(statusOf(job)).toEqual({ status: 'blocked', allowedBy: [] });
  expect(statuses.has('main')).toBe(false);
});
