/*
  What the Kubescape search finds: CVEs (by their id, an alias such as a GHSA id, or the package
  they are in), images, workloads and controls. Headlamp's own search has no place for plugin
  data, so the plugin searches its own.
*/
import type { Control } from '../rego/Control';
import { getImageScanKey, getImageScans, WorkloadScan } from '../vulnerabilities/scanData';

const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Negligible', 'Unknown'];

export function severityRank(severity: string | undefined): number {
  const rank = severityOrder.indexOf(severity ?? '');
  return rank === -1 ? severityOrder.length : rank;
}

export interface CveEntry {
  id: string;
  // other ids of the same vulnerability, such as the CVE of a GHSA
  aliases: string[];
  severity: string;
  packages: string[];
  images: number;
  workloads: number;
  clusters: string[];
}

export interface ImageEntry {
  image: string;
  cluster: string;
  namespace: string;
  manifestName: string;
  critical: number;
  high: number;
  workloads: number;
}

export interface WorkloadEntry {
  name: string;
  kind: string;
  namespace: string;
  container: string;
  cluster: string;
  // the vulnerability summary of the workload's container
  manifestName: string;
}

export interface VulnerabilityIndex {
  cves: CveEntry[];
  images: ImageEntry[];
  workloads: WorkloadEntry[];
}

/** Indexes the vulnerability scans that the pages share. */
export function buildVulnerabilityIndex(workloadScans: WorkloadScan[]): VulnerabilityIndex {
  const workloadsPerImage = new Map<string, number>();
  for (const scan of workloadScans) {
    if (!scan.imageScan) continue;
    const key = getImageScanKey(scan.imageScan);
    workloadsPerImage.set(key, (workloadsPerImage.get(key) ?? 0) + 1);
  }

  const cves = new Map<
    string,
    {
      severity: string;
      aliases: Set<string>;
      packages: Set<string>;
      images: Set<string>;
      workloads: number;
      clusters: Set<string>;
    }
  >();
  const images: ImageEntry[] = [];
  for (const imageScan of getImageScans(workloadScans)) {
    const key = getImageScanKey(imageScan);
    const workloads = workloadsPerImage.get(key) ?? 0;
    let critical = 0;
    let high = 0;
    for (const match of imageScan.matches) {
      const { id, severity } = match.vulnerability;
      if (severity === 'Critical') critical++;
      if (severity === 'High') high++;
      let entry = cves.get(id);
      if (!entry) {
        entry = {
          severity,
          aliases: new Set(),
          packages: new Set(),
          images: new Set(),
          workloads: 0,
          clusters: new Set(),
        };
        cves.set(id, entry);
      }
      if (severityRank(severity) < severityRank(entry.severity)) entry.severity = severity;
      for (const related of match.relatedVulnerabilities ?? []) {
        if (related.id && related.id !== id) entry.aliases.add(related.id);
      }
      if (match.artifact?.name) entry.packages.add(match.artifact.name);
      if (!entry.images.has(key)) {
        entry.images.add(key);
        entry.workloads += workloads;
      }
      entry.clusters.add(imageScan.cluster);
    }
    images.push({
      image: imageScan.imageName,
      cluster: imageScan.cluster,
      namespace: imageScan.namespace,
      manifestName: imageScan.manifestName,
      critical,
      high,
      workloads,
    });
  }

  return {
    cves: [...cves].map(([id, entry]) => ({
      id,
      aliases: [...entry.aliases].sort(),
      severity: entry.severity,
      packages: [...entry.packages].sort(),
      images: entry.images.size,
      workloads: entry.workloads,
      clusters: [...entry.clusters].sort(),
    })),
    images,
    workloads: workloadScans
      .filter(scan => scan.name && scan.namespace)
      .map(scan => ({
        name: scan.name,
        kind: scan.kind,
        namespace: scan.namespace,
        container: scan.container,
        cluster: scan.cluster,
        manifestName: scan.manifestName,
      })),
  };
}

/** How well a query matches the fields: 0 exactly, 1 at the start, 2 inside, undefined not. */
export function matchScore(query: string, fields: Array<string | undefined>): number | undefined {
  let best: number | undefined;
  for (const field of fields) {
    const value = field?.toLowerCase();
    if (!value) continue;
    const score = value === query ? 0 : value.startsWith(query) ? 1 : value.includes(query) ? 2 : 3;
    if (score < 3 && (best === undefined || score < best)) best = score;
  }
  return best;
}

export interface SearchGroup<T> {
  items: T[];
  // all matches, of which the first are in items
  total: number;
}

export interface SearchResults {
  cves: SearchGroup<CveEntry>;
  images: SearchGroup<ImageEntry>;
  workloads: SearchGroup<WorkloadEntry>;
  controls: SearchGroup<Control>;
}

function best<T>(
  entries: T[],
  score: (entry: T) => number | undefined,
  order: (a: T, b: T) => number,
  limit: number
): SearchGroup<T> {
  const found = entries
    .map(entry => ({ entry, score: score(entry) }))
    .filter((found): found is { entry: T; score: number } => found.score !== undefined)
    .sort((a, b) => a.score - b.score || order(a.entry, b.entry))
    .map(found => found.entry);
  return { items: found.slice(0, limit), total: found.length };
}

export const minimumQueryLength = 2;

/**
 * The best matches of a query in each group: exact matches first, then those that start with
 * it, then the rest; CVEs by severity after that.
 */
export function search(
  index: VulnerabilityIndex | null,
  controls: Control[],
  rawQuery: string,
  limit = 8
): SearchResults | null {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < minimumQueryLength) return null;
  const empty = { items: [], total: 0 };
  return {
    cves: index
      ? best(
          index.cves,
          cve => matchScore(query, [cve.id, ...cve.aliases, ...cve.packages]),
          (a, b) =>
            severityRank(a.severity) - severityRank(b.severity) ||
            b.images - a.images ||
            a.id.localeCompare(b.id),
          limit
        )
      : empty,
    images: index
      ? best(
          index.images,
          image => matchScore(query, [image.image, image.image.split('/').pop()]),
          (a, b) => b.critical - a.critical || b.high - a.high || a.image.localeCompare(b.image),
          limit
        )
      : empty,
    workloads: index
      ? best(
          index.workloads,
          workload =>
            matchScore(query, [
              workload.name,
              `${workload.namespace}/${workload.name}`,
              workload.container,
            ]),
          (a, b) => a.name.localeCompare(b.name) || a.container.localeCompare(b.container),
          limit
        )
      : empty,
    controls: best(
      controls,
      control => matchScore(query, [control.controlID, control.name]),
      (a, b) => a.controlID.localeCompare(b.controlID),
      limit
    ),
  };
}
