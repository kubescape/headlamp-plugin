/*
  Resources of the cluster to evaluate playground policies against.
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

interface ResourceKind {
  apiVersion: string;
  plural: string;
  namespaced: boolean;
}

// The kinds that the Kubescape library policies check
export const resourceKinds: Record<string, ResourceKind> = {
  Pod: { apiVersion: 'v1', plural: 'pods', namespaced: true },
  Deployment: { apiVersion: 'apps/v1', plural: 'deployments', namespaced: true },
  StatefulSet: { apiVersion: 'apps/v1', plural: 'statefulsets', namespaced: true },
  DaemonSet: { apiVersion: 'apps/v1', plural: 'daemonsets', namespaced: true },
  ReplicaSet: { apiVersion: 'apps/v1', plural: 'replicasets', namespaced: true },
  Job: { apiVersion: 'batch/v1', plural: 'jobs', namespaced: true },
  CronJob: { apiVersion: 'batch/v1', plural: 'cronjobs', namespaced: true },
  Service: { apiVersion: 'v1', plural: 'services', namespaced: true },
  Ingress: { apiVersion: 'networking.k8s.io/v1', plural: 'ingresses', namespaced: true },
  ServiceAccount: { apiVersion: 'v1', plural: 'serviceaccounts', namespaced: true },
  Role: { apiVersion: 'rbac.authorization.k8s.io/v1', plural: 'roles', namespaced: true },
  RoleBinding: {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    plural: 'rolebindings',
    namespaced: true,
  },
  ClusterRole: {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    plural: 'clusterroles',
    namespaced: false,
  },
  ClusterRoleBinding: {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    plural: 'clusterrolebindings',
    namespaced: false,
  },
  Namespace: { apiVersion: 'v1', plural: 'namespaces', namespaced: false },
};

export interface ResourceRef {
  namespace?: string;
  name: string;
}

function collection(kind: ResourceKind, namespace?: string) {
  const base = kind.apiVersion.includes('/')
    ? `/apis/${kind.apiVersion}`
    : `/api/${kind.apiVersion}`;
  return `${base}/${namespace ? `namespaces/${namespace}/` : ''}${kind.plural}`;
}

/**
 * The objects of a kind, in the given namespaces when the user may only see those, sorted by
 * namespace and name.
 */
export async function listResources(kindName: string, namespaces: string[] = []) {
  const kind = resourceKinds[kindName];
  const lists =
    kind.namespaced && namespaces.length > 0
      ? await Promise.all(namespaces.map(namespace => request(collection(kind, namespace))))
      : [await request(collection(kind))];
  return lists
    .flatMap(list => list.items ?? [])
    .map(
      (item: any): ResourceRef => ({ namespace: item.metadata.namespace, name: item.metadata.name })
    )
    .sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
}

/** The object with its kind; the editor leaves out its status and managed fields. */
export async function fetchResource(kindName: string, ref: ResourceRef) {
  const kind = resourceKinds[kindName];
  const object = await request(`${collection(kind, ref.namespace)}/${ref.name}`);
  return { ...object, apiVersion: kind.apiVersion, kind: kindName };
}
