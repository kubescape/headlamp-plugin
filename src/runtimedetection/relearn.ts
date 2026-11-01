import type { ContainerProfile } from '../softwarecomposition/ContainerProfile';

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
