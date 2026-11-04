/*
  The CVEs of the scanned images, with the workloads and images they are found in.
*/
import type { ImageScan, WorkloadScan } from './scanData';

export interface CVEScan {
  CVE: string;
  description: string;
  severity: string;
  baseScore: number;
  workloads: Set<string>;
  images: Set<string>;
  artifacts: Set<string>;
  fixed: boolean;
  relevant: boolean | undefined;
}

/**
 * The CVEs of the workloads, each with the workloads, images and packages it is found in.
 * A CVE is relevant when a workload with relevancy data uses it, not relevant when the
 * workloads with relevancy data do not, and undefined when none of its workloads has any.
 */
export function getCVEList(workloadScans: WorkloadScan[]): CVEScan[] {
  const cvesById = new Map<string, CVEScan>();
  // the relevant CVE ids of each relevancy scan, which the workloads of an image share
  const relevantIdsByScan = new Map<ImageScan, Set<string>>();
  const relevantIdsOf = (scan: ImageScan) => {
    let ids = relevantIdsByScan.get(scan);
    if (!ids) {
      ids = new Set(scan.matches.map(match => match.vulnerability.id));
      relevantIdsByScan.set(scan, ids);
    }
    return ids;
  };

  for (const workloadScan of workloadScans) {
    const imageScan = workloadScan.imageScan;
    if (!imageScan?.matches) continue;
    const workload = workloadScan.name + '/' + workloadScan.container;
    const relevantIds = workloadScan.relevant?.matches
      ? relevantIdsOf(workloadScan.relevant)
      : undefined;

    for (const match of imageScan.matches) {
      const id = match.vulnerability.id;
      let cve = cvesById.get(id);
      if (!cve) {
        cve = {
          CVE: id,
          description: match.vulnerability.description,
          severity: match.vulnerability.severity,
          baseScore: match.vulnerability.cvss ? match.vulnerability.cvss[0].metrics.baseScore : 0,
          workloads: new Set<string>(),
          images: new Set<string>(),
          artifacts: new Set<string>(),
          fixed: false,
          relevant: undefined,
        };
        // if vulnerability has no description, try get it from related
        if (!cve.description && match.relatedVulnerabilities) {
          cve.description = match.relatedVulnerabilities
            .filter(rv => rv.id === id)
            .map(rv => rv.description)
            .join();
        }
        cvesById.set(id, cve);
      }

      cve.workloads.add(workload);
      cve.images.add(imageScan.imageName);
      cve.artifacts.add(match.artifact.name + ' ' + match.artifact.version);
      cve.fixed = cve.fixed || !!match.vulnerability.fix?.versions;
      if (relevantIds) cve.relevant = cve.relevant || relevantIds.has(id);
    }
  }

  return [...cvesById.values()];
}
