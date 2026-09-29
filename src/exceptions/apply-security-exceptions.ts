// TEMPORARY: This module applies SecurityException CRDs client-side to workload scan data.
// Remove once the kubescape operator writes exceptedByPolicy flags into stored scan CRDs at scan time.
//
// The matching itself lives in ./exception-matching, which has no Headlamp imports
// so it can be unit tested directly. This module is the part that talks to the API.

import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { AnySecurityException, hasObjectSelector, MatchContext } from './exception-matching';

export * from './exception-matching';

// The workload kinds kubevuln resolves labels for, and the same set the kubevuln
// ClusterRole is granted get on (helm-charts #879). Anything outside this list
// cannot be matched by objectSelector.
const WORKLOAD_ENDPOINTS: { kind: string; base: string; plural: string }[] = [
  { kind: 'Pod', base: '/api/v1', plural: 'pods' },
  { kind: 'ReplicationController', base: '/api/v1', plural: 'replicationcontrollers' },
  { kind: 'Deployment', base: '/apis/apps/v1', plural: 'deployments' },
  { kind: 'StatefulSet', base: '/apis/apps/v1', plural: 'statefulsets' },
  { kind: 'DaemonSet', base: '/apis/apps/v1', plural: 'daemonsets' },
  { kind: 'ReplicaSet', base: '/apis/apps/v1', plural: 'replicasets' },
  { kind: 'Job', base: '/apis/batch/v1', plural: 'jobs' },
  { kind: 'CronJob', base: '/apis/batch/v1', plural: 'cronjobs' },
];

/**
 * One path per namespace when Headlamp restricts the user to a namespace set, and
 * a single cluster-wide path otherwise. A restricted user cannot list cluster-wide,
 * and the failure is invisible here because it is caught and treated as "no labels",
 * which silently stops every objectSelector exception from matching.
 */
function listPaths(base: string, plural: string, allowedNamespaces: string[]): string[] {
  if (allowedNamespaces.length === 0) return [`${base}/${plural}`];
  return allowedNamespaces.map(namespace => `${base}/namespaces/${namespace}/${plural}`);
}

/**
 * Resolves the namespace and workload labels the given exceptions need. Workload
 * labels cost one list per kind, so they are only fetched when some exception
 * actually carries an objectSelector.
 */
export async function fetchMatchContext(
  exceptions: AnySecurityException[],
  cluster?: string
): Promise<MatchContext> {
  const opts = cluster ? { cluster } : {};
  const allowedNamespaces = getAllowedNamespaces(cluster);

  // Same reason as the workload lists: a restricted user cannot list namespaces
  // cluster-wide, so read the ones they are allowed to see individually.
  const namespaceLabelsByName = new Map<string, Record<string, string>>();
  if (allowedNamespaces.length > 0) {
    const namespaceObjects = await Promise.all(
      allowedNamespaces.map(namespace =>
        request(`/api/v1/namespaces/${namespace}`, opts).catch(() => null)
      )
    );
    for (const ns of namespaceObjects) {
      if (ns?.metadata) namespaceLabelsByName.set(ns.metadata.name, ns.metadata.labels ?? {});
    }
  } else {
    const namespaces = await request('/api/v1/namespaces', opts).catch(() => ({ items: [] }));
    for (const ns of namespaces.items ?? []) {
      namespaceLabelsByName.set(ns.metadata.name, ns.metadata.labels ?? {});
    }
  }

  const workloadLabelsByKey = new Map<string, Record<string, string>>();
  if (hasObjectSelector(exceptions)) {
    const requests = WORKLOAD_ENDPOINTS.flatMap(endpoint =>
      listPaths(endpoint.base, endpoint.plural, allowedNamespaces).map(path =>
        request(path, opts)
          .then(list => ({ endpoint, list }))
          .catch(error => {
            // Fail closed: without labels the objectSelector cannot be confirmed,
            // so those exceptions simply will not match.
            console.warn(`Could not list ${endpoint.kind} for objectSelector matching`, error);
            return { endpoint, list: { items: [] } };
          })
      )
    );

    // Only the labels are kept, so the responses themselves are not held onto.
    for (const { endpoint, list } of await Promise.all(requests)) {
      for (const item of list.items ?? []) {
        workloadLabelsByKey.set(
          `${endpoint.kind.toLowerCase()}/${item.metadata.namespace ?? ''}/${item.metadata.name}`,
          item.metadata.labels ?? {}
        );
      }
    }
  }

  return { namespaceLabelsByName, workloadLabelsByKey };
}

export async function fetchSecurityExceptions(cluster?: string) {
  const opts = cluster ? { cluster } : {};
  const [nsList, clList] = await Promise.all([
    request('/apis/kubescape.io/v1beta1/securityexceptions', opts).catch(() => ({ items: [] })),
    request('/apis/kubescape.io/v1beta1/clustersecurityexceptions', opts).catch(() => ({
      items: [],
    })),
  ]);
  const namespaced: SecurityException[] = nsList.items ?? [];
  const clusterScoped: ClusterSecurityException[] = clList.items ?? [];

  const context = await fetchMatchContext([...namespaced, ...clusterScoped], cluster);

  return { namespaced, cluster: clusterScoped, ...context };
}
