import { vi } from 'vitest';
import { getCurrentUser } from './currentUser';

const post = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ post }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'current' }));

const review = (username: string) => ({ status: { userInfo: { username } } });

beforeEach(() => post.mockReset());

it('asks the API server who the user is, once per cluster', async () => {
  post.mockResolvedValue(review('alice@example.com'));

  expect(await getCurrentUser('cluster-a')).toBe('alice@example.com');
  expect(await getCurrentUser('cluster-a')).toBe('alice@example.com');

  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    '/apis/authentication.k8s.io/v1/selfsubjectreviews',
    { apiVersion: 'authentication.k8s.io/v1', kind: 'SelfSubjectReview' },
    false,
    { cluster: 'cluster-a' }
  );
});

it('uses the beta API of Kubernetes 1.27', async () => {
  post
    .mockRejectedValueOnce({ status: 404 })
    .mockResolvedValueOnce(review('system:serviceaccount:headlamp:headlamp'));

  expect(await getCurrentUser('cluster-b')).toBe('system:serviceaccount:headlamp:headlamp');
  expect(post.mock.calls[1][0]).toBe('/apis/authentication.k8s.io/v1beta1/selfsubjectreviews');
});

it('asks again later when the cluster does not tell', async () => {
  post.mockRejectedValue({ status: 403 });
  expect(await getCurrentUser('cluster-c')).toBeUndefined();

  post.mockReset().mockResolvedValue(review('bob'));
  expect(await getCurrentUser('cluster-c')).toBe('bob');
});

it('uses the current cluster by default', async () => {
  post.mockResolvedValue(review('dave'));
  expect(await getCurrentUser()).toBe('dave');
  expect(post.mock.calls[0][3]).toEqual({ cluster: 'current' });
});
