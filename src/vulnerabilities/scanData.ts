import type { QueryTask } from '../query';
import type { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import type { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { getVulnerabilityReportCreatedAt } from './reportTimestamp';

export interface ImageScan {
  manifestName: string;
  namespace: string;
  cluster: string;
  imageName: string;
  creationTimestamp: string;
  reportCreatedAt?: string;
  matches: VulnerabilityManifest.Match[];
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

export function toImageScan(manifest: VulnerabilityManifest): ImageScan {
  return {
    manifestName: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    cluster: manifest.metadata.cluster,
    imageName: manifest.metadata.annotations['kubescape.io/image-tag'],
    creationTimestamp: manifest.metadata.creationTimestamp,
    reportCreatedAt: getVulnerabilityReportCreatedAt(manifest),
    matches: manifest.spec.payload.matches ?? [],
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
  const all = getManifestReferenceKey(cluster, summary.spec.vulnerabilitiesRef?.all);
  const relevant = getManifestReferenceKey(cluster, summary.spec.vulnerabilitiesRef?.relevant);
  return {
    manifestName: summary.metadata.name,
    name: summary.metadata.labels['kubescape.io/workload-name'],
    namespace: summary.metadata.labels['kubescape.io/workload-namespace'],
    cluster,
    container: summary.metadata.labels['kubescape.io/workload-container-name'],
    kind: summary.metadata.labels['kubescape.io/workload-kind'],
    imageScan: all ? images.get(all) : undefined,
    relevant: relevant ? images.get(relevant) : undefined,
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
