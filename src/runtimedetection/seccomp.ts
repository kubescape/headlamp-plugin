import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { seccompProfileClass, seccompProfileStorageClass } from '../model';
import { SeccompProfile } from '../softwarecomposition/SeccompProfile';

async function servesSeccompProfiles(groupVersionPath: string, cluster?: string) {
  const discovery = await request(groupVersionPath, cluster ? { cluster } : {}).catch(() => null);
  return (
    Array.isArray(discovery?.resources) &&
    discovery.resources.some((resource: { name?: string }) => resource.name === 'seccompprofiles')
  );
}

/**
 * Finds where the cluster stores seccomp profiles: in the SeccompProfile CRD (the default
 * seccompProfileBackend of the operator chart) or in the Kubescape storage.
 */
export async function discoverSeccompProfileClass(cluster?: string): Promise<KubeObjectClass> {
  if (await servesSeccompProfiles('/apis/kubescape.io/v1', cluster)) {
    return seccompProfileClass;
  }
  if (await servesSeccompProfiles('/apis/spdx.softwarecomposition.kubescape.io/v1beta1', cluster)) {
    return seccompProfileStorageClass;
  }
  throw new Error(
    'Kubescape does not serve seccomp profiles. Is the seccompProfileService capability of the operator enabled?'
  );
}

/** The containers of all kinds that the profile has a seccomp profile for. */
export function profileContainers(profile: SeccompProfile): SeccompProfile.Container[] {
  return [
    ...(profile.spec?.containers ?? []),
    ...(profile.spec?.initContainers ?? []),
    ...(profile.spec?.ephemeralContainers ?? []),
  ];
}

/** The syscalls the profile allows. */
export function allowedSyscalls(spec: SeccompProfile.Spec | undefined): string[] {
  return [
    ...new Set(
      (spec?.syscalls ?? [])
        .filter(syscall => syscall.action === 'SCMP_ACT_ALLOW')
        .flatMap(syscall => syscall.names)
    ),
  ].sort();
}

/**
 * The value for securityContext.seccompProfile.localhostProfile of the container: the path of
 * the profile in the seccomp directory of the kubelet, once Kubescape installed it on the nodes.
 */
export function localhostProfile(
  profile: SeccompProfile,
  container: SeccompProfile.Container
): string | undefined {
  return profile.status?.containers?.[container.name]?.localhostProfile;
}

/** The profile as a seccomp JSON file, in the format of the OCI runtime specification. */
export function toSeccompJson(spec: SeccompProfile.Spec): string {
  const profile = {
    defaultAction: spec.defaultAction,
    ...(spec.architectures?.length && { architectures: spec.architectures }),
    ...(spec.flags?.length && { flags: spec.flags }),
    ...(spec.listenerPath && { listenerPath: spec.listenerPath }),
    ...(spec.listenerMetadata && { listenerMetadata: spec.listenerMetadata }),
    syscalls: (spec.syscalls ?? []).map(({ names, action, errnoRet, args }) => ({
      names,
      action,
      ...(errnoRet !== undefined && { errnoRet }),
      ...(args?.length && { args }),
    })),
  };
  return JSON.stringify(profile, null, 2) + '\n';
}

/** The securityContext that applies the installed profile to a container. */
export function securityContextYaml(localhostProfilePath: string): string {
  return [
    'securityContext:',
    '  seccompProfile:',
    '    type: Localhost',
    `    localhostProfile: ${localhostProfilePath}`,
  ].join('\n');
}
