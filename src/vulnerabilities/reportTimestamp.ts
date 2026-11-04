import type { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';

/** Successful report evaluation time, never the Kubernetes record creation time. */
export function getVulnerabilityReportCreatedAt(
  manifest?: Pick<VulnerabilityManifest, 'spec'> | null
): string | undefined {
  const value = manifest?.spec.metadata?.report?.createdAt;
  if (typeof value !== 'string') return undefined;

  const parts =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(
      value
    );
  if (!parts) return undefined;

  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = parts
    .slice(1)
    .map(part => Number(part ?? 0));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  )
    return undefined;

  const time = Date.parse(value);
  if (!Number.isFinite(time)) return undefined;
  const normalized = new Date(time).toISOString();
  return normalized === '0001-01-01T00:00:00.000Z' ? undefined : normalized;
}

/**
 * When kubevuln last scanned the container, from the kubescape.io/timestamp annotation (Unix
 * seconds) of the VulnerabilityManifestSummary. Recent kubevuln versions leave the evaluation
 * time of the reports empty, and this is the only scan time they record.
 */
export function getScanTime(
  summary?: { metadata?: { annotations?: Record<string, string> } } | null
): string | undefined {
  const seconds = Number(summary?.metadata?.annotations?.['kubescape.io/timestamp']);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(seconds * 1000).toISOString();
}
