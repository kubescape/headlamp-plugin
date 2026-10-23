import {
  ContainerProfile,
  ContainerProfileContainer,
  getProfileContainerGroups,
  ProfileContainerGroups,
} from '../softwarecomposition/ContainerProfile';

function projectGroups(
  profile: ContainerProfile,
  project: (container: ContainerProfileContainer) => Record<string, unknown>
): Record<string, unknown> {
  const groups = getProfileContainerGroups(profile);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(groups) as (keyof ProfileContainerGroups)[]) {
    if (groups[key].length > 0) result[key] = groups[key].map(project);
  }
  return result;
}

export function behaviorBaseline(profile: ContainerProfile): Record<string, unknown> {
  return {
    architectures: profile.spec?.architectures ?? [],
    ...projectGroups(profile, container => ({
      name: container.name,
      capabilities: container.capabilities ?? [],
      execs: container.execs ?? [],
      opens: container.opens ?? [],
      syscalls: container.syscalls ?? [],
      endpoints: container.endpoints ?? [],
      imageID: container.imageID ?? '',
      imageTag: container.imageTag ?? '',
      rulePolicies: container.rulePolicies ?? {},
      seccompProfile: container.seccompProfile,
      identifiedCallStacks: container.identifiedCallStacks ?? [],
    })),
  };
}

export function networkBaseline(profile: ContainerProfile): Record<string, unknown> {
  return {
    ...projectGroups(profile, container => ({
      name: container.name,
      ingress: container.ingress ?? [],
      egress: container.egress ?? [],
    })),
  };
}
