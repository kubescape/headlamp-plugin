import { vi } from 'vitest';
import { fetchResource, listResources } from './clusterResources';
import { bindingFor, checkPolicy, installPolicy, paramsState, PolicyObject } from './install';

const mocks = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  post: mocks.post,
  put: mocks.put,
}));

const notFound = Object.assign(new Error('not found'), { status: 404 });

const policy: PolicyObject = {
  apiVersion: 'admissionregistration.k8s.io/v1',
  kind: 'ValidatingAdmissionPolicy',
  metadata: { name: 'kubescape-c-0016-allow-privilege-escalation' },
  spec: { paramKind: { apiVersion: 'kubescape.io/v1', kind: 'ControlConfiguration' } },
};

beforeEach(() => {
  mocks.request.mockReset();
  mocks.post.mockReset().mockResolvedValue({});
  mocks.put.mockReset().mockResolvedValue({});
});

it('binds a policy only to warn or audit', () => {
  const binding = bindingFor(policy, ['Warn', 'Deny' as any, 'Audit'], 'shop');
  expect(binding).toEqual({
    apiVersion: 'admissionregistration.k8s.io/v1',
    kind: 'ValidatingAdmissionPolicyBinding',
    metadata: {
      name: 'kubescape-c-0016-allow-privilege-escalation-binding',
      labels: { 'app.kubernetes.io/managed-by': 'headlamp-kubescape-plugin' },
    },
    spec: {
      policyName: 'kubescape-c-0016-allow-privilege-escalation',
      validationActions: ['Warn', 'Audit'],
      paramRef: { name: 'basic-control-configuration', parameterNotFoundAction: 'Deny' },
      matchResources: {
        namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'shop' } },
      },
    },
  });
  const withoutParams = bindingFor({ ...policy, spec: {} }, ['Warn']);
  expect(withoutParams.spec).toEqual({
    policyName: 'kubescape-c-0016-allow-privilege-escalation',
    validationActions: ['Warn'],
  });
});

it('only installs ValidatingAdmissionPolicies', () => {
  expect(checkPolicy(policy)).toBeNull();
  expect(checkPolicy({ ...policy, kind: 'Deployment' })).toMatch(/does not hold/);
  expect(checkPolicy({ ...policy, apiVersion: 'v1' })).toMatch(/cannot be installed/);
  expect(checkPolicy(null)).toMatch(/does not hold/);
});

it('tells whether the cluster has the parameters of a policy', async () => {
  mocks.request.mockImplementation(async (url: string) => {
    if (url === '/apis/kubescape.io/v1') {
      return { resources: [{ name: 'controlconfigurations', namespaced: false }] };
    }
    throw notFound;
  });
  expect(await paramsState(policy)).toBe('missing');
  expect(await paramsState({ ...policy, spec: {} })).toBe('unneeded');

  mocks.request.mockResolvedValue({ resources: [{ name: 'controlconfigurations' }] });
  expect(await paramsState(policy)).toBe('present');

  mocks.request.mockResolvedValue({ resources: [{ name: 'runtimerules' }] });
  expect(await paramsState(policy)).toBe('not-served');

  mocks.request.mockResolvedValue({
    resources: [{ name: 'controlconfigurations', namespaced: true }],
  });
  expect(await paramsState(policy)).toBe('namespaced');
});

it('creates the parameters, the policy and the binding', async () => {
  mocks.request.mockRejectedValue(notFound);
  const binding = bindingFor(policy, ['Warn']);

  await installPolicy(
    { ...policy, metadata: { ...policy.metadata, uid: 'x', resourceVersion: '1' } },
    binding,
    { apiVersion: 'kubescape.io/v1', kind: 'ControlConfiguration', metadata: { name: 'other' } }
  );

  expect(mocks.post.mock.calls.map(call => [call[0], call[1].metadata])).toEqual([
    ['/apis/kubescape.io/v1/controlconfigurations', { name: 'basic-control-configuration' }],
    [
      '/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicies',
      {
        name: 'kubescape-c-0016-allow-privilege-escalation',
        labels: { 'app.kubernetes.io/managed-by': 'headlamp-kubescape-plugin' },
      },
    ],
    ['/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicybindings', binding.metadata],
  ]);
  expect(mocks.put).not.toHaveBeenCalled();
});

it('replaces an installed policy and binding', async () => {
  mocks.request.mockResolvedValue({ metadata: { resourceVersion: '7' } });

  await installPolicy(policy, bindingFor(policy, ['Audit']), null);

  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.put.mock.calls.map(call => [call[0], call[1].metadata.resourceVersion])).toEqual([
    [
      '/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicies/kubescape-c-0016-allow-privilege-escalation',
      '7',
    ],
    [
      '/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicybindings/kubescape-c-0016-allow-privilege-escalation-binding',
      '7',
    ],
  ]);
});

it('lists cluster resources in the allowed namespaces', async () => {
  mocks.request.mockImplementation(async (url: string) => ({
    items: [{ metadata: { name: 'web', namespace: url.split('/')[5] } }],
  }));

  expect(await listResources('Deployment', ['shop', 'blog'])).toEqual([
    { namespace: 'blog', name: 'web' },
    { namespace: 'shop', name: 'web' },
  ]);
  expect(mocks.request.mock.calls.map(call => call[0])).toEqual([
    '/apis/apps/v1/namespaces/shop/deployments',
    '/apis/apps/v1/namespaces/blog/deployments',
  ]);

  mocks.request.mockClear();
  await listResources('ClusterRole', ['shop']);
  expect(mocks.request.mock.calls[0][0]).toBe('/apis/rbac.authorization.k8s.io/v1/clusterroles');
});

it('reads a resource with its kind, which lists leave out', async () => {
  mocks.request.mockResolvedValue({ metadata: { name: 'web', namespace: 'shop' } });

  expect(await fetchResource('Pod', { namespace: 'shop', name: 'web' })).toEqual({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'web', namespace: 'shop' },
  });
  expect(mocks.request).toHaveBeenCalledWith('/api/v1/namespaces/shop/pods/web');
});
