/* 
  Overview page for vulnerability issues, workloads and images. 
*/
import { Icon } from '@iconify/react';
import { ApiError } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
  Tabs as HeadlampTabs,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { isAllowedNamespaceUpdated } from '../common/clusterContext';
import { KubescapeConfig, kubescapeConfigStore } from '../common/config-store';
import { ErrorMessage } from '../common/ErrorMessage';
import { ProgressIndicator } from '../common/ProgressIndicator';
import {
  getItemFromSessionStorage,
  KubescapeSettings,
  setItemInSessionStorage,
  useSessionStorage,
} from '../common/sessionStorage';
import makeSeverityLabel from '../common/SeverityLabel';
import HeadlampTable from '../common/Table';
import { GuidedClusterVulnerabilityExceptionForm } from '../exceptions/GuidedClusterVulnerabilityExceptionForm';
import { RoutingName, useHLSelectedClusters } from '../index';
import { vulnerabilityManifestClass, vulnerabilityManifestSummaryClass } from '../model';
import { handleListPaginationTasks, QueryTask } from '../query';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import ImageListView from './ImageList';
import WorkloadScanListView from './ResourceList';
import {
  getImageScanKey,
  ImageScan,
  invalidateScanClusters,
  toImageScan,
  toWorkloadScan,
  VulnerabilityContext,
  WorkloadScan,
} from './scanData';

export type { ImageScan, WorkloadScan } from './scanData';

interface CVEScan {
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

// A VulnerabilityManifestSummary holds counts and two references, about a kilobyte
const summaryPageSize = 500;

// workloadScans are cached in global scope because it is an expensive query for the API server
export const vulnerabilityContext: VulnerabilityContext = {
  workloadScans: [],
  imageScans: new Map<string, ImageScan>(),
  queryTasks: [],
};

export default function KubescapeVulnerabilities() {
  const pluginConfig = kubescapeConfigStore.useConfig();
  const kubescapeConfig = pluginConfig() as KubescapeConfig;

  const [workloadScanData, setWorkloadScanData] = useState<WorkloadScan[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');
  const continueReading = useRef(true);
  const [error, setError] = useState<ApiError | null>(null);
  const clusters = useHLSelectedClusters();

  useEffect(() => {
    const fetchData = async () => {
      initQueryTasks(clusters, setProgressMessage, kubescapeConfig);

      await handleListPaginationTasks(vulnerabilityContext.queryTasks, continueReading, setLoading);

      setWorkloadScanData([...vulnerabilityContext.workloadScans]);
    };

    fetchData().catch(error => setError(error));
    return () => {
      continueReading.current = false;
    };
  }, []);

  return (
    <>
      <h1>Vulnerabilities</h1>
      {error && <ErrorMessage error={error} />}
      {!error && !loading && (
        <Stack direction="row" spacing={2}>
          <Typography variant="body1" component="div">
            {vulnerabilityContext.workloadScans.length} scans{' '}
          </Typography>
          {vulnerabilityContext.queryTasks.some(q => q.continuation !== undefined) && (
            <Button
              onClick={() => {
                // show the scans that were read in addition to the ones already shown
                setTimeout(async () => {
                  continueReading.current = true;
                  await handleListPaginationTasks(
                    vulnerabilityContext.queryTasks,
                    continueReading,
                    setLoading
                  );
                  setWorkloadScanData([...vulnerabilityContext.workloadScans]);
                });
              }}
              variant="contained"
              sx={{ padding: 1 }}
            >
              More scans
            </Button>
          )}
        </Stack>
      )}

      {!error && loading && (
        <Box sx={{ padding: 2 }}>
          <ProgressIndicator continueReading={continueReading} progressMessage={progressMessage} />
        </Box>
      )}

      {!error && !loading && workloadScanData && (
        <HeadlampTabs
          defaultIndex={getItemFromSessionStorage(KubescapeSettings.VulnerabilityTab) ?? 0}
          onTabChanged={tabIndex =>
            setItemInSessionStorage(KubescapeSettings.VulnerabilityTab, tabIndex)
          }
          tabs={[
            {
              label: 'CVEs',
              component: <CVEListView workloadScans={workloadScanData} />,
            },
            {
              label: 'Resources',
              component: <WorkloadScanListView workloadScans={workloadScanData} />,
            },
            {
              label: 'Images',
              component: <ImageListView workloadScans={workloadScanData} />,
            },
          ]}
          ariaLabel="Navigation Tabs"
        />
      )}
    </>
  );
}

function CVEListView(props: Readonly<{ workloadScans: WorkloadScan[] }>) {
  const { workloadScans } = props;
  const [isRelevantCVESwitchChecked, setIsRelevantCVESwitchChecked] = useSessionStorage<boolean>(
    KubescapeSettings.RelevantCVEs,
    false
  );
  const [isFixedCVESwitchChecked, setIsFixedCVESwitchChecked] = useSessionStorage<boolean>(
    KubescapeSettings.FixedCVEs,
    false
  );
  const [selectedCve, setSelectedCve] = useState<string | null>(null);

  const cveList = getCVEList(workloadScans);

  let cveListFiltered = cveList;
  if (isRelevantCVESwitchChecked)
    cveListFiltered = cveListFiltered.filter(cve => cve.relevant === undefined || cve.relevant);
  if (isFixedCVESwitchChecked) cveListFiltered = cveListFiltered.filter(cve => cve.fixed);

  return (
    <>
      <h5>
        {workloadScans.length} workload scans, {cveListFiltered.length} CVE issues
      </h5>
      <SectionBox>
        <HeadlampTable
          toolbarStart={
            <>
              <FormControlLabel
                checked={isRelevantCVESwitchChecked}
                control={<Switch color="primary" />}
                label={'Relevant'}
                onChange={(event: any, checked: boolean) => {
                  setIsRelevantCVESwitchChecked(checked);
                }}
              />
              <FormControlLabel
                checked={isFixedCVESwitchChecked}
                control={<Switch color="primary" />}
                label={'Fixed'}
                onChange={(event: any, checked: boolean) => {
                  setIsFixedCVESwitchChecked(checked);
                }}
              />
            </>
          }
          csvExport={{
            fileName: 'kubescape-cves.csv',
            header: [
              'CVE',
              'Severity',
              'CVSS',
              'Components',
              'Relevant',
              'Fixed',
              'Images',
              'Workloads',
              'Description',
            ],
            rows: () =>
              cveListFiltered.map(cve => [
                cve.CVE,
                cve.severity,
                cve.baseScore,
                Array.from(cve.artifacts).join('; '),
                cve.relevant === undefined ? 'Unknown' : cve.relevant ? 'Yes' : 'No',
                cve.fixed ? 'Yes' : 'No',
                Array.from(cve.images).join('; '),
                Array.from(cve.workloads).join('; '),
                cve.description,
              ]),
          }}
          data={cveListFiltered}
          columns={[
            {
              header: 'Severity',
              accessorFn: (item: CVEScan) => item.severity,
              Cell: ({ cell }: any) => makeSeverityLabel(cell.row.original.severity),
              gridTemplate: '0.2fr',
            },
            {
              header: 'CVE ID',
              accessorFn: (item: CVEScan) => item.CVE,
              Cell: ({ cell }: any) => (
                <HeadlampLink
                  routeName={RoutingName.KubescapeCVEResults}
                  params={{
                    cve: cell.getValue(),
                  }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
              gridTemplate: 'auto',
            },
            {
              id: 'Score',
              header: 'CVSS',
              accessorFn: (item: CVEScan) => item.baseScore,
              gridTemplate: 'min-content',
            },
            {
              header: 'Component',
              // text, so the table can search and sort it
              accessorFn: (item: CVEScan) => Array.from(item.artifacts).join('\n'),
              Cell: ({ cell }: any) => (
                <div style={{ whiteSpace: 'pre-line' }}>{cell.getValue()}</div>
              ),
              gridTemplate: 'auto',
            },
            {
              header: 'Relevant',
              accessorFn: (item: CVEScan) =>
                item.relevant === undefined ? 'Unknown' : item.relevant ? 'Yes' : 'No',
              gridTemplate: '1fr',
            },
            {
              header: 'Fixed',
              accessorFn: (item: CVEScan) => (item.fixed ? 'Yes' : ''),
              gridTemplate: '1fr',
            },
            {
              header: 'Images',
              accessorFn: (item: CVEScan) => item.images.size,
              gridTemplate: 'min-content',
            },
            {
              header: 'Workloads',
              accessorFn: (item: CVEScan) => item.workloads.size,
              Cell: ({ cell, row }: any) => (
                <HeadlampLink
                  routeName={RoutingName.KubescapeCVEResults}
                  params={{
                    cve: row.original.CVE,
                  }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
              gridTemplate: 'min-content',
            },
            {
              header: 'Description',
              accessorKey: 'description',
              Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
              gridTemplate: 'auto',
            },
            {
              header: '',
              accessorFn: (item: CVEScan) => (
                <Tooltip title="Exclude CVE cluster-wide">
                  <IconButton size="small" onClick={() => setSelectedCve(item.CVE)}>
                    <Icon icon="mdi:shield-plus-outline" />
                  </IconButton>
                </Tooltip>
              ),
              gridTemplate: 'min-content',
            },
          ]}
          initialState={{
            sorting: [
              {
                id: 'Score',
                desc: true,
              },
            ],
          }}
          reflectInURL="cve"
        />
      </SectionBox>

      {selectedCve && (
        <GuidedClusterVulnerabilityExceptionForm
          cveId={selectedCve}
          onClose={() => setSelectedCve(null)}
        />
      )}
    </>
  );
}

// create a list of CVE-ID with affected workloads and images
function getCVEList(workloadScans: WorkloadScan[]): CVEScan[] {
  const vulnerabilityList: CVEScan[] = [];

  for (const workloadScan of workloadScans) {
    if (workloadScan.imageScan?.matches) {
      for (const match of workloadScan.imageScan.matches) {
        const cve = vulnerabilityList.find(element => element.CVE === match.vulnerability.id);

        const isRelevant = workloadScan.relevant?.matches?.some(
          match => match.vulnerability.id === cve?.CVE
        );

        if (cve) {
          cve.workloads.add(workloadScan.name + '/' + workloadScan.container);
          cve.images.add(workloadScan.imageScan.imageName);
          cve.artifacts.add(match.artifact.name + ' ' + match.artifact.version);

          cve.fixed = cve.fixed || !!match.vulnerability.fix?.versions;
          cve.relevant = cve.relevant || isRelevant;
        } else {
          const newCve: CVEScan = {
            CVE: match.vulnerability.id,
            description: match.vulnerability.description,
            severity: match.vulnerability.severity,
            baseScore: match.vulnerability.cvss ? match.vulnerability.cvss[0].metrics.baseScore : 0,
            workloads: new Set<string>(),
            images: new Set<string>(),
            artifacts: new Set<string>(),
            fixed: !!match.vulnerability.fix?.versions,
            relevant: isRelevant,
          };

          // if vulnerability has no description, try get it from related
          if (!newCve.description && match.relatedVulnerabilities) {
            newCve.description = match.relatedVulnerabilities
              .filter(rv => rv.id === newCve.CVE)
              .map(rv => rv.description)
              .join();
          }

          newCve.workloads.add(workloadScan.name + '/' + workloadScan.container);
          newCve.images.add(workloadScan.imageScan.imageName);
          newCve.artifacts.add(match.artifact.name + ' ' + match.artifact.version);

          vulnerabilityList.push(newCve);
        }
      }
    }
  }

  return vulnerabilityList;
}

function initQueryTasks(
  clusters: string[],
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>,
  kubescapeConfig: KubescapeConfig
) {
  const storeVulnerabilityManifests = (task: QueryTask, items: VulnerabilityManifest[]) => {
    for (const v of items) {
      const imageScan = toImageScan(v);
      vulnerabilityContext.imageScans.set(getImageScanKey(imageScan), imageScan);
    }
    setProgressMessage(
      `${task.cluster}: Reading ${vulnerabilityContext.imageScans.size} Images...`
    );
  };

  const storeVulnerabilityManifestSummaries = (
    task: QueryTask,
    items: VulnerabilityManifestSummary[]
  ) => {
    for (const item of items) {
      const workload = toWorkloadScan(item, vulnerabilityContext.imageScans);
      if (!workload.name || !workload.namespace) continue; // invalid summary from kubescape
      vulnerabilityContext.workloadScans.push(workload);
    }

    setProgressMessage(
      `${task.cluster}: Reading ${vulnerabilityContext.workloadScans.length} Workloads...`
    );
  };

  invalidateScanClusters(vulnerabilityContext, clusters, isAllowedNamespaceUpdated);

  // add new query tasks
  for (const cluster of clusters) {
    if (!vulnerabilityContext.queryTasks.find(q => q.cluster === cluster)) {
      console.log(`new query task for scans for ${cluster}`);

      const task = {
        cluster: cluster,
        allowedNamespaces: getAllowedNamespaces(cluster),
        continuation: '',
        pageSize: kubescapeConfig?.pageSize || 50,
      };
      vulnerabilityContext.queryTasks.push({
        ...task,
        objectClass: vulnerabilityManifestClass,
        handleData: storeVulnerabilityManifests,
      });
      vulnerabilityContext.queryTasks.push({
        ...task,
        // summaries are small, so they are read in larger pages than the manifests
        pageSize: Math.max(task.pageSize, summaryPageSize),
        objectClass: vulnerabilityManifestSummaryClass,
        handleData: storeVulnerabilityManifestSummaries,
      });
    }
  }

  return vulnerabilityContext.queryTasks;
}
