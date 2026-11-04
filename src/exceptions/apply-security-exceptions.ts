// This module applies SecurityException CRDs client-side to workload scan data, for clusters
// where the scanners do not apply them (the riskAcceptance capability is disabled). Where they
// do, markScannerExceptions reads the result of the scanner instead.

import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { invalidateControlStats } from '../compliance/workload-scanning';
import {
  ClusterSecurityException,
  SecurityException,
  SecurityExceptionMatchSpec,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

type AnySecurityException = SecurityException | ClusterSecurityException;
type LabelSelector = NonNullable<SecurityExceptionMatchSpec['objectSelector']>;

export type SecurityExceptionData = {
  namespaced: SecurityException[];
  cluster: ClusterSecurityException[];
  namespaceLabelsByName: Map<string, Record<string, string>>;
  // Per exception with an objectSelector: keys (see workloadKey) of the workloads it selects
  objectSelectorMatches?: Map<AnySecurityException, Set<string>>;
};

// List endpoints of the workload kinds whose labels an objectSelector is matched against.
const workloadListEndpoints: Record<string, { prefix: string; plural: string }> = {
  deployment: { prefix: '/apis/apps/v1', plural: 'deployments' },
  statefulset: { prefix: '/apis/apps/v1', plural: 'statefulsets' },
  daemonset: { prefix: '/apis/apps/v1', plural: 'daemonsets' },
  replicaset: { prefix: '/apis/apps/v1', plural: 'replicasets' },
  job: { prefix: '/apis/batch/v1', plural: 'jobs' },
  cronjob: { prefix: '/apis/batch/v1', plural: 'cronjobs' },
  pod: { prefix: '/api/v1', plural: 'pods' },
};

function workloadKey(kind: string, namespace: string, name: string) {
  return `${kind.toLowerCase()}/${namespace}/${name}`;
}

function scanWorkloadLabels(w: WorkloadConfigurationScanSummary) {
  return {
    workloadKind: w.metadata.labels['kubescape.io/workload-kind'] ?? '',
    workloadName: w.metadata.labels['kubescape.io/workload-name'] ?? '',
    workloadNamespace: w.metadata.labels['kubescape.io/workload-namespace'] ?? '',
  };
}

/** Formats a label selector in the string syntax of the labelSelector query parameter. */
export function formatLabelSelector(selector: LabelSelector): string {
  const requirements = Object.entries(selector.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`);
  for (const expr of selector.matchExpressions ?? []) {
    const values = (expr.values ?? []).join(',');
    if (expr.operator === 'In') requirements.push(`${expr.key} in (${values})`);
    if (expr.operator === 'NotIn') requirements.push(`${expr.key} notin (${values})`);
    if (expr.operator === 'Exists') requirements.push(expr.key);
    if (expr.operator === 'DoesNotExist') requirements.push(`!${expr.key}`);
  }
  return requirements.join(',');
}

/**
 * Lets the API server evaluate the objectSelector of each exception against the workloads
 * of the kinds found in the scans. Workloads that cannot be listed never match.
 */
async function fetchObjectSelectorMatches(
  exceptions: AnySecurityException[],
  workloadKinds: string[],
  opts: { cluster?: string }
): Promise<Map<AnySecurityException, Set<string>>> {
  const matches = new Map<AnySecurityException, Set<string>>();

  await Promise.all(
    exceptions
      .filter(ex => ex.spec.match?.objectSelector && !isExpired(ex.spec.expiresAt))
      .map(async ex => {
        const match = ex.spec.match!;
        const resourceKinds = (match.resources ?? []).map(r => r.kind.toLowerCase());
        const kinds = workloadKinds.filter(
          kind =>
            workloadListEndpoints[kind] &&
            (resourceKinds.length === 0 || resourceKinds.includes(kind))
        );
        const namespacePath =
          ex.kind === 'SecurityException' ? `/namespaces/${ex.metadata.namespace}` : '';
        const query = new URLSearchParams({
          labelSelector: formatLabelSelector(match.objectSelector!),
        });

        const selected = new Set<string>();
        await Promise.all(
          kinds.map(async kind => {
            const { prefix, plural } = workloadListEndpoints[kind];
            const list = await request(
              `${prefix}${namespacePath}/${plural}?${query.toString()}`,
              opts
            ).catch(() => ({ items: [] }));
            for (const item of list.items ?? []) {
              selected.add(workloadKey(kind, item.metadata.namespace, item.metadata.name));
            }
          })
        );
        matches.set(ex, selected);
      })
  );

  return matches;
}

/**
 * Fetches the security exceptions of a cluster, and what is needed to match them against
 * the given workload scans of that cluster, or workloads of the given kinds.
 */
export async function fetchSecurityExceptions(
  cluster?: string,
  workloadScans: WorkloadConfigurationScanSummary[] = [],
  kinds: string[] = []
): Promise<SecurityExceptionData> {
  const opts = cluster ? { cluster } : {};
  const [nsList, clList, nsObjs] = await Promise.all([
    request('/apis/kubescape.io/v1beta1/securityexceptions', opts).catch(() => ({ items: [] })),
    request('/apis/kubescape.io/v1beta1/clustersecurityexceptions', opts).catch(() => ({
      items: [],
    })),
    request('/api/v1/namespaces', opts).catch(() => ({ items: [] })),
  ]);
  const namespaceLabelsByName = new Map<string, Record<string, string>>(
    (nsObjs.items ?? []).map((ns: any) => [ns.metadata.name, ns.metadata.labels ?? {}])
  );
  const namespaced: SecurityException[] = nsList.items ?? [];
  const clusterExceptions: ClusterSecurityException[] = clList.items ?? [];

  const workloadKinds = [
    ...new Set([
      ...workloadScans.map(w => scanWorkloadLabels(w).workloadKind.toLowerCase()),
      ...kinds.map(kind => kind.toLowerCase()),
    ]),
  ];
  const objectSelectorMatches = await fetchObjectSelectorMatches(
    [...namespaced, ...clusterExceptions],
    workloadKinds,
    opts
  );

  return {
    namespaced,
    cluster: clusterExceptions,
    namespaceLabelsByName,
    objectSelectorMatches,
  };
}

export function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function labelsMatchSelector(
  selector: { matchLabels?: Record<string, string>; matchExpressions?: any[] },
  labels: Record<string, string>
): boolean {
  if (selector.matchLabels) {
    for (const [k, v] of Object.entries(selector.matchLabels)) {
      if (labels[k] !== v) return false;
    }
  }
  for (const expr of selector.matchExpressions ?? []) {
    const has = expr.key in labels;
    const val = labels[expr.key];
    if (expr.operator === 'Exists' && !has) return false;
    if (expr.operator === 'DoesNotExist' && has) return false;
    if (expr.operator === 'In' && !expr.values?.includes(val)) return false;
    if (expr.operator === 'NotIn' && expr.values?.includes(val)) return false;
  }
  return true;
}

export function matchesWorkload(
  exception: AnySecurityException,
  workloadKind: string,
  workloadName: string,
  workloadNamespace: string,
  namespaceLabelsByName: Map<string, Record<string, string>>,
  objectSelectorMatches: Map<AnySecurityException, Set<string>>
): boolean {
  const isNamespaced = exception.kind === 'SecurityException';
  const match = exception.spec.match;

  // Implicit namespace scope for SecurityException
  if (isNamespaced && (exception as SecurityException).metadata.namespace !== workloadNamespace) {
    return false;
  }

  // namespaceSelector (ClusterSecurityException only) — AND with other selectors
  if (!isNamespaced && match?.namespaceSelector) {
    const nsLabels = namespaceLabelsByName.get(workloadNamespace) ?? {};
    if (!labelsMatchSelector(match.namespaceSelector, nsLabels)) return false;
  }

  // objectSelector — evaluated by the API server in fetchObjectSelectorMatches. Workloads
  // whose labels could not be looked up do not match.
  if (match?.objectSelector) {
    const selected = objectSelectorMatches.get(exception);
    if (!selected?.has(workloadKey(workloadKind, workloadNamespace, workloadName))) return false;
  }

  // resources[] — omitted or empty means no restriction (match all in scope)
  if (match?.resources && match.resources.length > 0) {
    const matched = match.resources.some(
      r =>
        r.kind.toLowerCase() === workloadKind.toLowerCase() && (!r.name || r.name === workloadName)
    );
    if (!matched) return false;
  }

  return true;
}

// TEMPORARY: Apply SecurityException posture entries to workload scan summaries.
export function applySecurityExceptionsToWorkloadScans(
  workloadScans: WorkloadConfigurationScanSummary[],
  exceptions: SecurityExceptionData
) {
  const allExceptions: AnySecurityException[] = [...exceptions.namespaced, ...exceptions.cluster];
  const objectSelectorMatches = exceptions.objectSelectorMatches ?? new Map();

  for (const w of workloadScans) {
    const { workloadKind, workloadName, workloadNamespace } = scanWorkloadLabels(w);

    const matched = allExceptions.filter(
      ex =>
        !isExpired(ex.spec.expiresAt) &&
        matchesWorkload(
          ex,
          workloadKind,
          workloadName,
          workloadNamespace,
          exceptions.namespaceLabelsByName,
          objectSelectorMatches
        )
    );

    // Resource-level exception: exception with no posture AND no vulnerability entries excludes the whole workload.
    // Vulnerability-only exceptions must not suppress compliance results.
    w.exceptedByPolicy = matched.some(
      ex =>
        (!ex.spec.posture || ex.spec.posture.length === 0) &&
        (!ex.spec.vulnerabilities || ex.spec.vulnerabilities.length === 0)
    );

    // Control-level exceptions
    const exceptedControls = new Set(
      matched.flatMap(ex => (ex.spec.posture ?? []).map(p => p.controlID))
    );
    Object.values(w.spec.controls).forEach(value => {
      value.exceptedByPolicy = exceptedControls.has(value.controlID);
    });
  }
  invalidateControlStats();
}

/**
 * Marks the controls that the scanner passed because of a SecurityException, for clusters where
 * the scanners apply the exceptions. A resource counts as excluded when all its controls are.
 */
export function markScannerExceptions(workloadScans: WorkloadConfigurationScanSummary[]) {
  for (const w of workloadScans) {
    const controls = Object.values(w.spec.controls);
    for (const control of controls) {
      control.exceptedByPolicy = control.status.subStatus === 'w/exceptions';
    }
    w.exceptedByPolicy = controls.length > 0 && controls.every(control => control.exceptedByPolicy);
  }
  invalidateControlStats();
}

export function countExcludedResources(workloadScanData: WorkloadConfigurationScanSummary[]) {
  return workloadScanData.filter(w => w.exceptedByPolicy).length;
}

export function countExcludedControls(workloadScanData: WorkloadConfigurationScanSummary[]) {
  return workloadScanData
    .filter(w => !w.exceptedByPolicy)
    .reduce(
      (excluded, w) =>
        excluded + Object.values(w.spec.controls).filter(scan => scan.exceptedByPolicy).length,
      0
    );
}

export { countExcludedWorkloadsForControl } from '../compliance/workload-scanning';
