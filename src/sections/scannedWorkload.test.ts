import { vi } from 'vitest';
import { findScannedWorkload } from './scannedWorkload';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

const owned = (kind: string, name: string) => ({
  ownerReferences: [
    { kind: 'Unrelated', name: 'not-the-controller' },
    { kind, name, controller: true },
  ],
});

function pod(owner?: ReturnType<typeof owned>) {
  return { metadata: { name: 'pod-1', namespace: 'shop', ...owner } };
}

beforeEach(() => request.mockReset());

it('scans a Deployment pod as its Deployment', async () => {
  request.mockResolvedValue({ metadata: { name: 'web-6d4f', ...owned('Deployment', 'web') } });

  expect(await findScannedWorkload(pod(owned('ReplicaSet', 'web-6d4f')), 'cluster-a')).toEqual({
    kind: 'Deployment',
    name: 'web',
  });
  expect(request).toHaveBeenCalledWith('/apis/apps/v1/namespaces/shop/replicasets/web-6d4f', {
    cluster: 'cluster-a',
  });
});

it('scans a CronJob pod as its CronJob', async () => {
  request.mockResolvedValue({ metadata: { name: 'backup-123', ...owned('CronJob', 'backup') } });

  expect(await findScannedWorkload(pod(owned('Job', 'backup-123')))).toEqual({
    kind: 'CronJob',
    name: 'backup',
  });
  expect(request).toHaveBeenCalledWith('/apis/batch/v1/namespaces/shop/jobs/backup-123', {});
});

it('scans a StatefulSet pod as its StatefulSet without further lookups', async () => {
  expect(await findScannedWorkload(pod(owned('StatefulSet', 'db')))).toEqual({
    kind: 'StatefulSet',
    name: 'db',
  });
  expect(request).not.toHaveBeenCalled();
});

it('scans a pod without a controller as the pod', async () => {
  expect(await findScannedWorkload(pod())).toEqual({ kind: 'Pod', name: 'pod-1' });
});

it('scans a ReplicaSet without a controller, or one it cannot read, as the ReplicaSet', async () => {
  request.mockResolvedValueOnce({ metadata: { name: 'web-6d4f' } });
  expect(await findScannedWorkload(pod(owned('ReplicaSet', 'web-6d4f')))).toEqual({
    kind: 'ReplicaSet',
    name: 'web-6d4f',
  });

  request.mockRejectedValueOnce(new Error('forbidden'));
  expect(await findScannedWorkload(pod(owned('ReplicaSet', 'web-6d4f')))).toEqual({
    kind: 'ReplicaSet',
    name: 'web-6d4f',
  });
});
