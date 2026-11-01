import type { QueryTask } from '../query';
import type { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import type { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { getScanTime, getVulnerabilityReportCreatedAt } from './reportTimestamp';

export interface ImageScan {
  manifestName: string;
  namespace: string;
  cluster: string;
  imageName: string;
  creationTimestamp: string;
  reportCreatedAt?: string;
  matches: VulnerabilityManifest.Match[];
  // the findings that kubevuln hid because of a security exception
  ignoredMatches?: VulnerabilityManifest.IgnoredMatch[];
}

export interface WorkloadScan {
  manifestName: string;
  name: string;
  kind: string;
  container: string;
  namespace: string;
  cluster: string;
  imageScan: ImageScan | undefined;
  relevant: ImageScan | undefined;
  // when kubevuln last scanned the container
  scannedAt?: string;
}

export function getImageScanKey(image: Pick<ImageScan, 'cluster' | 'namespace' | 'manifestName'>) {
  return JSON.stringify([image.cluster, image.namespace, image.manifestName]);
}

export function getManifestNamespace(reference: { namespace?: string }) {
  return reference.namespace || 'kubescape';
}

export function getManifestReferenceKey(
  cluster: string,
  reference?: { name?: string; namespace?: string } | null
) {
  return reference?.name
    ? getImageScanKey({
        cluster,
        namespace: getManifestNamespace(reference),
        manifestName: reference.name,
      })
    : undefined;
}

// The reports of each cluster by name, built again when reports were added
const reportsByName = new WeakMap<
  Map<string, ImageScan>,
  { size: number; byName: Map<string, ImageScan> }
>();

function findReportByName(images: Map<string, ImageScan>, cluster: string, name: string) {
  let index = reportsByName.get(images);
  if (!index || index.size !== images.size) {
    const byName = new Map<string, ImageScan>();
    for (const image of images.values()) {
      byName.set(JSON.stringify([image.cluster, image.manifestName]), image);
    }
    index = { size: images.size, byName };
    reportsByName.set(images, index);
  }
  return index.byName.get(JSON.stringify([cluster, name]));
}

/**
 * The report a summary refers to. Kubescape storage keeps the reports in the operator
 * namespace while summaries can refer to the namespace of their workload, so a report that is
 * not in the referenced namespace is looked up by its name, which is unique in a cluster.
 */
export function findImageScan(
  images: Map<string, ImageScan>,
  cluster: string,
  reference?: { name?: string; namespace?: string } | null
): ImageScan | undefined {
  const key = getManifestReferenceKey(cluster, reference);
  if (!key || !reference?.name) return undefined;
  return images.get(key) ?? findReportByName(images, cluster, reference.name);
}

export function toImageScan(manifest: VulnerabilityManifest): ImageScan {
  return {
    manifestName: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    cluster: manifest.metadata.cluster,
    imageName: manifest.metadata.annotations['kubescape.io/image-tag'],
    creationTimestamp: manifest.metadata.creationTimestamp,
    reportCreatedAt: getVulnerabilityReportCreatedAt(manifest),
    matches: (manifest.spec.payload.matches ?? []).map(slimMatch),
    ignoredMatches: manifest.spec.payload.ignoredMatches?.map(match => ({
      ...slimMatch(match),
      appliedIgnoreRules: match.appliedIgnoreRules,
    })),
  };
}

/**
 * The fields of a match that the pages show. The scanner also stores how each match was
 * found and where the package is, which is most of a manifest; the cache keeps only these,
 * so the rest can be freed.
 */
function slimMatch(match: VulnerabilityManifest.Match): VulnerabilityManifest.Match {
  const { vulnerability, artifact, relatedVulnerabilities } = match;
  return {
    artifact: { name: artifact?.name, version: artifact?.version },
    relatedVulnerabilities: relatedVulnerabilities?.map(({ id, description }) => ({
      id,
      description,
    })),
    vulnerability: {
      id: vulnerability.id,
      severity: vulnerability.severity,
      description: vulnerability.description,
      dataSource: vulnerability.dataSource,
      fix: vulnerability.fix,
      cvss: vulnerability.cvss?.map(({ metrics }) => ({
        metrics: { baseScore: metrics?.baseScore },
      })),
    },
  };
}

export function getImageScans(workloadScans: WorkloadScan[]): ImageScan[] {
  const images = new Map<string, ImageScan>();
  workloadScans.forEach(({ imageScan }) => {
    if (imageScan) images.set(getImageScanKey(imageScan), imageScan);
  });
  return Array.from(images.values());
}

export function toWorkloadScan(
  summary: VulnerabilityManifestSummary,
  images: Map<string, ImageScan>
): WorkloadScan {
  const cluster = summary.metadata.cluster;
  return {
    manifestName: summary.metadata.name,
    name: summary.metadata.labels['kubescape.io/workload-name'],
    namespace: summary.metadata.labels['kubescape.io/workload-namespace'],
    cluster,
    container: summary.metadata.labels['kubescape.io/workload-container-name'],
    kind: summary.metadata.labels['kubescape.io/workload-kind'],
    imageScan: findImageScan(images, cluster, summary.spec.vulnerabilitiesRef?.all),
    relevant: findImageScan(images, cluster, summary.spec.vulnerabilitiesRef?.relevant),
    scannedAt: getScanTime(summary),
  };
}

export interface VulnerabilityContext {
  workloadScans: WorkloadScan[];
  imageScans: Map<string, ImageScan>;
  queryTasks: QueryTask[];
}

export function invalidateScanClusters(
  context: VulnerabilityContext,
  clusters: string[],
  isNamespaceUpdated: (task: QueryTask) => boolean
) {
  const invalidated = new Set(
    context.queryTasks
      .filter(task => !clusters.includes(task.cluster) || isNamespaceUpdated(task))
      .map(task => task.cluster)
  );
  context.queryTasks = context.queryTasks.filter(task => !invalidated.has(task.cluster));
  context.workloadScans = context.workloadScans.filter(scan => !invalidated.has(scan.cluster));
  context.imageScans.forEach((scan, key) => {
    if (invalidated.has(scan.cluster)) context.imageScans.delete(key);
  });
}
