// https://github.com/kubescape/storage/tree/main/pkg/apis/softwarecomposition (types.go)
// Only fields as used in this project are declared

export interface SeccompProfile {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    cluster?: string; // for multi cluster support
  };
  spec?: {
    containers?: SeccompProfile.Container[];
    initContainers?: SeccompProfile.Container[];
    ephemeralContainers?: SeccompProfile.Container[];
  };
  status?: {
    containers?: Record<string, SeccompProfile.ContainerStatus>;
  };
}

export namespace SeccompProfile {
  export interface Container {
    name: string;
    path?: string;
    spec?: Spec;
  }

  // The seccomp profile in the format of the OCI runtime spec, plus Kubescape fields
  export interface Spec {
    disabled?: boolean;
    baseProfileName?: string;
    defaultAction: string;
    architectures?: string[];
    listenerPath?: string;
    listenerMetadata?: string;
    syscalls?: Syscall[];
    flags?: string[];
  }

  export interface Syscall {
    names: string[];
    action: string;
    errnoRet?: number;
    args?: unknown[];
  }

  export interface ContainerStatus {
    status?: string;
    path?: string;
    // the value for securityContext.seccompProfile.localhostProfile
    localhostProfile?: string;
    activeWorkloads?: string[];
  }
}
