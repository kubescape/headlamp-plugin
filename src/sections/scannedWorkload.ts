import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

export interface WorkloadRef {
  kind: string;
  name: string;
}

interface ObjectMeta {
  name: string;
  ownerReferences?: Array<WorkloadRef & { controller?: boolean }>;
}

// Controllers whose own controller Kubescape scans instead, with their API path
const ownedControllerPaths: Record<string, (namespace: string, name: string) => string> = {
  ReplicaSet: (namespace, name) => `/apis/apps/v1/namespaces/${namespace}/replicasets/${name}`,
  Job: (namespace, name) => `/apis/batch/v1/namespaces/${namespace}/jobs/${name}`,
};

function controllerOf(metadata: ObjectMeta | undefined): WorkloadRef | undefined {
  return metadata?.ownerReferences?.find(reference => reference.controller);
}

/**
 * Finds the workload that Kubescape scans for a pod, by following its controllers: a pod of a
 * Deployment is scanned as the Deployment (Pod → ReplicaSet → Deployment), a pod of a CronJob
 * as the CronJob (Pod → Job → CronJob). A pod without a controller is scanned itself.
 */
export async function findScannedWorkload(
  pod: { metadata: ObjectMeta & { namespace: string } },
  cluster?: string
): Promise<WorkloadRef> {
  let workload: WorkloadRef = { kind: 'Pod', name: pod.metadata.name };
  let controller = controllerOf(pod.metadata);

  while (controller) {
    workload = { kind: controller.kind, name: controller.name };
    const path = ownedControllerPaths[controller.kind]?.(pod.metadata.namespace, controller.name);
    if (!path) break;

    const object = await request(path, cluster ? { cluster } : {}).catch(() => null);
    controller = controllerOf(object?.metadata);
  }
  return workload;
}
