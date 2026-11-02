import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { FrameworksPage } from './FrameworkList';

const mocks = vi.hoisted(() => ({
  configMaps: [] as any[],
  remove: vi.fn(),
  // SelfSubjectAccessReviews
  post: vi.fn(),
  // permission answers are kept per cluster, so a test that needs others uses its own cluster
  cluster: 'cluster-a',
  enqueueSnackbar: vi.fn(),
  namespace: { kubeScapeNamespace: 'kubescape', error: null } as {
    kubeScapeNamespace?: string;
    error: string | null;
  },
}));

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: { ResourceClasses: { ConfigMap: { useList: () => [mocks.configMaps] } } },
  Router: { createRouteURL: (route: string) => `/${route}` },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  remove: mocks.remove,
  post: mocks.post,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => mocks.cluster }));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: ({ children }: any) => <a href="#framework">{children}</a>,
  Table: ({ data = [], columns }: any) => (
    <table>
      <tbody>
        {data.map((item: any, index: number) => (
          <tr key={index}>
            {columns.map((column: any, cellIndex: number) => (
              <td key={cellIndex}>{column.accessorFn?.(item) ?? item[column.accessorKey]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));
vi.mock('../custom-objects/api-queries', () => ({
  getKubescapeNamespace: async () => mocks.namespace,
  useKubescapeNamespace: () => ({ ...mocks.namespace, loading: false }),
}));
vi.mock('../index', () => ({
  RoutingName: {
    FrameworkControls: 'Framework Controls',
    FrameworkNew: 'New Framework',
    FrameworkEdit: 'Edit Framework',
  },
}));
vi.mock('../model', () => ({ customObjectLabel: 'kubescape.io/custom-object' }));
vi.mock('../rego', () => ({
  useRegoData: () => ({ controls: [{ controlID: 'C-0016' }], frameworks: [] }),
}));

beforeEach(() => {
  mocks.configMaps = [
    {
      metadata: { name: 'framework-team-baseline' },
      jsonData: {
        data: { name: 'Team baseline', description: 'Ours', controlsIDs: '["C-0016"]' },
      },
    },
  ];
  mocks.namespace = { kubeScapeNamespace: 'kubescape', error: null };
  mocks.cluster = 'cluster-a';
  mocks.post.mockReset().mockResolvedValue({ status: { allowed: true } });
  mocks.remove.mockReset().mockResolvedValue({});
  mocks.enqueueSnackbar.mockReset();
});
afterEach(cleanup);

function renderPage() {
  render(
    <MemoryRouter>
      <FrameworksPage />
    </MemoryRouter>
  );
}

it('deletes a custom framework only after a confirmation that names it', async () => {
  mocks.remove.mockRejectedValueOnce(
    new Error('configmaps "framework-team-baseline" is forbidden')
  );
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Team baseline' }));

  const dialog = await screen.findByRole('dialog', { name: 'Delete custom framework?' });
  expect(dialog.textContent).toBe(
    'Delete custom framework?Deletes the custom framework Team baseline in namespace kubescape of ' +
      'cluster cluster-a. Its ConfigMap framework-team-baseline is deleted, and the Compliance ' +
      'page no longer offers it.CancelDelete'
  );
  // nothing is deleted until the user confirms
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.remove).not.toHaveBeenCalled();

  // a failed delete keeps the dialog open with the error
  fireEvent.click(screen.getByRole('button', { name: 'Delete Team baseline' }));
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' })
  );
  expect(await screen.findByText('configmaps "framework-team-baseline" is forbidden')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.remove).toHaveBeenLastCalledWith(
    '/api/v1/namespaces/kubescape/configmaps/framework-team-baseline'
  );
  expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Team baseline deleted successfully', {
    variant: 'success',
  });
});

it('asks nothing when the Kubescape namespace is not found', async () => {
  mocks.namespace = { error: 'Kubescape is not installed', kubeScapeNamespace: undefined };
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Team baseline' }));

  await waitFor(() =>
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Kubescape is not installed', {
      variant: 'error',
    })
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it('offers no add or delete without permission for the ConfigMaps of the Kubescape namespace', async () => {
  mocks.cluster = 'cluster-without-configmaps';
  mocks.post.mockImplementation(async (_url: string, review: any) => ({
    status: { allowed: review.spec.resourceAttributes.resource !== 'configmaps' },
  }));
  renderPage();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Delete Team baseline' })).toHaveProperty(
      'disabled',
      true
    )
  );
  expect(screen.getByRole('button', { name: 'Add custom framework' })).toHaveProperty(
    'disabled',
    true
  );
  expect(
    screen.getByLabelText(
      'You are not allowed to delete configmaps framework-team-baseline in namespace kubescape.'
    )
  ).toBeTruthy();
  expect(
    screen.getByLabelText('You are not allowed to create configmaps in namespace kubescape.')
  ).toBeTruthy();
});
