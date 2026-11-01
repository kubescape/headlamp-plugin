/*
  Relearning the behaviour of a workload. Kubescape learns each container for the learning
  period after it starts, in a profile per version of the pod template. Restarting a workload,
  as kubectl rollout restart does, gives its pods a new version of the template, so they get a
  new profile that is learned from their start.
*/
import { patch, remove, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import type { AccessCheck } from '../common/permissions';
import type { ContainerProfile } from '../softwarecomposition/ContainerProfile';
import type { ProfileResource } from '../softwarecomposition/profileApi';

const storageGroup = 'spdx.softwarecomposition.kubescape.io';
const storagePath = `/apis/${storageGroup}/v1beta1`;

// the workloads whose pods a restart replaces, by their resource in the apps API
export const restartableResources: Record<string, string> = {
  Deployment: 'deployments',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
};

export interface ProfileWorkload {
  kind: string;
  name: string;
  namespace: string;
  cluster?: string;
}

/** The workload a profile was learned for, from the labels Kubescape gives the profile. */
export function workloadOfProfile(profile: ContainerProfile): ProfileWorkload | undefined {
  const labels = profile.metadata.labels ?? {};
  const kind = labels['kubescape.io/workload-kind'];
  const name = labels['kubescape.io/workload-name'];
  if (!kind || !name) return undefined;
  return {
    kind,
    name,
    namespace: profile.metadata.namespace,
    cluster: profile.metadata.cluster || undefined,
  };
}

/** Whether Kubescape began to watch the container after it started, so it missed the start. */
export function isPartial(profile: ContainerProfile): boolean {
  return profile.metadata.annotations?.['kubescape.io/completion'] === 'partial';
}

function clusterOptions(cluster?: string) {
  return cluster ? { cluster } : undefined;
}

/** The profiles of a workload, of all versions of its pod template. */
export async function fetchWorkloadProfiles(
  workload: ProfileWorkload,
  source: ProfileResource
): Promise<ContainerProfile[]> {
  const list = await request(
    `${storagePath}/namespaces/${workload.namespace}/${source.plural}`,
    clusterOptions(workload.cluster) ?? {}
  );
  return ((list?.items ?? []) as ContainerProfile[]).filter(profile => {
    const owner = workloadOfProfile(profile);
    return owner?.kind === workload.kind && owner.name === workload.name;
  });
}

/** The fields of a Deployment, StatefulSet or DaemonSet that tell how a restart replaces pods. */
export interface AppsWorkload {
  spec?: {
    replicas?: number;
    // of a Deployment
    strategy?: { type?: string };
    // of a StatefulSet or DaemonSet
    updateStrategy?: { type?: string };
  };
  status?: { desiredNumberScheduled?: number };
}

export async function fetchWorkload(workload: ProfileWorkload): Promise<AppsWorkload> {
  const resource = restartableResources[workload.kind];
  return request(
    `/apis/apps/v1/namespaces/${workload.namespace}/${resource}/${workload.name}`,
    clusterOptions(workload.cluster) ?? {}
  );
}

export interface RestartImpact {
  // error when the workload is down for a while
  severity: 'error' | 'warning';
  text: string;
  // false when the restart replaces no pods
  replacesPods: boolean;
}

function pods(count: number) {
  return `${count} pod${count === 1 ? '' : 's'}`;
}

/** What a restart does to a workload, by its kind, its replicas and its update strategy. */
export function restartImpact(kind: string, object?: AppsWorkload): RestartImpact {
  if (!object) {
    return {
      severity: 'warning',
      replacesPods: true,
      text: 'Every pod of the workload is replaced.',
    };
  }
  const spec = object.spec ?? {};
  const replicas = spec.replicas ?? 1;
  if (kind !== 'DaemonSet' && replicas === 0) {
    return {
      severity: 'warning',
      replacesPods: false,
      text: 'It is scaled to 0 pods: nothing restarts, and nothing is learned until it is scaled up.',
    };
  }
  if (kind !== 'Deployment' && spec.updateStrategy?.type === 'OnDelete') {
    return {
      severity: 'warning',
      replacesPods: false,
      text: 'Its update strategy is OnDelete: the pods keep running until you delete them, so nothing is relearned until then.',
    };
  }
  if (kind === 'Deployment') {
    if (spec.strategy?.type === 'Recreate') {
      return {
        severity: 'error',
        replacesPods: true,
        text: `Its strategy is Recreate: ${
          replicas === 1
            ? 'its pod stops before the new one starts'
            : `all ${pods(replicas)} stop before the new ones start`
        }, so the workload is down during the restart.`,
      };
    }
    return {
      severity: 'warning',
      replacesPods: true,
      text:
        replicas === 1
          ? 'It has 1 pod. The new pod starts before the old one stops, but connections to the old pod are cut, and without a readiness probe requests can reach the new pod before it is ready.'
          : `Its ${pods(
              replicas
            )} are replaced a few at a time, and connections to the old pods are cut.`,
    };
  }
  if (kind === 'StatefulSet') {
    return replicas === 1
      ? {
          severity: 'error',
          replacesPods: true,
          text: 'It has 1 pod, which stops before its replacement starts: the workload is down until the new pod is ready.',
        }
      : {
          severity: 'warning',
          replacesPods: true,
          text: `Its ${pods(
            replicas
          )} are replaced one at a time, from the highest number down, each stopping before its replacement starts.`,
        };
  }
  const nodes = object.status?.desiredNumberScheduled;
  return {
    severity: 'warning',
    replacesPods: true,
    text: `The pod on each of its ${
      nodes === undefined ? '' : `${nodes} `
    }nodes is replaced, one node at a time unless set otherwise, each stopping before its replacement starts.`,
  };
}

/** The change kubectl rollout restart makes: a new version of the pod template. */
export function restartPatch(now: Date) {
  return {
    spec: {
      template: {
        metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': now.toISOString() } },
      },
    },
  };
}

/** Restarts a Deployment, StatefulSet or DaemonSet, replacing its pods. */
export async function restartWorkload(workload: ProfileWorkload, now: Date = new Date()) {
  const resource = restartableResources[workload.kind];
  if (!resource) throw new Error(`A ${workload.kind} cannot be restarted.`);
  await patch(
    `/apis/apps/v1/namespaces/${workload.namespace}/${resource}/${workload.name}`,
    restartPatch(now),
    false,
    clusterOptions(workload.cluster)
  );
}

/**
 * Deletes profiles. Older Storage releases keep the behaviour and the network of a workload in
 * an ApplicationProfile and a NetworkNeighborhood of the same name, so both are deleted.
 */
export async function deleteProfiles(
  profiles: ContainerProfile[],
  source: ProfileResource,
  cluster?: string
) {
  const plurals = source.modern ? [source.plural] : ['applicationprofiles', 'networkneighborhoods'];
  for (const profile of profiles) {
    for (const plural of plurals) {
      try {
        await remove(
          `${storagePath}/namespaces/${profile.metadata.namespace}/${plural}/${profile.metadata.name}`,
          clusterOptions(cluster)
        );
      } catch (error: any) {
        // the other half of an older profile may be gone already
        if (plural === source.plural || error?.status !== 404) throw error;
      }
    }
  }
}

export function restartCheck(workload: ProfileWorkload): AccessCheck | null {
  const resource = restartableResources[workload.kind];
  return resource
    ? { group: 'apps', resource, verb: 'patch', namespace: workload.namespace, name: workload.name }
    : null;
}

export function deleteProfilesCheck(
  workload: ProfileWorkload,
  source: ProfileResource
): AccessCheck {
  return {
    group: storageGroup,
    resource: source.plural,
    verb: 'delete',
    namespace: workload.namespace,
  };
}
