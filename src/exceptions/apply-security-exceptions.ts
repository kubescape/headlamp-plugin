// TEMPORARY: This module applies SecurityException CRDs client-side to workload scan data.
// Remove once the kubescape operator writes exceptedByPolicy flags into stored scan CRDs at scan time.
//
// The matching itself lives in ./exception-matching, which has no Headlamp imports
// so it can be unit tested directly. This module is the part that talks to the API.

import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { AnySecurityException, hasObjectSelector, MatchContext } from './exception-matching';

export * from './exception-matching';

// The workload kinds kubevuln resolves labels for, and the same set the kubevuln
// ClusterRole is granted get on (helm-charts #879). Anything outside this list
// cannot be matched by objectSelector.
const WORKLOAD_ENDPOINTS: { kind: string; path: string }[] = [
  { kind: 'Pod', path: '/api/v1/pods' },
  { kind: 'ReplicationController', path: '/api/v1/replicationcontrollers' },
  { kind: 'Deployment', path: '/apis/apps/v1/deployments' },
  { kind: 'StatefulSet', path: '/apis/apps/v1/statefulsets' },
  { kind: 'DaemonSet', path: '/apis/apps/v1/daemonsets' },
  { kind: 'ReplicaSet', path: '/apis/apps/v1/replicasets' },
  { kind: 'Job', path: '/apis/batch/v1/jobs' },
  { kind: 'CronJob', path: '/apis/batch/v1/cronjobs' },
];

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

  const namespaces = await request('/api/v1/namespaces', opts).catch(() => ({ items: [] }));
  const namespaceLabelsByName = new Map<string, Record<string, string>>(
    (namespaces.items ?? []).map((ns: any) => [ns.metadata.name, ns.metadata.labels ?? {}])
  );

  const workloadLabelsByKey = new Map<string, Record<string, string>>();
  if (hasObjectSelector(exceptions)) {
    const lists = await Promise.all(
      WORKLOAD_ENDPOINTS.map(endpoint =>
        request(endpoint.path, opts)
          .then(list => ({ endpoint, list }))
          .catch(error => {
            // Fail closed: without labels the objectSelector cannot be confirmed,
            // so those exceptions simply will not match.
            console.warn(`Could not list ${endpoint.kind} for objectSelector matching`, error);
            return { endpoint, list: { items: [] } };
          })
      )
    );
    for (const { endpoint, list } of lists) {
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
