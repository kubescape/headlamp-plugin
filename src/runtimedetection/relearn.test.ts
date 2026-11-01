import { beforeEach, expect, it, vi } from 'vitest';
import type { ContainerProfile } from '../softwarecomposition/ContainerProfile';
import {
  deleteProfiles,
  fetchWorkloadProfiles,
  restartCheck,
  restartImpact,
  restartWorkload,
  workloadOfProfile,
} from './relearn';

const mocks = vi.hoisted(() => ({ patch: vi.fn(), remove: vi.fn(), request: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  patch: mocks.patch,
  remove: mocks.remove,
  request: mocks.request,
}));

const modern = { plural: 'containerprofiles', modern: true } as const;
const legacy = { plural: 'applicationprofiles', modern: false } as const;

function profile(name: string, kind = 'Deployment', workload = 'web'): ContainerProfile {
  return {
    metadata: {
      name,
      namespace: 'shop',
      cluster: 'prd',
      labels: { 'kubescape.io/workload-kind': kind, 'kubescape.io/workload-name': workload },
    },
  };
}

beforeEach(() => {
  mocks.patch.mockReset().mockResolvedValue({});
  mocks.remove.mockReset().mockResolvedValue({});
  mocks.request.mockReset();
});

it('reads the workload of a profile from its labels', () => {
  expect(workloadOfProfile(profile('replicaset-web-6d4cf56db6-web-1a2b-3c4d'))).toEqual({
    kind: 'Deployment',
    name: 'web',
    namespace: 'shop',
    cluster: 'prd',
  });
  expect(workloadOfProfile({ metadata: { name: 'x', namespace: 'shop' } })).toBeUndefined();
});

it('restarts a workload as kubectl rollout restart does, in its cluster', async () => {
  const now = new Date('2026-10-31T19:00:00Z');
  await restartWorkload(
    { kind: 'StatefulSet', name: 'db', namespace: 'shop', cluster: 'prd' },
    now
  );
  expect(mocks.patch).toHaveBeenCalledWith(
    '/apis/apps/v1/namespaces/shop/statefulsets/db',
    {
      spec: {
        template: {
          metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': now.toISOString() } },
        },
      },
    },
    false,
    { cluster: 'prd' }
  );
  await expect(
    restartWorkload({ kind: 'CronJob', name: 'backup', namespace: 'shop' })
  ).rejects.toThrow('cannot be restarted');
  expect(restartCheck({ kind: 'CronJob', name: 'backup', namespace: 'shop' })).toBeNull();
});

it('tells how a restart replaces the pods, and when the workload is down', () => {
  const impact = (kind: string, spec: any, status?: any) => restartImpact(kind, { spec, status });

  expect(impact('Deployment', { replicas: 3 })).toMatchObject({
    severity: 'warning',
    replacesPods: true,
    text: 'Its 3 pods are replaced a few at a time, and connections to the old pods are cut.',
  });
  expect(impact('Deployment', { replicas: 1 }).text).toMatch(/^It has 1 pod\. The new pod starts/);
  expect(impact('Deployment', { replicas: 2, strategy: { type: 'Recreate' } })).toMatchObject({
    severity: 'error',
    text: expect.stringContaining('the workload is down during the restart'),
  });
  expect(impact('StatefulSet', { replicas: 1 })).toMatchObject({
    severity: 'error',
    text: expect.stringContaining('down until the new pod is ready'),
  });
  expect(impact('StatefulSet', { replicas: 3 }).severity).toBe('warning');
  expect(
    impact('StatefulSet', { replicas: 3, updateStrategy: { type: 'OnDelete' } })
  ).toMatchObject({ replacesPods: false, text: expect.stringContaining('OnDelete') });
  expect(impact('Deployment', { replicas: 0 }).replacesPods).toBe(false);
  expect(impact('DaemonSet', {}, { desiredNumberScheduled: 21 }).text).toContain(
    'each of its 21 nodes'
  );
  // the workload could not be read
  expect(restartImpact('Deployment')).toMatchObject({ severity: 'warning', replacesPods: true });
});

it('finds the profiles of all versions of a workload, and no others', async () => {
  mocks.request.mockResolvedValue({
    items: [
      profile('replicaset-web-6d4cf56db6-web-1a2b-3c4d'),
      profile('replicaset-web-5b7d9c8f6-web-5e6f-7a8b'),
      profile('replicaset-api-7c9b8d6f5-api-9c0d-1e2f', 'Deployment', 'api'),
      profile('statefulset-web-66c9df8b-web-c253-a927', 'StatefulSet'),
    ],
  });
  const found = await fetchWorkloadProfiles(
    { kind: 'Deployment', name: 'web', namespace: 'shop', cluster: 'prd' },
    modern
  );
  expect(found.map(p => p.metadata.name)).toEqual([
    'replicaset-web-6d4cf56db6-web-1a2b-3c4d',
    'replicaset-web-5b7d9c8f6-web-5e6f-7a8b',
  ]);
  expect(mocks.request).toHaveBeenCalledWith(
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/shop/containerprofiles',
    { cluster: 'prd' }
  );
});

it('deletes profiles, and both halves of an older profile', async () => {
  await deleteProfiles([profile('a'), profile('b')], modern, 'prd');
  expect(mocks.remove.mock.calls.map(([url]) => url)).toEqual([
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/shop/containerprofiles/a',
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/shop/containerprofiles/b',
  ]);

  mocks.remove.mockReset().mockImplementation(async (url: string) => {
    if (url.includes('/networkneighborhoods/'))
      throw Object.assign(new Error('gone'), { status: 404 });
  });
  await deleteProfiles([profile('a')], legacy);
  expect(mocks.remove.mock.calls.map(([url]) => url.split('/').slice(-2).join('/'))).toEqual([
    'applicationprofiles/a',
    'networkneighborhoods/a',
  ]);

  mocks.remove.mockReset().mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }));
  await expect(deleteProfiles([profile('a')], modern)).rejects.toThrow('denied');
});
