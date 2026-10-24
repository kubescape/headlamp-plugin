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
}));
vi.mock('../model', () => ({
  containerProfileClass: mocks.containerProfileClass,
  applicationProfileClass: mocks.applicationProfileClass,
  networkNeighborhoodsClass: mocks.networkNeighborhoodsClass,
  listQuery: mocks.listQuery,
  rulesClass: { useList: () => [[]] },
}));
vi.mock('../softwarecomposition/profileApi', () => ({
  discoverProfileResource: mocks.discoverProfileResource,
}));
vi.mock('../common/config-store', () => ({ getAlertmanagerUrl: () => '' }));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Router: { createRouteURL: (route: string) => `/${route}` },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  remove: vi.fn(),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
  ShowHideLabel: ({ children }: { children: ReactNode }) => <>{children}</>,
  Link: ({ children, routeName, params }: any) => (
    <a href={`/${routeName}/${params.namespace}/${params.name}`}>{children}</a>
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
              return (
                <td key={cellIndex}>
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
