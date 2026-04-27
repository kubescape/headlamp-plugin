// TEMPORARY: This module applies SecurityException CRDs client-side to workload scan data.
// Remove once the kubescape operator writes exceptedByPolicy flags into stored scan CRDs at scan time.

import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { Control } from '../rego';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

export async function fetchSecurityExceptions(cluster?: string): Promise<{
  namespaced: SecurityException[];
  cluster: ClusterSecurityException[];
  namespaceLabelsByName: Map<string, Record<string, string>>;
}> {
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
  return {
    namespaced: nsList.items ?? [],
    cluster: clList.items ?? [],
    namespaceLabelsByName,
  };
}

function isExpired(expiresAt?: string): boolean {
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
    if (expr.operator === 'In' && !expr.values.includes(val)) return false;
    if (expr.operator === 'NotIn' && expr.values.includes(val)) return false;
  }
  return true;
}

function matchesWorkload(
  exception: SecurityException | ClusterSecurityException,
  workloadKind: string,
  workloadName: string,
  workloadNamespace: string,
  namespaceLabelsByName: Map<string, Record<string, string>>
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

  // objectSelector — deferred: requires fetching workload labels. Skip exception conservatively.
  if (match?.objectSelector) {
    return false;
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
  exceptions: {
    namespaced: SecurityException[];
    cluster: ClusterSecurityException[];
    namespaceLabelsByName: Map<string, Record<string, string>>;
  }
) {
  const allExceptions: (SecurityException | ClusterSecurityException)[] = [
    ...exceptions.namespaced,
    ...exceptions.cluster,
  ];

  for (const w of workloadScans) {
    const workloadKind = w.metadata.labels['kubescape.io/workload-kind'] ?? '';
    const workloadName = w.metadata.labels['kubescape.io/workload-name'] ?? '';
    const workloadNamespace = w.metadata.labels['kubescape.io/workload-namespace'] ?? '';

    const matched = allExceptions.filter(
      ex =>
        !isExpired(ex.spec.expiresAt) &&
        matchesWorkload(
          ex,
          workloadKind,
          workloadName,
          workloadNamespace,
          exceptions.namespaceLabelsByName
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
    Object.entries(w.spec.controls).forEach(([, value]) => {
      value.exceptedByPolicy = matched.some(ex =>
        ex.spec.posture?.some(p => p.controlID === value.controlID)
      );
    });
  }
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

export function countExcludedWorkloadsForControl(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  let excluded = 0;
  workloadScanData.forEach(w => {
    Object.values(w.spec.controls).forEach(scan => {
      if (scan.controlID === control.controlID && (w.exceptedByPolicy || scan.exceptedByPolicy))
        excluded++;
    });
  });
  return excluded;
}
