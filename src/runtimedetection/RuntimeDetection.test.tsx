import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { RuntimeDetection } from './RuntimeDetection';

const mocks = vi.hoisted(() => ({
  containerProfileClass: { pluralName: 'containerprofiles' },
  applicationProfileClass: { pluralName: 'applicationprofiles' },
  networkNeighborhoodsClass: { pluralName: 'networkneighborhoods' },
  discoverProfileResource: vi.fn(),
  listQuery: vi.fn(),
  request: vi.fn(),
  remove: vi.fn(),
  post: vi.fn(),
  updateConfig: vi.fn(),
  clusters: ['cluster-a'],
  alertmanagerUrl: '',
  ruleObjects: [] as any[],
}));

vi.mock('../index', () => ({
  RoutingName: {
    RuntimeDetection: 'Runtime Detection',
    NetworkNeighborhoodDetail: 'Network Neighborhood Detail',
    RuleNew: 'New Rule',
    RuleEdit: 'Edit Rule',
    RuleBindingNew: 'New Rule Binding',
    RuleBindingEdit: 'Edit Rule Binding',
  },
  useHLSelectedClusters: () => mocks.clusters,
}));
vi.mock('../model', () => ({
  containerProfileClass: mocks.containerProfileClass,
  applicationProfileClass: mocks.applicationProfileClass,
  networkNeighborhoodsClass: mocks.networkNeighborhoodsClass,
  listQuery: mocks.listQuery,
  rulesClass: { useList: () => [mocks.ruleObjects] },
}));
vi.mock('../softwarecomposition/profileApi', () => ({
  discoverProfileResource: mocks.discoverProfileResource,
}));
vi.mock('../common/config-store', () => ({
  getAlertmanagerUrl: () => mocks.alertmanagerUrl,
  isValidAlertmanagerAddress: () => true,
  kubescapeConfigStore: {
    useConfig: () => () => ({}),
    update: mocks.updateConfig,
    get: () => ({ alertmanagerUrl: 'monitoring/alertmanager:9093' }),
  },
}));
vi.mock('../common/currentUser', () => ({
  getCurrentUser: async () => 'jane',
  useCurrentUser: () => 'jane',
}));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Router: { createRouteURL: (route: string) => `/${route}` },
}));
// The setup check has its own tests
vi.mock('../common/SetupCheck', () => ({ SetupCheck: () => null }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  remove: mocks.remove,
  post: mocks.post,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  NameValueTable: ({ rows }: any) => (
    <dl>
      {rows.map((row: any) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
  SectionBox: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
  ShowHideLabel: ({ children }: { children: ReactNode }) => <>{children}</>,
  Link: ({ children, routeName, params, activeCluster }: any) => (
    <a
      href={`${activeCluster ? `/${activeCluster}` : ''}/${routeName}/${params.namespace}/${
        params.name
      }`}
    >
      {children}
    </a>
  ),
  Table: ({ data = [], columns }: any) => (
    <table data-testid={`table-${columns.map((column: any) => column.header).join('-')}`}>
      <thead>
        <tr>
          {columns.map((column: any, index: number) => (
            <th key={index}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item: any, index: number) => (
          <tr key={index}>
            {columns.map((column: any, cellIndex: number) => {
              const value = column.accessorFn?.(item) ?? item[column.accessorKey];
              const cell = { getValue: () => value };
              // the cell props of the column; Headlamp replaces those of the table
              const props =
                typeof column.muiTableBodyCellProps === 'function'
                  ? column.muiTableBodyCellProps({ cell, row: { original: item } })
                  : {};
              return (
                <td
                  key={cellIndex}
                  onClick={props.onClick}
                  onKeyDown={props.onKeyDown}
                  tabIndex={props.tabIndex}
                >
                  {column.Cell ? column.Cell({ cell, row: { original: item } }) : value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const profile = {
  kind: 'ContainerProfile',
  metadata: {
    name: 'deployment-web-app',
    namespace: 'workloads',
    labels: {
      'kubescape.io/workload-name': 'web-app',
      'kubescape.io/workload-kind': 'Deployment',
    },
    annotations: { 'kubescape.io/status': 'completed' },
  },
  spec: { execs: [{ path: '/bin/web' }], egress: [{ dns: 'api.example.test' }] },
};

beforeEach(() => {
  mocks.discoverProfileResource.mockReset();
  mocks.discoverProfileResource.mockResolvedValue({ plural: 'containerprofiles', modern: true });
  mocks.listQuery.mockReset();
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({ items: [] });
  mocks.remove.mockReset();
  mocks.post.mockReset();
  mocks.updateConfig.mockReset();
  mocks.clusters = ['cluster-a'];
  mocks.alertmanagerUrl = '';
  mocks.ruleObjects = [];
});
afterEach(cleanup);

function renderRuntimeDetection() {
  return render(
    <MemoryRouter>
      <RuntimeDetection />
    </MemoryRouter>
  );
}

function openProfileTab(view: 'behavior' | 'network') {
  fireEvent.click(
    screen.getByRole('tab', {
      name: view === 'behavior' ? 'Application Profiles' : 'Network Neighborhoods',
    })
  );
}

it('lists one ContainerProfile in both behavior and network views while preserving deep links and status', async () => {
  mocks.listQuery.mockImplementation(async resourceClass => {
    if (resourceClass !== mocks.containerProfileClass) {
      throw new Error(`Unsupported resource ${resourceClass.pluralName}`);
    }
    return [profile];
  });

  renderRuntimeDetection();

  expect(mocks.discoverProfileResource).not.toHaveBeenCalled();
  expect(mocks.listQuery).not.toHaveBeenCalled();
  openProfileTab('behavior');
  await waitFor(() => expect(mocks.listQuery).toHaveBeenCalledTimes(1));

  const behaviorTable = screen.getByTestId('table-Name-Kind-Namespace-Container-Status');
  await waitFor(() => expect(within(behaviorTable).getByText('completed')).toBeTruthy());
  expect(within(behaviorTable).getByText('web-app', { selector: 'a' }).getAttribute('href')).toBe(
    '/Runtime Detection/workloads/deployment-web-app'
  );

  openProfileTab('network');
  await waitFor(() => expect(mocks.listQuery).toHaveBeenCalledTimes(2));
  expect(mocks.discoverProfileResource.mock.calls.map(([view]) => view)).toEqual([
    'behavior',
    'network',
  ]);
  expect(
    mocks.listQuery.mock.calls.every(
      ([resourceClass]) => resourceClass === mocks.containerProfileClass
    )
  ).toBe(true);
  const networkTable = screen.getByTestId('table-Name-Kind-Namespace-Container-Status');
  expect(within(networkTable).getByText('web-app', { selector: 'a' }).getAttribute('href')).toBe(
    '/Network Neighborhood Detail/workloads/deployment-web-app'
  );
});

it('lists legacy profile resources on an older Storage API without changing detail links', async () => {
  mocks.discoverProfileResource.mockImplementation(async view =>
    view === 'behavior'
      ? { plural: 'applicationprofiles', modern: false }
      : { plural: 'networkneighborhoods', modern: false }
  );
  mocks.listQuery.mockImplementation(async resourceClass => [
    {
      ...profile,
      kind:
        resourceClass === mocks.applicationProfileClass
          ? 'ApplicationProfile'
          : 'NetworkNeighborhood',
    },
  ]);

  renderRuntimeDetection();

  openProfileTab('behavior');
  await waitFor(() => expect(mocks.listQuery).toHaveBeenCalledTimes(1));
  const behaviorTable = screen.getByTestId('table-Name-Kind-Namespace-Container-Status');
  expect(within(behaviorTable).getByText('web-app', { selector: 'a' }).getAttribute('href')).toBe(
    '/Runtime Detection/workloads/deployment-web-app'
  );

  openProfileTab('network');
  await waitFor(() => expect(mocks.listQuery).toHaveBeenCalledTimes(2));
  expect(mocks.listQuery.mock.calls.map(([resourceClass]) => resourceClass)).toEqual([
    mocks.applicationProfileClass,
    mocks.networkNeighborhoodsClass,
  ]);
  const networkTable = screen.getByTestId('table-Name-Kind-Namespace-Container-Status');
  expect(within(networkTable).getByText('web-app', { selector: 'a' }).getAttribute('href')).toBe(
    '/Network Neighborhood Detail/workloads/deployment-web-app'
  );
});

it('shows API discovery failures without querying an assumed legacy resource', async () => {
  mocks.discoverProfileResource.mockRejectedValue(new Error('Discovery forbidden'));

  renderRuntimeDetection();

  openProfileTab('behavior');
  expect(await screen.findByText('Discovery forbidden')).toBeTruthy();
  openProfileTab('network');
  expect(await screen.findByText('Discovery forbidden')).toBeTruthy();
  expect(mocks.listQuery).not.toHaveBeenCalled();
  expect(screen.queryByText('No profiles found.')).toBeNull();
});

it('shows retrieval errors for both views instead of a misleading empty result', async () => {
  mocks.listQuery.mockRejectedValue(new Error('Storage temporarily unavailable'));

  renderRuntimeDetection();

  openProfileTab('behavior');
  expect(await screen.findByText('Storage temporarily unavailable')).toBeTruthy();
  openProfileTab('network');
  expect(await screen.findByText('Storage temporarily unavailable')).toBeTruthy();
  expect(mocks.listQuery).toHaveBeenCalledTimes(2);
  expect(screen.queryAllByTestId('table-Name-Kind-Namespace-Container-Status')).toHaveLength(0);
  expect(screen.queryByText('No profiles found.')).toBeNull();
});

it('accepts an empty ContainerProfile list without showing an API error', async () => {
  mocks.listQuery.mockResolvedValue([]);

  renderRuntimeDetection();

  openProfileTab('behavior');
  expect(await screen.findByText('No profiles found.')).toBeTruthy();
  expect(
    screen.getByTestId('table-Name-Kind-Namespace-Container-Status').querySelectorAll('tbody tr')
  ).toHaveLength(0);
  openProfileTab('network');
  expect(await screen.findByText('No profiles found.')).toBeTruthy();
  expect(mocks.listQuery).toHaveBeenCalledTimes(2);
  expect(
    mocks.listQuery.mock.calls.every(
      ([resourceClass]) => resourceClass === mocks.containerProfileClass
    )
  ).toBe(true);
  expect(screen.queryByText('Storage temporarily unavailable')).toBeNull();
  expect(
    screen.getByTestId('table-Name-Kind-Namespace-Container-Status').querySelectorAll('tbody tr')
  ).toHaveLength(0);
});

it('offers the Alertmanager found in the cluster while none is configured', async () => {
  mocks.request.mockImplementation(async (url: string) =>
    url === '/api/v1/services'
      ? {
          items: [
            {
              metadata: { name: 'alertmanager', namespace: 'monitoring' },
              spec: { ports: [{ port: 9093 }] },
            },
          ],
        }
      : { items: [] }
  );

  renderRuntimeDetection();

  fireEvent.click(await screen.findByText('Use monitoring/alertmanager:9093'));
  expect(mocks.updateConfig).toHaveBeenCalledWith({
    alertmanagerUrl: 'monitoring/alertmanager:9093',
  });
  expect(mocks.request).toHaveBeenCalledWith('/api/v1/services', { cluster: 'cluster-a' });
});

it('silences an alert as the current user and ends silences', async () => {
  const proxy = '/api/v1/namespaces/monitoring/services/alertmanager:9093/proxy';
  mocks.alertmanagerUrl = proxy;
  mocks.request.mockImplementation(async (url: string) => {
    if (url.startsWith(`${proxy}/api/v2/alerts`)) {
      return [
        {
          labels: {
            alertname: 'KubescapeRuleViolated',
            rule_name: 'Unexpected process launched',
            workload_name: 'web',
            namespace: 'shop',
          },
          annotations: {},
          startsAt: '2026-10-30T10:00:00Z',
          status: { state: 'active' },
          fingerprint: 'abc',
        },
      ];
    }
    if (url.startsWith(`${proxy}/api/v2/silences`)) {
      return [
        {
          id: 'silence-1',
          status: { state: 'active' },
          matchers: [{ name: 'workload_name', value: 'db', isRegex: false, isEqual: true }],
          startsAt: '2026-10-30T09:00:00Z',
          endsAt: '2026-10-31T09:00:00Z',
          createdBy: 'bob',
          comment: 'Silenced for 24 hours in Headlamp',
        },
      ];
    }
    return { items: [] };
  });
  mocks.post.mockImplementation(async (url: string) =>
    url.includes('selfsubjectaccessreviews') ? { status: { allowed: true } } : { silenceID: 's2' }
  );

  renderRuntimeDetection();

  fireEvent.click(await screen.findByRole('button', { name: 'Silence' }));
  const dialog = screen.getByRole('dialog', { name: 'Silence an alert' });
  expect(within(dialog).getByText('The silence is recorded in Alertmanager as jane.')).toBeTruthy();
  // the workload is the scope unless another is chosen
  expect(within(dialog).getByRole('radio', { name: /This workload/ })).toHaveProperty(
    'checked',
    true
  );
  fireEvent.click(within(dialog).getByRole('radio', { name: /All workloads in namespace/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: '1 hour' }));
  // a silence needs a reason
  const silenceButton = within(dialog).getByRole('button', { name: 'Silence' });
  expect(silenceButton).toHaveProperty('disabled', true);
  fireEvent.change(within(dialog).getByRole('textbox', { name: /Reason/ }), {
    target: { value: 'Expected during the migration' },
  });
  fireEvent.click(silenceButton);

  expect(
    await screen.findByText('Silenced Unexpected process launched in namespace shop for 1 hour.')
  ).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  const [url, silence, , options] = mocks.post.mock.calls.find(([url]) =>
    url.endsWith('/api/v2/silences')
  )!;
  expect(url).toBe(`${proxy}/api/v2/silences`);
  expect(silence.createdBy).toBe('jane');
  expect(silence.comment).toBe('Expected during the migration');
  expect(silence.matchers.map((matcher: any) => matcher.name)).toEqual([
    'alertname',
    'rule_name',
    'namespace',
  ]);
  expect(options).toEqual({ cluster: 'cluster-a' });

  expect(screen.getByText('workload_name=db')).toBeTruthy();
  expect(screen.getByText(/Silenced by bob until/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'End silence' }));
  await waitFor(() =>
    expect(mocks.remove).toHaveBeenCalledWith(`${proxy}/api/v2/silence/silence-1`, {
      cluster: 'cluster-a',
    })
  );
});

it('shows an alert of the node-agent by severity, workload and finding, with its details', async () => {
  const proxy = '/api/v1/namespaces/monitoring/services/alertmanager:9093/proxy';
  mocks.alertmanagerUrl = proxy;
  mocks.request.mockImplementation(async (url: string) =>
    url.startsWith(`${proxy}/api/v2/alerts`)
      ? [
          {
            labels: {
              alertname: 'KubescapeRuleViolated',
              rule_name: 'DNS Anomalies in container',
              rule_id: 'R0005',
              severity: '1',
              namespace: 'certificates',
              pod_name: 'cert-watch-b576bb668-5f2s6',
              container_name: 'watcher',
              node_name: 'node-1',
              comm: 'python3',
              pid: '9635',
              pcomm: 'containerd-shim',
              ppid: '7476',
              // node-agent v0.3 sends memory addresses as ids
              uid: '824701441376',
              gid: '0',
              trace: '{}',
              profile_status: 'completed',
            },
            annotations: {
              description:
                'Unexpected domain communication: _acme-challenge.example.com. from: watcher',
              summary:
                "Rule 'DNS Anomalies in container' in 'cert-watch-b576bb668-5f2s6' namespace 'certificates' failed",
              fix: '',
            },
            startsAt: '2026-10-31T17:19:17Z',
            endsAt: '2026-10-31T18:19:17Z',
            status: { state: 'active' },
            fingerprint: 'abc',
          },
        ]
      : { items: [] }
  );
  mocks.post.mockResolvedValue({ status: { allowed: true } });
  mocks.ruleObjects = [
    {
      cluster: 'cluster-a',
      jsonData: {
        metadata: { name: 'default-rules', namespace: 'kubescape' },
        spec: {
          rules: [
            {
              id: 'R0005',
              name: 'DNS Anomalies in container',
              description:
                'Detects unexpected domain requests that are not whitelisted by the learned profile',
              mitreTactic: 'TA0011',
              mitreTechnique: 'T1071.004',
              profileDependency: 0,
            },
          ],
        },
      },
    },
  ];

  renderRuntimeDetection();

  expect(await screen.findByText('cert-watch')).toBeTruthy();
  expect(screen.getByText('Low')).toBeTruthy();
  expect(
    screen.getByText('Unexpected domain communication: _acme-challenge.example.com. from: watcher')
  ).toBeTruthy();

  // the silence button of the row opens only the silence dialog, and clicks in that dialog do
  // not reach the row
  fireEvent.click(screen.getByRole('button', { name: 'Silence' }));
  const silenceDialog = screen.getByRole('dialog', { name: 'Silence an alert' });
  expect(
    within(silenceDialog).getByText(/pod_name=~cert-watch-\[bcdfghjklmnpqrstvwxz2456789\]/)
  ).toBeTruthy();
  fireEvent.click(within(silenceDialog).getByText('The whole cluster'));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(within(silenceDialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  // a click anywhere else on the row does
  fireEvent.click(screen.getByText('cert-watch'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('python3 (PID 9635)')).toBeTruthy();
  expect(within(dialog).getByText('containerd-shim (PID 7476)')).toBeTruthy();
  expect(within(dialog).getByText('DNS Anomalies in container (R0005)')).toBeTruthy();
  expect(within(dialog).getByText('Low (priority 1)')).toBeTruthy();
  // what the rule detects, from the rules of the cluster
  expect(
    within(dialog).getByText(
      'Detects unexpected domain requests that are not whitelisted by the learned profile.'
    )
  ).toBeTruthy();
  expect(within(dialog).getByText('T1071.004').getAttribute('href')).toBe(
    'https://attack.mitre.org/techniques/T1071/004/'
  );
  expect(within(dialog).getByText(/^Required/)).toBeTruthy();
  expect(within(dialog).getByText('Group ID')).toBeTruthy();
  expect(within(dialog).queryByText('User ID')).toBeNull();
  expect(within(dialog).queryByText('Fix')).toBeNull();
  expect(within(dialog).queryByText('Trace')).toBeNull();
  expect(
    within(dialog).getByText('cert-watch-b576bb668-5f2s6').closest('a')?.getAttribute('href')
  ).toBe('/cluster-a/pod/certificates/cert-watch-b576bb668-5f2s6');
  fireEvent.click(within(dialog).getByText('Close'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  // and so does Enter on the rule
  fireEvent.keyDown(screen.getByText('DNS Anomalies in container'), { key: 'Enter' });
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('lists and deletes the rule bindings of each selected cluster', async () => {
  mocks.clusters = ['cluster-a', 'cluster-b'];
  mocks.request.mockImplementation(async (url: string, { cluster }: { cluster: string }) =>
    url === '/apis/kubescape.io/v1/runtimerulealertbindings'
      ? { items: [{ metadata: { name: `binding-${cluster}` }, spec: { rules: [] } }] }
      : { items: [] }
  );

  renderRuntimeDetection();
  fireEvent.click(screen.getByRole('tab', { name: 'Rule Bindings' }));

  expect(await screen.findByText('binding-cluster-b')).toBeTruthy();
  expect(screen.getByText('binding-cluster-a')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete binding-cluster-b' }));
  await waitFor(() =>
    expect(mocks.remove).toHaveBeenCalledWith(
      '/apis/kubescape.io/v1/runtimerulealertbindings/binding-cluster-b',
      { cluster: 'cluster-b' }
    )
  );
});
