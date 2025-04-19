/* 
  Query vulnerabilty data and rework data into VulnerabilityModel for easier processing in the views. 
*/
import { ApiError } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import {
  paginatedListQuery,
  vulnerabilityManifestClass,
  vulnerabilityManifestSummaryClass,
} from '../model';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { vulnerabilityContext } from './Vulnerabilities';

const pageSize: number = 50;

// WorkloadScan is derived from VulnerabilityManifestSummary
export interface WorkloadScan {
  manifestName: string;
  name: string;
  kind: string;
  container: string;
  namespace: string;
  imageScan: ImageScan | undefined;
  relevant: ImageScan | undefined;
}

// ImageScan is derived from VulnerabilityManifest
export interface ImageScan {
  manifestName: string;
  namespace: string;
  imageName: string;
  creationTimestamp: string;
  matches: VulnerabilityManifest.Match[];
}

// Query vulnerabilitymanifestsummaries and vulnerabilitymanifests
// Convert the retrieved data to WorkloadScan and ImageScan
async function fetchVulnerabilityManifestSummaries(
  continueReading: React.MutableRefObject<boolean>,
  setProgress: (progress: string) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: ApiError | null) => void
): Promise<void> {
  while (
    continueReading.current &&
    vulnerabilityContext.vulnerabilityManifestSummaryContinuation !== undefined
  ) {
    setLoading(true);

    await paginatedListQuery(
      vulnerabilityManifestSummaryClass,
      vulnerabilityContext.vulnerabilityManifestSummaryContinuation,
      pageSize,
      getAllowedNamespaces()
    )
      .then(response => {
        const { items, continuation } = response;

        vulnerabilityContext.vulnerabilityManifestSummaryContinuation = continuation;

        for (const item of items) {
          const detailedSummary: VulnerabilityManifestSummary = item;
          const w: WorkloadScan = {
            manifestName: detailedSummary.metadata.name,
            name: detailedSummary.metadata.labels['kubescape.io/workload-name'],
            namespace: detailedSummary.metadata.labels['kubescape.io/workload-namespace'],
            container: detailedSummary.metadata.labels['kubescape.io/workload-container-name'],
            kind: detailedSummary.metadata.labels['kubescape.io/workload-kind'],
            imageScan: undefined,
            relevant: undefined,
          };
          vulnerabilityContext.workloadScans.push(w);

          if (detailedSummary.spec.vulnerabilitiesRef?.all?.name) {
            w.imageScan = vulnerabilityContext.imageScans.get(
              detailedSummary.spec.vulnerabilitiesRef.all.name
            );
          }
          if (detailedSummary.spec.vulnerabilitiesRef?.relevant?.name) {
            w.relevant = vulnerabilityContext.imageScans.get(
              detailedSummary.spec.vulnerabilitiesRef.relevant.name
            );
          }
        }
      })
      .catch(error => {
        continueReading.current = false;
        setError(error);
      });
    if (vulnerabilityContext.vulnerabilityManifestSummaryContinuation !== undefined) {
      setProgress(
        `Reading ${vulnerabilityContext.workloadScans.length} VulnerabilityManifestSummaries...`
      );
    }
  }
  setLoading(false);
}

/**
 * Fetch VulnerabilityManifests and convert them to ImageScan objects.
 *
 * TODO Improve - All vulnerability manifests are fetched, however this is not OK when the user has limited namespace access. Improve when the VulnerabilityManifest are stored in the workload namespace by the operator.
 *
 * This function will continue fetching until the user stops it or the end is reached.
 * It will also update the progress message.
 */
async function fetchVulnerabilityManifests(
  continueReading: React.MutableRefObject<boolean>,
  setProgress: (progress: string) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: ApiError | null) => void
): Promise<void> {
  while (
    continueReading.current &&
    vulnerabilityContext.vulnerabilityManifestContinuation !== undefined
  ) {
    setLoading(true);

    await paginatedListQuery(
      vulnerabilityManifestClass,
      vulnerabilityContext.vulnerabilityManifestContinuation,
      pageSize
    )
      .then(response => {
        const { items, continuation } = response;

        vulnerabilityContext.vulnerabilityManifestContinuation = continuation;

        for (const v of items) {
          const imageScan: ImageScan = {
            manifestName: v.metadata.name,
            namespace: v.metadata.namespace,
            imageName: v.metadata.annotations['kubescape.io/image-tag'],
            creationTimestamp: v.metadata.creationTimestamp,
            matches: v.spec.payload.matches ?? [],
          };

          vulnerabilityContext.imageScans.set(v.metadata.name, imageScan);
        }
      })
      .catch(error => {
        continueReading.current = false;
        setError(error);
      });
    if (vulnerabilityContext.vulnerabilityManifestContinuation !== undefined) {
      setProgress(`Reading ${vulnerabilityContext.imageScans.size} VulnerabilityManifests...`);
    }
  }
  setLoading(false);
}

export async function fetchVulnerabilities(
  continueReading: React.MutableRefObject<boolean>,
  setProgressMessage: (progress: string) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: ApiError | null) => void
): Promise<void> {
  await fetchVulnerabilityManifests(continueReading, setProgressMessage, setLoading, setError);
  await fetchVulnerabilityManifestSummaries(
    continueReading,
    setProgressMessage,
    setLoading,
    setError
  );
}
