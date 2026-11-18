import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { FrameworkEdit, FrameworkNew } from './FrameworkEdit';

const mocks = vi.hoisted(() => ({
  // SelfSubjectAccessReviews and ConfigMap creation
  post: vi.fn(),
  put: vi.fn(),
  saveConfigMap: vi.fn(),
  enqueueSnackbar: vi.fn(),
  existing: {} as any,
}));

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: { ResourceClasses: { ConfigMap: { useGet: () => [{ jsonData: mocks.existing }] } } },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  ApiError: Error,
  post: mocks.post,
  put: mocks.put,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'cluster-a' }));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ children }: any) => <section>{children}</section>,
  NameValueTable: ({ rows }: any) => (
    <div>
      {rows.map((row: any) => (
        <div key={row.name}>{row.value}</div>
      ))}
    </div>
  ),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));
vi.mock('../custom-objects/api-queries', () => ({
  checkUniqueness: async () => true,
  useKubescapeNamespace: () => ({ kubeScapeNamespace: 'kubescape', error: null, loading: false }),
}));
vi.mock('../common/filedialog', () => ({ saveToFile: vi.fn() }));
vi.mock('../common/PluginHelper', () => ({ getKubescapePluginUrl: async () => '' }));
vi.mock('../compliance/Compliance', () => ({ complianceSeverity: () => 'High' }));
vi.mock('../common/url', () => ({ getURLSegments: () => ['dev-framework-abc123'] }));
vi.mock('../model', () => ({ customObjectLabel: 'kubescape.io/custom-object' }));
vi.mock('../rego', () => ({
  defaultFrameworkNames: ['NSA'],
  useRegoData: () => ({
    controls: [{ controlID: 'C-0016', name: 'Allow privilege escalation', baseScore: 6 }],
    frameworks: [{ name: 'NSA', controls: [{ controlID: 'C-0016' }] }],
    loading: false,
  }),
}));

// Validation of the API server for metadata.name of a ConfigMap and for label values
const dns1123Subdomain = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const labelValue = /^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/;

beforeEach(() => {
  mocks.enqueueSnackbar.mockReset();
  mocks.saveConfigMap
    .mockReset()
    .mockImplementation((_url: string, body: any) =>
      Promise.resolve({ ...body, metadata: { ...body.metadata, uid: 'new-uid' } })
    );
  mocks.post
    .mockReset()
    .mockImplementation((url: string, body: any) =>
      url.includes('selfsubjectaccessreviews')
        ? Promise.resolve({ status: { allowed: true } })
        : mocks.saveConfigMap(url, body)
    );
  mocks.put.mockReset();
  mocks.existing = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'dev-framework-abc123', namespace: 'kubescape', uid: 'u1', labels: {} },
    data: { name: 'Dev', description: '', controlsIDs: '["C-0016"]' },
  };
});
afterEach(cleanup);

const saveButton = () =>
  screen.findByRole('button', { name: 'Save policy as a Configmap in k8s cluster' });

async function createFramework(name: string) {
  render(
    <MemoryRouter>
      <FrameworkNew />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByPlaceholderText('Enter Framework Name'), {
    target: { value: name },
  });
  // the first checkboxes select all controls, the next one is C-0016
  fireEvent.click(screen.getAllByRole('checkbox')[2]);
  fireEvent.click(await saveButton());
}

it.each([
  ['Dev', 'dev'],
  ['Dev Framework', 'dev-framework'],
  ['My Dev Framework', 'my-dev-framework'],
  ['My  Dev Framework', 'my-dev-framework'],
])('creates a ConfigMap that Kubernetes accepts for %j', async (name, kubernetesName) => {
  await createFramework(name);

  await waitFor(() => expect(mocks.saveConfigMap).toHaveBeenCalledTimes(1));
  const [url, configMap] = mocks.saveConfigMap.mock.calls[0];
  expect(url).toBe('/api/v1/namespaces/kubescape/configmaps');
  expect(configMap.metadata.name).toMatch(new RegExp(`^${kubernetesName}-framework-[a-z0-9]+$`));
  expect(configMap.metadata.name).toMatch(dns1123Subdomain);
  expect(configMap.metadata.labels['app.kubernetes.io/name']).toBe(kubernetesName);
  expect(configMap.metadata.labels['kubescape.io/custom-object']).toBe('framework');
  expect(configMap.data.name).toBe(name);
  await waitFor(() =>
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(`${name} saved successfully`, {
      variant: 'success',
    })
  );
});

it('keeps the label of a long name within 63 characters and the full name in the data', async () => {
  // 64 characters, and the cut at 63 would end with a dash
  const name = `${'a'.repeat(62)} ${'b'.repeat(70)}`;
  await createFramework(name);

  await waitFor(() => expect(mocks.saveConfigMap).toHaveBeenCalledTimes(1));
  const configMap = mocks.saveConfigMap.mock.calls[0][1];
  const label = configMap.metadata.labels['app.kubernetes.io/name'];
  expect(label).toBe('a'.repeat(62));
  expect(label).toMatch(labelValue);
  expect(configMap.metadata.name).toMatch(dns1123Subdomain);
  expect(configMap.metadata.name.length).toBeLessThanOrEqual(253);
  expect(configMap.data.name).toBe(name);
});

it('shows a failed creation and keeps the form usable', async () => {
  mocks.saveConfigMap.mockRejectedValueOnce(
    new Error('Unprocessable Entity - ConfigMap "dev-framework-x" is invalid')
  );
  await createFramework('Dev Framework');

  expect(
    await screen.findByText(
      'Failed to save Dev Framework: Unprocessable Entity - ConfigMap "dev-framework-x" is invalid'
    )
  ).toBeTruthy();
  expect(mocks.enqueueSnackbar).not.toHaveBeenCalled();
  expect((screen.getByPlaceholderText('Enter Framework Name') as HTMLInputElement).value).toBe(
    'Dev Framework'
  );

  // a second attempt goes through
  fireEvent.click(await saveButton());
  await waitFor(() =>
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Dev Framework saved successfully', {
      variant: 'success',
    })
  );
  expect(screen.queryByText(/Failed to save/)).toBeNull();
});

it('shows a failed update of an existing framework', async () => {
  mocks.put.mockRejectedValueOnce(new Error('Conflict - the object has been modified'));
  render(
    <MemoryRouter>
      <FrameworkEdit />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByPlaceholderText('Enter Framework Name'), {
    target: { value: 'Dev Framework' },
  });
  fireEvent.click(await saveButton());

  expect(
    await screen.findByText('Failed to save Dev Framework: Conflict - the object has been modified')
  ).toBeTruthy();
  expect(mocks.put).toHaveBeenCalledWith(
    '/api/v1/namespaces/kubescape/configmaps/dev-framework-abc123',
    expect.objectContaining({ data: expect.objectContaining({ name: 'Dev Framework' }) })
  );
  expect(mocks.enqueueSnackbar).not.toHaveBeenCalled();
  expect((screen.getByPlaceholderText('Enter Framework Name') as HTMLInputElement).value).toBe(
    'Dev Framework'
  );
});
