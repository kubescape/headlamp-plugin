// Storage's v1beta1 ContainerProfile combines behavior and network baselines.
// Learned profiles have one container's fields at spec root; authored profiles
// may group several containers in the subtype arrays.
export interface ContainerProfile {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: ContainerProfileSpec;
}

export interface NetworkNeighbor {
  identifier?: string;
  type?: string;
  dns?: string;
  dnsNames?: string[];
  ipAddress?: string;
  ipAddresses?: string[];
  ports?: { name?: string; protocol?: string; port?: number }[];
  podSelector?: unknown;
  namespaceSelector?: unknown;
  serviceRefNamespace?: string;
  serviceRefName?: string;
  serviceSelector?: unknown;
  entity?: string;
}

export interface ContainerProfileFields {
  architectures?: string[];
  capabilities?: string[];
  execs?: { path: string; args?: string[]; envs?: string[] }[];
  opens?: { path: string; flags?: string[] }[];
  syscalls?: string[];
  endpoints?: { endpoint: string; methods?: string[]; internal?: boolean; direction?: string }[];
  imageID?: string;
  imageTag?: string;
  rulePolicies?: Record<string, { allowedProcesses?: string[]; allowedContainer?: boolean }>;
  seccompProfile?: unknown;
  identifiedCallStacks?: unknown[];
  ingress?: NetworkNeighbor[];
  egress?: NetworkNeighbor[];
}

export interface ContainerProfileContainer extends ContainerProfileFields {
  name: string;
}

export interface ContainerProfileSpec extends ContainerProfileFields {
  containers?: ContainerProfileContainer[];
  initContainers?: ContainerProfileContainer[];
  ephemeralContainers?: ContainerProfileContainer[];
}

export interface ProfileContainerGroups {
  containers: ContainerProfileContainer[];
  initContainers: ContainerProfileContainer[];
  ephemeralContainers: ContainerProfileContainer[];
}

export function getProfileContainerGroups(profile: ContainerProfile): ProfileContainerGroups {
  const spec = profile.spec;
  if (!spec) return { containers: [], initContainers: [], ephemeralContainers: [] };

  const groups = {
    containers: spec.containers ?? [],
    initContainers: spec.initContainers ?? [],
    ephemeralContainers: spec.ephemeralContainers ?? [],
  };
  if (Object.values(groups).some(group => group.length > 0)) return groups;

  return {
    containers: [
      {
        ...spec,
        name:
          profile.metadata.labels?.['kubescape.io/workload-container-name'] ||
          profile.metadata.name,
      },
    ],
    initContainers: [],
    ephemeralContainers: [],
  };
}

export function getProfileContainers(profile: ContainerProfile): ContainerProfileContainer[] {
  const groups = getProfileContainerGroups(profile);
  return [...groups.containers, ...groups.initContainers, ...groups.ephemeralContainers];
}
