/*
  The application profile an alert was checked against. Kubescape keeps a profile per container
  and version of the pod template, and names the version in the profile's instance-id
  annotation: the ReplicaSet of a Deployment, the controller revision of a StatefulSet or
  DaemonSet, or the Job or other owner of the pod.
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { ContainerProfile, getProfileContainers } from '../softwarecomposition/ContainerProfile';
import { discoverProfileResource, ProfileResource } from '../softwarecomposition/profileApi';
import { alertNamespace, alertPod, alertWorkload } from './alertFields';
import type { AlertmanagerAlert } from './alertmanager';

const storagePath = '/apis/spdx.softwarecomposition.kubescape.io/v1beta1';

export interface ProfileInstance {
  kind?: string;
  // the version of the pod template, such as the name of a ReplicaSet
  name?: string;
  container?: string;
}

const instanceKeys =
  'apiVersion|namespace|kind|name|containerName|initContainerName|ephemeralContainerName';
const instancePart = new RegExp(`(?:^|/)(${instanceKeys})-(.+?)(?=/(?:${instanceKeys})-|$)`, 'g');

/**
 * The parts of an instance-id, such as
 * apiVersion-apps/v1/namespace-web/kind-ReplicaSet/name-web-98c858fb8/containerName-app.
 */
export function parseInstanceId(id: string | undefined): ProfileInstance {
  const parts: Record<string, string> = {};
  for (const [, key, value] of (id ?? '').matchAll(instancePart)) parts[key] = value;
  return {
    kind: parts.kind,
    name: parts.name,
    container: parts.containerName ?? parts.initContainerName ?? parts.ephemeralContainerName,
  };
}

export function profileInstance(profile: ContainerProfile): ProfileInstance {
  const instance = parseInstanceId(profile.metadata.annotations?.['kubescape.io/instance-id']);
  return {
    ...instance,
    container:
      instance.container ?? profile.metadata.labels?.['kubescape.io/workload-container-name'],
  };
}

export interface PodVersion {
  metadata: {
    labels?: Record<string, string>;
    ownerReferences?: Array<{ kind: string; name: string; controller?: boolean }>;
  };
}

/**
 * The names a profile's instance-id can give the version of a pod's template: the owner of the
 * pod (a ReplicaSet, a Job, a CloudNativePG Cluster), the controller revision of a StatefulSet
 * (its label is the StatefulSet's name and the hash), or that of a DaemonSet (only the hash).
 */
export function podVersionNames(pod: PodVersion): string[] {
  const owners = pod.metadata.ownerReferences ?? [];
  const owner = owners.find(reference => reference.controller) ?? owners[0];
  const revision = pod.metadata.labels?.['controller-revision-hash'];
  return [
    ...(owner ? [owner.name] : []),
    ...(revision ? [revision, ...(owner ? [`${owner.name}-${revision}`] : [])] : []),
  ];
}

// the random suffix of a generated name: no vowels, and no 0, 1 or 3
const suffix = '[bcdfghjklmnpqrstvwxz2456789]';
const replicaSetPod = new RegExp(`^(.+-${suffix}{6,10})-${suffix}{5}$`);

/** The ReplicaSet of a pod of a Deployment, read from the pod's name when the pod is gone. */
export function versionNamesFromPodName(pod: string): string[] {
  const match = replicaSetPod.exec(pod);
  return match ? [match[1]] : [];
}

export interface AlertProfileMatch {
  profile: ContainerProfile;
  // true when the profile is of the pod's own version of the template, false when it is the
  // newest profile of the workload's container
  ofPodVersion: boolean;
  // the resource the profile was read from
  source?: ProfileResource;
}

/** The profile of the alert's container among the profiles of its namespace. */
export function matchAlertProfile(
  profiles: ContainerProfile[],
  target: { container?: string; workload?: string; versionNames: string[] }
): AlertProfileMatch | undefined {
  // older Storage releases keep the containers of a version in one profile, without a container
  const ofContainer = profiles.filter(profile => {
    const container = profileInstance(profile).container;
    return !target.container || !container || container === target.container;
  });
  const ofVersion = ofContainer.find(profile => {
    const name = profileInstance(profile).name;
    return !!name && target.versionNames.includes(name);
  });
  if (ofVersion) return { profile: ofVersion, ofPodVersion: true };
  const newest = ofContainer
    .filter(profile => profile.metadata.labels?.['kubescape.io/workload-name'] === target.workload)
    .sort((a, b) =>
      (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? '')
    )[0];
  return newest ? { profile: newest, ofPodVersion: false } : undefined;
}

/**
 * Finds the profile of the container an alert is about, in the alert's cluster. Reads the pod
 * for the version of its template, and the pod's name when the pod is gone.
 */
export async function findAlertProfile(
  alert: AlertmanagerAlert
): Promise<AlertProfileMatch | undefined> {
  const namespace = alertNamespace(alert);
  if (!namespace) return undefined;
  const pod = alertPod(alert);
  const cluster = alert.cluster || undefined;
  const options = { ...(cluster ? { cluster } : {}), autoLogoutOnAuthError: false };
  const source = await discoverProfileResource('behavior', cluster);
  const [list, podObject] = await Promise.all([
    request(`${storagePath}/namespaces/${namespace}/${source.plural}`, options),
    pod ? request(`/api/v1/namespaces/${namespace}/pods/${pod}`, options).catch(() => null) : null,
  ]);
  const match = matchAlertProfile((list?.items ?? []) as ContainerProfile[], {
    container: alert.labels.container_name ?? alert.labels.container,
    workload: alertWorkload(alert),
    versionNames: podObject?.metadata
      ? podVersionNames(podObject)
      : pod
      ? versionNamesFromPodName(pod)
      : [],
  });
  return (
    match && {
      ...match,
      profile: { ...match.profile, metadata: { ...match.profile.metadata, cluster } },
      source,
    }
  );
}

function withoutDot(name: string) {
  return name.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * The domains a profile learned the container to look up, read from its egress. Undefined for
 * older Storage releases, which keep the network in a separate NetworkNeighborhood.
 */
export async function fetchLearnedDomains(
  match: AlertProfileMatch,
  container?: string
): Promise<string[] | undefined> {
  if (!match.source?.modern) return undefined;
  const { name, namespace, cluster } = match.profile.metadata;
  const profile: ContainerProfile = await request(
    `${storagePath}/namespaces/${namespace}/${match.source.plural}/${name}`,
    { ...(cluster ? { cluster } : {}), autoLogoutOnAuthError: false }
  );
  const containers = getProfileContainers(profile);
  const own = containers.filter(entry => entry.name === container);
  const domains = new Set<string>();
  for (const entry of own.length > 0 ? own : containers) {
    for (const neighbor of entry.egress ?? []) {
      for (const dns of [neighbor.dns, ...(neighbor.dnsNames ?? [])]) {
        if (dns) domains.add(withoutDot(dns));
      }
    }
  }
  return [...domains].sort();
}

const secondLevel = new Set(['co', 'com', 'net', 'org', 'ac', 'gov', 'edu']);

/** The domain a name is registered under, such as golang.org or bbc.co.uk. */
export function registeredDomain(name: string): string {
  const labels = withoutDot(name).split('.');
  const country = labels.length > 2 && labels[labels.length - 1].length === 2;
  const size = country && secondLevel.has(labels[labels.length - 2]) ? 3 : 2;
  return labels.slice(-size).join('.');
}

export interface DomainComparison {
  // whether the profile has the domain, itself or by a *. wildcard
  learned: boolean;
  // the learned names under the same registered domain
  related: string[];
}

/** How a domain an alert is about compares to the domains the profile learned. */
export function compareDomain(domain: string, learned: string[]): DomainComparison {
  const name = withoutDot(domain);
  const base = registeredDomain(name);
  return {
    learned: learned.some(
      entry => entry === name || (entry.startsWith('*.') && name.endsWith(entry.slice(1)))
    ),
    related: learned.filter(entry => entry !== name && registeredDomain(entry) === base),
  };
}
