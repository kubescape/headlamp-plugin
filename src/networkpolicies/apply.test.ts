import { vi } from 'vitest';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { applyNetworkPolicy, getExistingNetworkPolicy, toNetworkPolicy } from './apply';

const api = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => api);

const generated = {
  metadata: {
    name: 'deployment-web',
    namespace: 'shop',
    cluster: 'cluster-a',
    creationTimestamp: '2026-10-01T00:00:00Z',
    resourceVersion: '7',
    labels: { 'kubescape.io/workload-name': 'web' },
    annotations: {},
  },
  spec: {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: 'web',
      namespace: 'shop',
      annotations: { 'generated-by': 'kubescape' },
    },
    spec: { podSelector: { matchLabels: { app: 'web' } }, policyTypes: ['Ingress'] },
  },
  policyRef: [],
} as unknown as GeneratedNetworkPolicy;

const policyPath = '/apis/networking.k8s.io/v1/namespaces/shop/networkpolicies';

beforeEach(() => {
  api.request.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

it('turns the generated policy into a NetworkPolicy without storage metadata', () => {
  expect(toNetworkPolicy(generated)).toEqual({
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'web', namespace: 'shop', annotations: { 'generated-by': 'kubescape' } },
    spec: generated.spec.spec,
  });
});

it('creates the policy when none with its name exists', async () => {
  api.request.mockRejectedValue({ status: 404 });
  const policy = toNetworkPolicy(generated);

  const existing = await getExistingNetworkPolicy(policy);
  await applyNetworkPolicy(policy, existing);

  expect(api.request).toHaveBeenCalledWith(`${policyPath}/web`);
  expect(api.post).toHaveBeenCalledWith(policyPath, policy);
  expect(api.put).not.toHaveBeenCalled();
});

it('replaces an existing policy using its resource version', async () => {
  const policy = toNetworkPolicy(generated);
  api.request.mockResolvedValue({
    ...policy,
    metadata: { ...policy.metadata, resourceVersion: '42' },
  });

  await applyNetworkPolicy(policy, await getExistingNetworkPolicy(policy));

  expect(api.put).toHaveBeenCalledWith(`${policyPath}/web`, {
    ...policy,
    metadata: { ...policy.metadata, resourceVersion: '42' },
  });
  expect(api.post).not.toHaveBeenCalled();
});

it('does not hide other errors while looking for an existing policy', async () => {
  api.request.mockRejectedValue({ status: 403, message: 'forbidden' });
  await expect(getExistingNetworkPolicy(toNetworkPolicy(generated))).rejects.toEqual({
    status: 403,
    message: 'forbidden',
  });
});
