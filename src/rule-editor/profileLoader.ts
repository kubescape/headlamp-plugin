import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import * as yaml from 'js-yaml';
import type {
  ContainerProfile,
  ContainerProfileContainer,
} from '../softwarecomposition/ContainerProfile';
import { getProfileContainers } from '../softwarecomposition/ContainerProfile';
import type { ProfileResource } from '../softwarecomposition/profileApi';

const resourcePath = '/apis/spdx.softwarecomposition.kubescape.io/v1beta1';
const pageSize = 200;
export type ProfileSource = ProfileResource;
const modernSource: ProfileSource = { plural: 'containerprofiles', modern: true };

function namespacePath(namespace: string, source: ProfileSource): string {
  return `${resourcePath}/namespaces/${encodeURIComponent(namespace)}/${source.plural}`;
}

/** Honor Headlamp's namespace selection for users who cannot list namespaces cluster-wide. */
export async function listSelectableNamespaces(allowed: string[]): Promise<string[]> {
  if (allowed.length > 0) return [...new Set(allowed)].sort();

  const list = await request('/api/v1/namespaces');
  if (!Array.isArray(list?.items)) throw new Error('Kubernetes returned an invalid namespace list');
  return list.items
    .map((item: any) => item?.metadata?.name)
    .filter((name: unknown): name is string => typeof name === 'string')
    .sort();
}

/** Fetch every page before presenting a namespace's profiles as a complete list. */
export async function listContainerProfileNames(
  namespace: string,
  source: ProfileSource = modernSource
): Promise<string[]> {
  const names = new Set<string>();
  const seenTokens = new Set<string>();
  let continuation = '';

  do {
    const token = continuation ? `&continue=${encodeURIComponent(continuation)}` : '';
    const list = await request(`${namespacePath(namespace, source)}?limit=${pageSize}${token}`);
    if (!Array.isArray(list?.items)) {
      throw new Error(`Storage returned an invalid ${source.plural} list`);
    }
    for (const item of list.items) {
      if (typeof item?.metadata?.name === 'string') names.add(item.metadata.name);
    }

    continuation = list.metadata?.continue || '';
    if (continuation && seenTokens.has(continuation)) {
      throw new Error('Storage repeated a ContainerProfile continuation token');
    }
    if (continuation) seenTokens.add(continuation);
  } while (continuation);

  return [...names].sort();
}

export function getContainerProfile(
  namespace: string,
  name: string,
  source: ProfileSource = modernSource
): Promise<ContainerProfile> {
  return request(`${namespacePath(namespace, source)}/${encodeURIComponent(name)}`);
}

function executionMock(container: ContainerProfileContainer) {
  return {
    execs: (container.execs ?? []).map(exec => ({ path: exec.path, args: exec.args ?? [] })),
    opens: (container.opens ?? []).map(open => ({ path: open.path, flags: open.flags ?? [] })),
    syscalls: container.syscalls ?? [],
    capabilities: container.capabilities ?? [],
  };
}

function networkEntries(neighbors: NonNullable<ContainerProfileContainer['egress']>) {
  return neighbors.flatMap(neighbor => {
    const dns = neighbor.dnsNames?.length ? neighbor.dnsNames : neighbor.dns ? [neighbor.dns] : [];
    const ipAddresses = neighbor.ipAddresses?.length
      ? neighbor.ipAddresses
      : neighbor.ipAddress
      ? [neighbor.ipAddress]
      : [''];
    // The rule playground's Go mock accepts one ipAddress per entry, while
    // ContainerProfile can hold several in a single network neighbor.
    return ipAddresses.map(ipAddress => ({ ipAddress, dns }));
  });
}

function networkMock(container: ContainerProfileContainer) {
  return {
    egress: networkEntries(container.egress ?? []),
    ingress: networkEntries(container.ingress ?? []),
  };
}

export type BaselineKind = 'application' | 'network';

/** Convert either learned top-level or authored nested profiles to the Go rule mock shape. */
export function containerProfileToMockYAML(profile: ContainerProfile, kind: BaselineKind): string {
  const containers: Record<
    string,
    ReturnType<typeof executionMock> | ReturnType<typeof networkMock>
  > = {};
  for (const container of getProfileContainers(profile)) {
    if (container.name) {
      containers[container.name] =
        kind === 'application' ? executionMock(container) : networkMock(container);
    }
  }
  return yaml.dump({ containers });
}
