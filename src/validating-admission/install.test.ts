import { vi } from 'vitest';
import { fetchResource, listResources } from './clusterResources';
import {
  bindingFor,
  BindingNotInstalledError,
  checkPolicy,
  installPolicy,
  installProblem,
  paramsCreationProblem,
  paramsState,
  PolicyObject,
} from './install';

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

const bindings = '/apis/admissionregistration.k8s.io/v1/validatingadmissionpolicybindings';
const managed = { 'app.kubernetes.io/managed-by': 'headlamp-kubescape-plugin' };
const ownBinding = (validationActions: string[]) => ({
  metadata: { name: 'kubescape-c-0016-allow-privilege-escalation-binding', labels: managed },
  spec: { policyName: 'kubescape-c-0016-allow-privilege-escalation', validationActions },
});

// the bindings in the cluster; other objects are installed with resource version 7
function serveBindings(items: any[]) {
  mocks.request.mockImplementation(async (url: string) =>
    url === bindings ? { items } : { metadata: { resourceVersion: '7' } }
  );
}

it('replaces an installed policy and binding', async () => {
  serveBindings([ownBinding(['Warn'])]);

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

it('does not install a policy that a binding denies with', async () => {
  // also when the policy is not installed: the binding would enforce it once it is
  mocks.request.mockImplementation(async (url: string) => {
    if (url !== bindings) throw notFound;
    return {
      items: [
        {
          metadata: { name: 'enforce-c-0016' },
          spec: {
            policyName: 'kubescape-c-0016-allow-privilege-escalation',
            validationActions: ['Deny', 'Audit'],
          },
        },
        {
          metadata: { name: 'enforce-other' },
          spec: { policyName: 'other', validationActions: ['Deny'] },
        },
      ],
    };
  });
  const params = { apiVersion: 'kubescape.io/v1', kind: 'ControlConfiguration', metadata: {} };

  await expect(installPolicy(policy, bindingFor(policy, ['Warn']), params)).rejects.toThrow(
    'The binding enforce-c-0016 rejects requests that violate kubescape-c-0016-allow-privilege-escalation'
  );
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();

  // nor when its own binding was switched to Deny with kubectl
  serveBindings([ownBinding(['Deny'])]);
  expect(await installProblem(policy)).toMatch(
    /^The binding kubescape-c-0016-allow-privilege-escalation-binding rejects/
  );
  serveBindings([ownBinding(['Warn', 'Audit'])]);
  expect(await installProblem(policy)).toBeNull();
});

it('does not replace a binding with its name that the plugin did not install', async () => {
  serveBindings([{ ...ownBinding(['Warn']), metadata: { name: ownBinding([]).metadata.name } }]);
  await expect(installPolicy(policy, bindingFor(policy, ['Warn']), null)).rejects.toThrow(
    /was not installed for this policy by the plugin/
  );

  // or that binds another policy
  serveBindings([
    { ...ownBinding(['Warn']), spec: { policyName: 'other', validationActions: ['Warn'] } },
  ]);
  expect(await installProblem(policy)).toMatch(/was not installed for this policy/);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
});

it('does not create parameters that a binding denies with', async () => {
  // the library policies share the parameters; this one allows everything while they are missing
  const libraryBinding = {
    metadata: { name: 'kubescape-library-deny' },
    spec: {
      policyName: 'kubescape-c-0017-immutable-container-filesystem',
      validationActions: ['Deny'],
      paramRef: { name: 'basic-control-configuration', parameterNotFoundAction: 'Allow' },
    },
  };
  serveBindings([libraryBinding]);
  const params = { apiVersion: 'kubescape.io/v1', kind: 'ControlConfiguration', metadata: {} };

  expect(await paramsCreationProblem(policy)).toBe(
    'The binding kubescape-library-deny rejects requests and may read the parameters ' +
      'basic-control-configuration, so creating them here could change what it enforces. ' +
      'Create them with kubectl when that is intended.'
  );
  await expect(installPolicy(policy, bindingFor(policy, ['Warn']), params)).rejects.toThrow(
    /^The binding kubescape-library-deny rejects requests and may read the parameters/
  );
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();

  // the policy can still be installed without them
  expect(await installProblem(policy)).toBeNull();
  await installPolicy(policy, bindingFor(policy, ['Warn']), null);
  expect(mocks.put).toHaveBeenCalledTimes(2);

  // a binding that selects its parameters may read them too, one that warns does not count
  serveBindings([
    {
      metadata: { name: 'select-params' },
      spec: { policyName: 'other', validationActions: ['Deny'], paramRef: { selector: {} } },
    },
    { ...libraryBinding, spec: { ...libraryBinding.spec, validationActions: ['Warn'] } },
  ]);
  expect(await paramsCreationProblem(policy)).toMatch(/^The binding select-params rejects/);
  serveBindings([ownBinding(['Warn'])]);
  expect(await paramsCreationProblem(policy)).toBeNull();
});

it('installs nothing when it cannot read the bindings', async () => {
  mocks.request.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));
  await expect(installPolicy(policy, bindingFor(policy, ['Warn']), null)).rejects.toThrow(
    'forbidden'
  );
  expect(mocks.post).not.toHaveBeenCalled();
});

it('says that the policy was installed when its binding fails', async () => {
  mocks.request.mockRejectedValue(notFound);
  mocks.post.mockImplementation(async (url: string) => {
    if (url === bindings) throw new Error('admission webhook denied the request');
    return {};
  });

  const installing = installPolicy(policy, bindingFor(policy, ['Warn']), null);
  await expect(installing).rejects.toBeInstanceOf(BindingNotInstalledError);
  await expect(installing).rejects.toThrow(
    'Installed kubescape-c-0016-allow-privilege-escalation, but not its binding ' +
      'kubescape-c-0016-allow-privilege-escalation-binding: admission webhook denied the request'
  );
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
