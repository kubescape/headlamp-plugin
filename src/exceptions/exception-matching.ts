// Pure matching logic for SecurityException / ClusterSecurityException CRDs.
//
// Kept free of any Headlamp or rego import so it stays directly unit-testable,
// and so it mirrors, in one place, what kubescape's CRDExceptionsGetter and
// kubevuln's matcher do server-side.

import {
  ClusterSecurityException,
  LabelSelectorRequirement,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

export type AnySecurityException = SecurityException | ClusterSecurityException;

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

/** Everything the matcher needs besides the exceptions themselves. */
export interface MatchContext {
  namespaceLabelsByName: Map<string, Record<string, string>>;
  // Keyed by workloadKey(). Absent means "could not resolve", which fails closed.
  workloadLabelsByKey: Map<string, Record<string, string>>;
}

export interface SecurityExceptionData extends MatchContext {
  namespaced: SecurityException[];
  cluster: ClusterSecurityException[];
}

export function emptySecurityExceptionData(): SecurityExceptionData {
  return {
    namespaced: [],
    cluster: [],
    namespaceLabelsByName: new Map(),
    workloadLabelsByKey: new Map(),
  };
}

export function workloadKey(kind: string, namespace: string, name: string): string {
  return `${kind.toLowerCase()}/${namespace}/${name}`;
}

export function hasObjectSelector(exceptions: AnySecurityException[]): boolean {
  return exceptions.some(ex => !!ex.spec.match?.objectSelector);
}

export function isExpired(expiresAt?: string, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < now;
}

export function labelsMatchSelector(
  selector: LabelSelector,
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

export function exceptionMatchesWorkload(
  exception: AnySecurityException,
  workloadKind: string,
  workloadName: string,
  workloadNamespace: string,
  context: MatchContext
): boolean {
  const isNamespaced = exception.kind === 'SecurityException';
  const match = exception.spec.match;

  // Implicit namespace scope for SecurityException
  if (isNamespaced && (exception as SecurityException).metadata.namespace !== workloadNamespace) {
    return false;
  }

  // namespaceSelector (ClusterSecurityException only) — AND with other selectors
  if (!isNamespaced && match?.namespaceSelector) {
    const nsLabels = context.namespaceLabelsByName.get(workloadNamespace) ?? {};
    if (!labelsMatchSelector(match.namespaceSelector, nsLabels)) return false;
  }

  // objectSelector matches the labels on the workload itself. Fail closed when the
  // workload's labels could not be resolved, which is what kubevuln does too.
  if (match?.objectSelector) {
    const labels = context.workloadLabelsByKey.get(
      workloadKey(workloadKind, workloadNamespace, workloadName)
    );
    if (!labels) return false;
    if (!labelsMatchSelector(match.objectSelector, labels)) return false;
  }

  // resources[] — omitted or empty means no restriction (match all in scope)
  if (match?.resources && match.resources.length > 0) {
    const matched = match.resources.some(
      r =>
        !!r.kind &&
        r.kind.toLowerCase() === workloadKind.toLowerCase() &&
        (!r.name || r.name === workloadName)
    );
    if (!matched) return false;
  }

  return true;
}

export function workloadIdentity(w: WorkloadConfigurationScanSummary) {
  return {
    kind: w.metadata.labels['kubescape.io/workload-kind'] ?? '',
    name: w.metadata.labels['kubescape.io/workload-name'] ?? '',
    namespace: w.metadata.labels['kubescape.io/workload-namespace'] ?? '',
  };
}

/** Returns the non-expired exceptions in `data` that match the given workload. */
export function matchingExceptions(
  data: SecurityExceptionData,
  workloadKind: string,
  workloadName: string,
  workloadNamespace: string,
  now: Date = new Date()
): AnySecurityException[] {
  const all: AnySecurityException[] = [...data.namespaced, ...data.cluster];
  return all.filter(
    ex =>
      !isExpired(ex.spec.expiresAt, now) &&
      exceptionMatchesWorkload(ex, workloadKind, workloadName, workloadNamespace, data)
  );
}

// TEMPORARY: Apply SecurityException posture entries to workload scan summaries.
// Exceptions are keyed by cluster because a multi-cluster compliance view holds
// scans from several clusters at once, and an exception only applies to its own.
export function applySecurityExceptionsToWorkloadScans(
  workloadScans: WorkloadConfigurationScanSummary[],
  exceptionsByCluster: Map<string, SecurityExceptionData>,
  now: Date = new Date()
) {
  const soleCluster = exceptionsByCluster.size === 1 ? [...exceptionsByCluster.values()][0] : null;

  for (const w of workloadScans) {
    // metadata.cluster is stamped on every item by paginatedListQuery, but fall
    // back to the only known cluster so a single-cluster view still works.
    const data = exceptionsByCluster.get(w.metadata.cluster) ?? soleCluster;
    const { kind, name, namespace } = workloadIdentity(w);

    const matched = data ? matchingExceptions(data, kind, name, namespace, now) : [];

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
        excluded + Object.values(w.spec.controls ?? {}).filter(scan => scan.exceptedByPolicy).length,
      0
    );
}

export function countExcludedWorkloadsForControl(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: { controlID: string }
) {
  let excluded = 0;
  workloadScanData.forEach(w => {
    Object.values(w.spec.controls ?? {}).forEach(scan => {
      if (scan.controlID === control.controlID && (w.exceptedByPolicy || scan.exceptedByPolicy))
        excluded++;
    });
  });
  return excluded;
}
