import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as yaml from 'js-yaml';
import { vi } from 'vitest';
import { InstallPolicyButton } from './InstallPolicyButton';

const mocks = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  post: mocks.post,
  put: mocks.put,
}));
// permission answers are kept per cluster, so each test asks about its own cluster
const cluster = vi.hoisted(() => ({ name: 'cluster-a' }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => cluster.name }));

const notFound = Object.assign(new Error('not found'), { status: 404 });

const policyYaml = yaml.dump({
  apiVersion: 'admissionregistration.k8s.io/v1',
  kind: 'ValidatingAdmissionPolicy',
  metadata: { name: 'kubescape-c-0016' },
  spec: { paramKind: { apiVersion: 'kubescape.io/v1', kind: 'ControlConfiguration' } },
});
const paramsYaml = yaml.dump({
  apiVersion: 'kubescape.io/v1',
  kind: 'ControlConfiguration',
  metadata: { name: 'basic-control-configuration' },
  settings: {},
});

let allowed = true;
let servesParams = true;

beforeEach(() => {
  allowed = true;
  servesParams = true;
  mocks.request.mockReset().mockImplementation(async (url: string) => {
    if (url === '/apis/kubescape.io/v1') {
      return { resources: servesParams ? [{ name: 'controlconfigurations' }] : [] };
    }
    throw notFound;
  });
  mocks.post
    .mockReset()
    .mockImplementation(async (url: string) =>
      url.includes('selfsubjectaccessreviews') ? { status: { allowed } } : {}
    );
});
afterEach(cleanup);

function renderButton() {
  render(
    <InstallPolicyButton
      disabled={false}
      getPolicyYaml={() => policyYaml}
      getParamsYaml={() => paramsYaml}
    />
  );
}

it('installs the policy in warn mode, with its parameters', async () => {
  renderButton();
  fireEvent.click(screen.getByRole('button', { name: 'Install in cluster' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Audit' }));
  const createParams = await screen.findByRole('checkbox', {
    name: /Create the ControlConfiguration basic-control-configuration/,
  });
  expect(createParams).toHaveProperty('checked', true);

  fireEvent.click(screen.getByRole('button', { name: 'Install' }));

  expect(
    await screen.findByText(
      'Installed kubescape-c-0016 with binding kubescape-c-0016-binding (Warn). Requests that violate it are allowed and get a warning.'
    )
  ).toBeTruthy();
  const created = mocks.post.mock.calls
    .filter(([url]) => !url.includes('selfsubjectaccessreviews'))
    .map(([url, object]) => [url, object.spec?.validationActions]);
  expect(created).toEqual([
    ['/apis/kubescape.io/v1/controlconfigurations', undefined],
    ['/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicies', undefined],
    ['/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicybindings', ['Warn']],
  ]);
});

it('explains that a policy with parameters needs the ControlConfiguration CRD', async () => {
  servesParams = false;
  renderButton();
  fireEvent.click(screen.getByRole('button', { name: 'Install in cluster' }));

  expect(await screen.findByText(/which this cluster does not serve/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Install' })).toHaveProperty('disabled', true);
});

it('is not offered without permission to create policies', async () => {
  cluster.name = 'cluster-without-permission';
  allowed = false;
  renderButton();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Install in cluster' })).toHaveProperty(
      'disabled',
      true
    )
  );
});
