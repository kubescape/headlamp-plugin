import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { addKubescapeColumns } from './tableColumns';
import { clearWorkloadSummaries } from './workloadSummaries';

const mocks = vi.hoisted(() => ({ listQuery: vi.fn(), config: {} as any }));
vi.mock('../query', () => ({
  paginatedListQuery: async (cluster: string, resourceClass: any, ...rest: any[]) => ({
    items: await mocks.listQuery(resourceClass, cluster, ...rest),
  }),
}));
vi.mock('../model', () => ({
  vulnerabilityManifestSummaryClass: { pluralName: 'vulnerabilitymanifestsummaries' },
  workloadConfigurationScanSummaryClass: { pluralName: 'workloadconfigurationscansummaries' },
}));
vi.mock('../common/config-store', () => ({ kubescapeConfigStore: { get: () => mocks.config } }));
vi.mock('../index', () => ({
  RoutingName: {
    KubescapeVulnerabilityDetails: 'Vulnerability',
    KubescapeWorkloadConfigurationScanDetails: 'Configuration Scan',
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'current' }));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: ({ children, routeName, params, activeCluster, 'aria-label': label }: any) => (
    <a
      href={`/${activeCluster}/${routeName}/${params.namespace}/${params.name}`}
      aria-label={label}
    >
      {children}
    </a>
  ),
}));

const workloadLabels = {
  'kubescape.io/workload-kind': 'Deployment',
  'kubescape.io/workload-name': 'web',
  'kubescape.io/workload-namespace': 'shop',
};

beforeEach(() => {
  mocks.config = {};
  clearWorkloadSummaries();
  mocks.listQuery.mockReset().mockImplementation(async (resourceClass: any) =>
    resourceClass.pluralName === 'vulnerabilitymanifestsummaries'
      ? [
          {
            metadata: {
              name: 'deployment-web-web',
              namespace: 'shop',
              labels: { ...workloadLabels, 'kubescape.io/workload-container-name': 'web' },
            },
            spec: {
              severities: {
                critical: { all: 2 },
                high: { all: 7 },
                medium: { all: 0 },
                low: { all: 0 },
              },
            },
          },
        ]
      : [
          {
            metadata: { name: 'deployment-web', namespace: 'shop', labels: workloadLabels },
            spec: { severities: { critical: 1, high: 4, medium: 0, low: 0 } },
          },
        ]
  );
});
afterEach(cleanup);

it('adds the columns to the workload lists before the age column', () => {
  const columns = addKubescapeColumns({ id: 'headlamp-deployments', columns: ['name', 'age'] });
  expect(columns.map((column: any) => column.id ?? column)).toEqual([
    'name',
    'kubescape-vulnerabilities',
    'kubescape-controls',
    'age',
  ]);
  // processors may run more than once
  expect(addKubescapeColumns({ id: 'headlamp-deployments', columns })).toHaveLength(4);
});

it('leaves other lists alone, and all lists when turned off', () => {
  expect(addKubescapeColumns({ id: 'headlamp-services', columns: ['name'] })).toEqual(['name']);
  mocks.config = { tableColumns: false };
  expect(addKubescapeColumns({ id: 'headlamp-pods', columns: ['name'] })).toEqual(['name']);
});

it('shows the critical and high counts of the workload that runs a pod', async () => {
  const [cves, controls] = addKubescapeColumns({ id: 'headlamp-pods', columns: [] });
  const pod = {
    kind: 'Pod',
    cluster: 'cluster-a',
    metadata: {
      name: 'web-6d4cf56db6-abcde',
      namespace: 'shop',
      labels: { 'pod-template-hash': '6d4cf56db6' },
      ownerReferences: [{ kind: 'ReplicaSet', name: 'web-6d4cf56db6', controller: true }],
    },
  };

  render(
    <>
      {cves.render(pod) as ReactNode}
      {controls.render(pod) as ReactNode}
    </>
  );

  expect((await screen.findByLabelText('2 Critical findings')).getAttribute('href')).toBe(
    '/cluster-a/Vulnerability/shop/deployment-web-web'
  );
  expect(screen.getByLabelText('7 High findings')).toBeTruthy();
  expect(screen.getByLabelText('4 High findings').getAttribute('href')).toBe(
    '/cluster-a/Configuration Scan/shop/deployment-web'
  );
  expect(mocks.listQuery.mock.calls.map(call => call[1])).toEqual(['cluster-a', 'cluster-a']);
  expect(cves.getValue(pod)).toBe('2 7');
});

it('sorts the most critical first and rows without results last', async () => {
  const [cves] = addKubescapeColumns({ id: 'headlamp-deployments', columns: [] });
  const web = { kind: 'Deployment', metadata: { name: 'web', namespace: 'shop' } };
  const other = { kind: 'Deployment', metadata: { name: 'other', namespace: 'shop' } };

  render(<>{cves.render(web) as ReactNode}</>);
  await screen.findByLabelText('2 Critical findings');

  expect([other, web].sort(cves.sort)).toEqual([web, other]);
});
