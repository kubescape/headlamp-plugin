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
