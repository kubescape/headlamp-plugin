import { vi } from 'vitest';
import type { ContainerProfile } from '../softwarecomposition/ContainerProfile';
import type { AlertmanagerAlert } from './alertmanager';
import {
  compareDomain,
  fetchLearnedDomains,
  findAlertProfile,
  matchAlertProfile,
  parseInstanceId,
  podVersionNames,
  registeredDomain,
  versionNamesFromPodName,
} from './alertProfile';

const mocks = vi.hoisted(() => ({ request: vi.fn(), discoverProfileResource: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../softwarecomposition/profileApi', () => ({
  discoverProfileResource: mocks.discoverProfileResource,
}));

// profiles as the storage lists them
function profile(
  name: string,
  instanceId: string,
  labels: Record<string, string>,
  creationTimestamp = '2026-10-01T00:00:00Z'
): ContainerProfile {
  return {
    metadata: {
      name,
      namespace: 'external-secrets-operator',
      creationTimestamp,
      labels,
      annotations: { 'kubescape.io/instance-id': instanceId },
    },
  };
}

const current = profile(
  'replicaset-external-secrets-operator-98c858fb8-external-secrets-2eb9-a45d',
  'apiVersion-apps/v1/namespace-external-secrets-operator/kind-ReplicaSet/name-external-secrets-operator-98c858fb8/containerName-external-secrets',
  {
    'kubescape.io/workload-kind': 'Deployment',
    'kubescape.io/workload-name': 'external-secrets-operator',
    'kubescape.io/workload-container-name': 'external-secrets',
  }
);
const previous = profile(
  'replicaset-external-secrets-operator-7c4f8d9b6-external-secrets-11aa-22bb',
  'apiVersion-apps/v1/namespace-external-secrets-operator/kind-ReplicaSet/name-external-secrets-operator-7c4f8d9b6/containerName-external-secrets',
  {
    'kubescape.io/workload-kind': 'Deployment',
    'kubescape.io/workload-name': 'external-secrets-operator',
    'kubescape.io/workload-container-name': 'external-secrets',
  },
  '2026-09-01T00:00:00Z'
);
const webhook = profile(
  'replicaset-external-secrets-operator-webhook-7f456f97bf-webhook-2197-b05f',
  'apiVersion-apps/v1/namespace-external-secrets-operator/kind-ReplicaSet/name-external-secrets-operator-webhook-7f456f97bf/containerName-webhook',
  {
    'kubescape.io/workload-kind': 'Deployment',
    'kubescape.io/workload-name': 'external-secrets-operator-webhook',
    'kubescape.io/workload-container-name': 'webhook',
  }
);

const pod = 'external-secrets-operator-98c858fb8-7rxcb';
const alert: AlertmanagerAlert = {
  labels: {
    namespace: 'external-secrets-operator',
    pod_name: pod,
    container_name: 'external-secrets',
  },
  annotations: {},
  startsAt: '2026-11-01T13:21:15Z',
  endsAt: '2026-11-01T14:21:15Z',
  status: { state: 'active' },
  fingerprint: 'f',
  cluster: 'cluster-a',
};

describe('parseInstanceId', () => {
  it('reads the kind, version and container of a profile', () => {
    expect(
      parseInstanceId(
        'apiVersion-apps/v1/namespace-shop/kind-StatefulSet/name-db-6f5d8c7b9/containerName-postgres'
      )
    ).toEqual({ kind: 'StatefulSet', name: 'db-6f5d8c7b9', container: 'postgres' });
    expect(
      parseInstanceId(
        'apiVersion-batch/v1/namespace-shop/kind-Job/name-db-migrate/initContainerName-wait-for-db'
      )
    ).toEqual({ kind: 'Job', name: 'db-migrate', container: 'wait-for-db' });
    expect(parseInstanceId(undefined)).toEqual({});
  });
});

describe('podVersionNames', () => {
  it('names the version of the pod template as profiles do', () => {
    expect(
      podVersionNames({
        metadata: {
          labels: { 'pod-template-hash': '98c858fb8' },
          ownerReferences: [
            { kind: 'ReplicaSet', name: 'external-secrets-operator-98c858fb8', controller: true },
          ],
        },
      })
    ).toEqual(['external-secrets-operator-98c858fb8']);
    // a StatefulSet's revision label carries its name, a DaemonSet's only the hash
    expect(
      podVersionNames({
        metadata: {
          labels: { 'controller-revision-hash': 'db-6f5d8c7b9' },
          ownerReferences: [{ kind: 'StatefulSet', name: 'db', controller: true }],
        },
      })
    ).toContain('db-6f5d8c7b9');
    expect(
      podVersionNames({
        metadata: {
          labels: { 'controller-revision-hash': '59fbb6d8df' },
          ownerReferences: [
            { kind: 'DaemonSet', name: 'secrets-store-csi-driver', controller: true },
          ],
        },
      })
    ).toContain('secrets-store-csi-driver-59fbb6d8df');
  });

  it('reads the ReplicaSet from the name of a pod that is gone', () => {
    expect(versionNamesFromPodName(pod)).toEqual(['external-secrets-operator-98c858fb8']);
    expect(versionNamesFromPodName('db-0')).toEqual([]);
  });
});

describe('matchAlertProfile', () => {
  const target = {
    container: 'external-secrets',
    workload: 'external-secrets-operator',
    versionNames: ['external-secrets-operator-98c858fb8'],
  };

  it('finds the profile of the pod version and container', () => {
    expect(matchAlertProfile([webhook, previous, current], target)).toEqual({
      profile: current,
      ofPodVersion: true,
    });
  });

  it('falls back to the newest profile of the workload container', () => {
    const later = {
      ...previous,
      metadata: { ...previous.metadata, creationTimestamp: '2026-10-15T00:00:00Z' },
    };
    expect(matchAlertProfile([previous, later, webhook], { ...target, versionNames: [] })).toEqual({
      profile: later,
      ofPodVersion: false,
    });
  });

  it('finds nothing for a container without a profile', () => {
    expect(
      matchAlertProfile([current, webhook], { ...target, container: 'sidecar' })
    ).toBeUndefined();
  });
});

describe('findAlertProfile', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.discoverProfileResource.mockReset();
    mocks.discoverProfileResource.mockResolvedValue({ plural: 'containerprofiles', modern: true });
  });

  it('reads the pod and the profiles of its namespace in the alert cluster', async () => {
    mocks.request.mockImplementation(async (url: string) =>
      url.includes('/pods/')
        ? {
            metadata: {
              ownerReferences: [
                {
                  kind: 'ReplicaSet',
                  name: 'external-secrets-operator-98c858fb8',
                  controller: true,
                },
              ],
            },
          }
        : { items: [previous, current, webhook] }
    );
    const found = await findAlertProfile(alert);
    expect(found?.ofPodVersion).toBe(true);
    expect(found?.profile.metadata).toMatchObject({
      name: current.metadata.name,
      cluster: 'cluster-a',
    });
    expect(mocks.discoverProfileResource).toHaveBeenCalledWith('behavior', 'cluster-a');
    expect(mocks.request.mock.calls.map(([url, options]) => [url, options.cluster])).toEqual([
      [
        '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/external-secrets-operator/containerprofiles',
        'cluster-a',
      ],
      [`/api/v1/namespaces/external-secrets-operator/pods/${pod}`, 'cluster-a'],
    ]);
  });

  it('uses the pod name when the pod is gone', async () => {
    mocks.request.mockImplementation(async (url: string) => {
      if (url.includes('/pods/')) throw new Error('pods "x" not found');
      return { items: [previous, current] };
    });
    expect(await findAlertProfile(alert)).toEqual({
      profile: { ...current, metadata: { ...current.metadata, cluster: 'cluster-a' } },
      ofPodVersion: true,
      source: { plural: 'containerprofiles', modern: true },
    });
  });
});

describe('learned domains', () => {
  // the egress a package proxy learned
  const proxyDomains = ['proxy.golang.org', 'pypi.org', 'registry-1.docker.io'];

  it('reads the domains a container learned from the egress of its profile', async () => {
    mocks.request.mockResolvedValue({
      metadata: { name: 'statefulset-proxy-6c9f7d8b5-proxy-4e08-0d80', namespace: 'proxy' },
      spec: {
        egress: [
          { dns: 'pypi.org.' },
          { dnsNames: ['Proxy.Golang.org.', 'pypi.org.'] },
          { dns: 'registry-1.docker.io.' },
          { ipAddress: '10.0.0.1' },
        ],
      },
    });
    const match = {
      profile: {
        metadata: {
          name: 'statefulset-proxy-6c9f7d8b5-proxy-4e08-0d80',
          namespace: 'proxy',
          cluster: 'cluster-a',
        },
      },
      ofPodVersion: true,
      source: { plural: 'containerprofiles' as const, modern: true },
    };
    expect(await fetchLearnedDomains(match, 'proxy')).toEqual(proxyDomains);
    expect(mocks.request).toHaveBeenCalledWith(
      '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/proxy/containerprofiles/statefulset-proxy-6c9f7d8b5-proxy-4e08-0d80',
      { cluster: 'cluster-a', autoLogoutOnAuthError: false }
    );
    // older Storage releases keep the network in a NetworkNeighborhood
    expect(
      await fetchLearnedDomains({
        ...match,
        source: { plural: 'applicationprofiles', modern: false },
      })
    ).toBeUndefined();
  });

  it('compares the domain of an alert with the learned ones', () => {
    expect(compareDomain('golang.org.', proxyDomains)).toEqual({
      learned: false,
      related: ['proxy.golang.org'],
    });
    expect(compareDomain('files.pythonhosted.org', proxyDomains)).toEqual({
      learned: false,
      related: [],
    });
    expect(compareDomain('pypi.org', proxyDomains).learned).toBe(true);
    expect(compareDomain('cdn.example.com', ['*.example.com']).learned).toBe(true);
  });

  it('knows the registered domain of a name', () => {
    expect(registeredDomain('proxy.golang.org.')).toBe('golang.org');
    expect(registeredDomain('www.bbc.co.uk')).toBe('bbc.co.uk');
    expect(registeredDomain('api.example.org')).toBe('example.org');
  });
});
