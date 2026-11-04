import { compareVersions } from '../common/versions';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { getImageScanKey, getImageScans, ImageScan, WorkloadScan } from './scanData';

/** A package in an image whose upgrade fixes one or more CVEs. */
export interface PackageUpgrade {
  imageScan: ImageScan;
  packageName: string;
  installedVersion: string;
  fixVersion: string;
  // CVE id to severity
  cves: Map<string, string>;
  workloads: string[];
}

export const severityRank = ['Critical', 'High', 'Medium', 'Low', 'Negligible', 'Unknown'];

/** The upgradable packages of an image, and the CVEs that upgrading them all fixes. */
export interface ImageUpgrade {
  imageScan: ImageScan;
  // CVE id to severity, of all its packages
  cves: Map<string, string>;
  // the packages to upgrade, the ones that fix the most CVEs first
  packages: PackageUpgrade[];
  workloads: string[];
}

export function countBySeverity(upgrade: { cves: Map<string, string> }, severity: string): number {
  return [...upgrade.cves.values()].filter(s => s === severity).length;
}

/** Sorts by the CVEs fixed, most critical first, then by name. */
function sortBySeverity<T extends { cves: Map<string, string> }>(
  upgrades: T[],
  name: (upgrade: T) => string
): T[] {
  // counted once per upgrade instead of in every comparison
  const counts = new Map(
    upgrades.map(upgrade => [upgrade, severityRank.map(s => countBySeverity(upgrade, s))])
  );
  return upgrades.sort((a, b) => {
    const countsA = counts.get(a)!;
    const countsB = counts.get(b)!;
    for (let rank = 0; rank < severityRank.length; rank++) {
      const difference = countsB[rank] - countsA[rank];
      if (difference !== 0) return difference;
    }
    return name(a).localeCompare(name(b));
  });
}

// The lowest version that fixes the CVE for the installed version. A finding can list fixes
// for several release lines, of which only the ones above the installed version apply.
function fixVersionFor(match: VulnerabilityManifest.Match): string | undefined {
  const versions = [...(match.vulnerability.fix?.versions ?? [])].sort(compareVersions);
  return (
    versions.find(version => compareVersions(version, match.artifact.version) > 0) ?? versions[0]
  );
}

/**
 * Groups the fixable findings of the images by package, with the version that fixes all CVEs
 * of the package. Ordered by the CVEs an upgrade removes, most critical first.
 *
 * @param relevantOnly - Only count CVEs found relevant for a workload running the image.
 *                       Images without relevancy data keep all their CVEs.
 */
export function getPackageUpgrades(
  workloadScans: WorkloadScan[],
  relevantOnly: boolean = false
): PackageUpgrade[] {
  const upgrades: PackageUpgrade[] = [];
  const workloadsByImage = new Map<string, WorkloadScan[]>();
  for (const w of workloadScans) {
    if (!w.imageScan) continue;
    const key = getImageScanKey(w.imageScan);
    const imageWorkloads = workloadsByImage.get(key);
    if (imageWorkloads) imageWorkloads.push(w);
    else workloadsByImage.set(key, [w]);
  }

  for (const imageScan of getImageScans(workloadScans)) {
    const imageWorkloads = workloadsByImage.get(getImageScanKey(imageScan)) ?? [];
    const workloadNames = [...new Set(imageWorkloads.map(w => `${w.name}/${w.container}`))];
    const relevantScans = imageWorkloads.flatMap(w => (w.relevant ? [w.relevant] : []));
    const relevantIds = new Set(
      relevantScans.flatMap(scan => scan.matches.map(m => m.vulnerability.id))
    );

    const byPackage = new Map<string, PackageUpgrade>();
    for (const match of imageScan.matches) {
      const fixVersion = match.vulnerability.fix?.state === 'fixed' && fixVersionFor(match);
      if (!fixVersion) continue;
      if (relevantOnly && relevantScans.length > 0 && !relevantIds.has(match.vulnerability.id)) {
        continue;
      }

      const key = `${match.artifact.name}@${match.artifact.version}`;
      let upgrade = byPackage.get(key);
      if (!upgrade) {
        upgrade = {
          imageScan,
          packageName: match.artifact.name,
          installedVersion: match.artifact.version,
          fixVersion,
          cves: new Map(),
          workloads: workloadNames,
        };
        byPackage.set(key, upgrade);
      }
      if (compareVersions(fixVersion, upgrade.fixVersion) > 0) upgrade.fixVersion = fixVersion;
      upgrade.cves.set(match.vulnerability.id, match.vulnerability.severity);
    }
    upgrades.push(...byPackage.values());
  }

  return sortBySeverity(upgrades, upgrade => upgrade.packageName);
}

/**
 * The package upgrades grouped by image, with the CVEs they fix together, the image whose
 * upgrades fix the most critical CVEs first. Packages of one image often fix the same CVEs,
 * such as the libraries an application bundles, so an image is counted once.
 */
export function getImageUpgrades(
  workloadScans: WorkloadScan[],
  relevantOnly: boolean = false
): ImageUpgrade[] {
  const images = new Map<string, ImageUpgrade>();
  for (const upgrade of getPackageUpgrades(workloadScans, relevantOnly)) {
    const key = getImageScanKey(upgrade.imageScan);
    let image = images.get(key);
    if (!image) {
      image = {
        imageScan: upgrade.imageScan,
        cves: new Map(),
        packages: [],
        workloads: upgrade.workloads,
      };
      images.set(key, image);
    }
    image.packages.push(upgrade);
    upgrade.cves.forEach((severity, id) => image!.cves.set(id, severity));
  }
  return sortBySeverity([...images.values()], image => image.imageScan.imageName);
}
