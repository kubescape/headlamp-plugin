import { frameworkComplianceScore } from '../compliance/workload-scanning';
import { FrameWork } from '../rego';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { getImageScans, WorkloadScan } from '../vulnerabilities/scanData';

export interface CveCount {
  total: number;
  fixable: number;
}

/** Distinct CVEs per severity in the scanned images, and how many of them have a fix. */
export function countCves(workloadScans: WorkloadScan[]): Record<string, CveCount> {
  const fixableById = new Map<string, { severity: string; fixable: boolean }>();
  for (const image of getImageScans(workloadScans)) {
    for (const match of image.matches) {
      const known = fixableById.get(match.vulnerability.id);
      const fixable = match.vulnerability.fix?.state === 'fixed';
      fixableById.set(match.vulnerability.id, {
        severity: match.vulnerability.severity,
        fixable: (known?.fixable ?? false) || fixable,
      });
    }
  }

  const counts: Record<string, CveCount> = {};
  for (const { severity, fixable } of fixableById.values()) {
    counts[severity] ??= { total: 0, fixable: 0 };
    counts[severity].total++;
    if (fixable) counts[severity].fixable++;
  }
  return counts;
}

/** The compliance score of each of the named frameworks that is known. */
export function frameworkScores(
  workloadScans: WorkloadConfigurationScanSummary[],
  frameworks: FrameWork[],
  names: string[]
): Array<{ name: string; score: number }> {
  return names
    .map(name => frameworks.find(framework => framework.name === name))
    .filter((framework): framework is FrameWork => !!framework && framework.controls.length > 0)
    .map(framework => ({
      name: framework.name,
      score: Math.trunc(frameworkComplianceScore(workloadScans, framework)),
    }));
}

export interface ExceptionExpiry {
  name: string;
  // undefined for a ClusterSecurityException
  namespace?: string;
  cluster: string;
  expiresAt: string;
  expired: boolean;
}

/**
 * The exceptions of a cluster that have expired, and so no longer apply, or that expire within
 * the given number of days. Ordered by expiry.
 */
export function expiringExceptions(
  exceptions: { namespaced: SecurityException[]; cluster: ClusterSecurityException[] },
  cluster: string,
  now: Date = new Date(),
  days: number = 14
): ExceptionExpiry[] {
  const soon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return [...exceptions.namespaced, ...exceptions.cluster]
    .filter(exception => exception.spec.expiresAt && new Date(exception.spec.expiresAt) < soon)
    .map(exception => ({
      name: exception.metadata.name,
      namespace: exception.kind === 'SecurityException' ? exception.metadata.namespace : undefined,
      cluster,
      expiresAt: exception.spec.expiresAt!,
      expired: new Date(exception.spec.expiresAt!) < now,
    }))
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
}
