import * as yaml from 'js-yaml';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ContainerProfile } from '../softwarecomposition/ContainerProfile';
import {
  containerProfileToMockYAML,
  getContainerProfile,
  listContainerProfileNames,
  listSelectableNamespaces,
} from './profileLoader';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

beforeEach(() => {
  request.mockReset();
});

it('uses configured Headlamp namespaces without requiring a cluster-wide namespace list', async () => {
  await expect(listSelectableNamespaces(['team-b', 'team-a', 'team-a'])).resolves.toEqual([
    'team-a',
    'team-b',
  ]);
  expect(request).not.toHaveBeenCalled();
});

it('lists namespaces when Headlamp has no configured restriction', async () => {
  request.mockResolvedValueOnce({
    items: [{ metadata: { name: 'team-b' } }, { metadata: { name: 'team-a' } }],
  });

  await expect(listSelectableNamespaces([])).resolves.toEqual(['team-a', 'team-b']);
  expect(request).toHaveBeenCalledWith('/api/v1/namespaces');
});

it('loads every namespaced ContainerProfile list page before returning names', async () => {
  request
    .mockResolvedValueOnce({
      items: [{ metadata: { name: 'web' } }],
      metadata: { continue: 'next+page' },
    })
    .mockResolvedValueOnce({
      items: [{ metadata: { name: 'api' } }, { metadata: { name: 'web' } }],
      metadata: { continue: '' },
    });

  await expect(listContainerProfileNames('team space')).resolves.toEqual(['api', 'web']);
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team%20space/containerprofiles?limit=200',
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team%20space/containerprofiles?limit=200&continue=next%2Bpage',
  ]);
});

it('does not present a partial list after a later page fails', async () => {
  request
    .mockResolvedValueOnce({ items: [{ metadata: { name: 'web' } }], metadata: { continue: '2' } })
    .mockRejectedValueOnce(new Error('Storage unavailable'));

  await expect(listContainerProfileNames('default')).rejects.toThrow('Storage unavailable');
});

it('rejects repeated continuation tokens instead of looping forever', async () => {
  request.mockResolvedValue({ items: [], metadata: { continue: '2' } });

  await expect(listContainerProfileNames('default')).rejects.toThrow('repeated');
  expect(request).toHaveBeenCalledTimes(2);
});

it('gets the selected ContainerProfile by its namespaced API path', async () => {
  const profile = { metadata: { name: 'web' }, spec: {} };
  request.mockResolvedValue(profile);

  await expect(getContainerProfile('team', 'web')).resolves.toBe(profile);
  expect(request).toHaveBeenCalledWith(
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team/containerprofiles/web'
  );
});

it('uses discovered legacy ApplicationProfile and NetworkNeighborhood paths', async () => {
  request.mockResolvedValue({ items: [{ metadata: { name: 'web' } }], metadata: {} });

  await expect(
    listContainerProfileNames('team', { plural: 'applicationprofiles', modern: false })
  ).resolves.toEqual(['web']);
  await expect(
    listContainerProfileNames('team', { plural: 'networkneighborhoods', modern: false })
  ).resolves.toEqual(['web']);
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team/applicationprofiles?limit=200',
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team/networkneighborhoods?limit=200',
  ]);

  await getContainerProfile('team', 'web', { plural: 'networkneighborhoods', modern: false });
  expect(request).toHaveBeenLastCalledWith(
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/team/networkneighborhoods/web'
  );
});

it('propagates a missing ContainerProfile instead of converting it to an empty baseline', async () => {
  request.mockRejectedValueOnce(new Error('404 Not Found'));

  await expect(getContainerProfile('team', 'missing')).rejects.toThrow('404 Not Found');
});

it('converts learned top-level behavior and modern network lists for the Go rule evaluator', () => {
  const profile = {
    metadata: {
      name: 'deployment-web-abc',
      namespace: 'default',
      labels: { 'kubescape.io/workload-container-name': 'web' },
    },
    spec: {
      execs: [{ path: '/bin/sh', args: ['-c'] }],
      opens: [{ path: '/etc/config', flags: ['O_RDONLY'] }],
      syscalls: ['read'],
      capabilities: ['NET_ADMIN'],
      egress: [{ ipAddresses: ['10.0.0.1', '10.0.0.2'], dnsNames: ['example.test'] }],
      ingress: [{ dnsNames: ['internal.test'] }],
    },
  } as ContainerProfile;

  expect(yaml.load(containerProfileToMockYAML(profile, 'application'))).toEqual({
    containers: {
      web: {
        execs: [{ path: '/bin/sh', args: ['-c'] }],
        opens: [{ path: '/etc/config', flags: ['O_RDONLY'] }],
        syscalls: ['read'],
        capabilities: ['NET_ADMIN'],
      },
    },
  });
  expect(yaml.load(containerProfileToMockYAML(profile, 'network'))).toEqual({
    containers: {
      web: {
        egress: [
          { ipAddress: '10.0.0.1', dns: ['example.test'] },
          { ipAddress: '10.0.0.2', dns: ['example.test'] },
        ],
        ingress: [{ ipAddress: '', dns: ['internal.test'] }],
      },
    },
  });
});

it('converts authored normal, init, and ephemeral containers and legacy network fields', () => {
  const profile = {
    metadata: { name: 'pod-profile', namespace: 'default' },
    spec: {
      containers: [
        {
          name: 'app',
          execs: [{ path: '/app' }],
          egress: [{ ipAddress: '1.2.3.4', dns: 'legacy.test' }],
        },
      ],
      initContainers: [{ name: 'setup', opens: [{ path: '/init', flags: [] }] }],
      ephemeralContainers: [{ name: 'debug', syscalls: ['ptrace'] }],
    },
  } as ContainerProfile;

  const behavior = yaml.load(containerProfileToMockYAML(profile, 'application')) as any;
  const network = yaml.load(containerProfileToMockYAML(profile, 'network')) as any;
  expect(Object.keys(behavior.containers)).toEqual(['app', 'setup', 'debug']);
  expect(behavior.containers.app.execs).toEqual([{ path: '/app', args: [] }]);
  expect(behavior.containers.setup.opens).toEqual([{ path: '/init', flags: [] }]);
  expect(behavior.containers.debug.syscalls).toEqual(['ptrace']);
  expect(network.containers.app.egress).toEqual([{ ipAddress: '1.2.3.4', dns: ['legacy.test'] }]);
});

it('converts legacy grouped profile APIs to the same rule mock shape', () => {
  const applicationProfile = {
    kind: 'ApplicationProfile',
    metadata: { name: 'web', namespace: 'team' },
    spec: {
      containers: [{ name: 'app', execs: [{ path: '/usr/bin/app' }] }],
      initContainers: [{ name: 'prepare', syscalls: ['open'] }],
    },
  } as ContainerProfile;
  const networkNeighborhood = {
    kind: 'NetworkNeighborhood',
    metadata: { name: 'web', namespace: 'team' },
    spec: {
      containers: [
        {
          name: 'app',
          egress: [{ ipAddress: '1.2.3.4', dns: 'legacy.example' }],
          ingress: [{ dnsNames: ['internal.example'] }],
        },
      ],
    },
  } as ContainerProfile;

  const behavior = yaml.load(containerProfileToMockYAML(applicationProfile, 'application')) as any;
  const network = yaml.load(containerProfileToMockYAML(networkNeighborhood, 'network')) as any;
  expect(behavior.containers.app.execs).toEqual([{ path: '/usr/bin/app', args: [] }]);
  expect(behavior.containers.prepare.syscalls).toEqual(['open']);
  expect(network.containers.app.egress).toEqual([
    { ipAddress: '1.2.3.4', dns: ['legacy.example'] },
  ]);
  expect(network.containers.app.ingress).toEqual([{ ipAddress: '', dns: ['internal.example'] }]);
});
