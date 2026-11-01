import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AccessCheck, canI, deniedMessage, Permitted } from './permissions';

const post = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ post }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'current' }));

const createCommand: AccessCheck = {
  group: 'kubescape.io',
  resource: 'operatorcommands',
  verb: 'create',
  namespace: 'kubescape',
};

beforeEach(() => post.mockReset());

it('asks the API server once per check and cluster', async () => {
  post.mockResolvedValue({ status: { allowed: true } });

  expect(await canI(createCommand, 'cluster-a')).toBe(true);
  expect(await canI(createCommand, 'cluster-a')).toBe(true);

  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews',
    {
      apiVersion: 'authorization.k8s.io/v1',
      kind: 'SelfSubjectAccessReview',
      spec: { resourceAttributes: createCommand },
    },
    false,
    { cluster: 'cluster-a' }
  );
});

it('does not know the answer when the cluster does not tell, and asks again later', async () => {
  post.mockRejectedValueOnce(new Error('forbidden'));
  expect(await canI(createCommand, 'cluster-b')).toBeUndefined();

  post.mockResolvedValueOnce({ status: { allowed: false } });
  expect(await canI(createCommand, 'cluster-b')).toBe(false);
});

it('explains the missing permission', () => {
  expect(deniedMessage(createCommand)).toBe(
    'You are not allowed to create operatorcommands in namespace kubescape.'
  );
  expect(
    deniedMessage({
      group: '',
      resource: 'services',
      subresource: 'proxy',
      verb: 'create',
      namespace: 'monitoring',
      name: 'alertmanager',
    })
  ).toBe('You are not allowed to create services/proxy alertmanager in namespace monitoring.');
});

it('disables an action the user may not do, and leaves unknown ones enabled', async () => {
  post.mockResolvedValueOnce({ status: { allowed: false } });
  render(
    <Permitted check={{ ...createCommand, namespace: 'denied' }}>
      {allowed => <button disabled={!allowed}>Scan</button>}
    </Permitted>
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Scan' })).toHaveProperty('disabled', true)
  );
  expect(screen.getByLabelText(/not allowed to create operatorcommands/)).toBeTruthy();

  post.mockRejectedValueOnce(new Error('no SelfSubjectAccessReview'));
  render(
    <Permitted check={{ ...createCommand, namespace: 'unknown' }}>
      {allowed => <button disabled={!allowed}>Delete</button>}
    </Permitted>
  );
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', false);
});
