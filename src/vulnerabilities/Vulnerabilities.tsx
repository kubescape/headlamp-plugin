/* 
  Overview page for vulnerability issues, workloads and images. 
*/
import { ApiError } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
  Tabs as HeadlampTabs,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { RotatingLines } from 'react-loader-spinner';
import { isNewClusterContext } from '../common/clusterContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { ProgressIndicator } from '../common/ProgressIndicator';
import makeSeverityLabel from '../common/SeverityLabel';
import { RoutingName } from '../index';
import { fetchVulnerabilities, ImageScan, WorkloadScan } from './fetch-vulnerabilities';
import ImageListView from './ImageList';
import WorkloadScanListView from './ResourceList';

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

// workloadScans are cached in global scope because it is an expensive query for the API server
type VulnerabilityContext = {
  workloadScans: WorkloadScan[];
  imageScans: Map<string, ImageScan>;
  currentCluster: string;
  vulnerabilityManifestContinuation: number | undefined;
  vulnerabilityManifestSummaryContinuation: number | undefined;
  pageSize: number;
  allowedNamespaces: string[];
  selectedTab: number;
};

export const vulnerabilityContext: VulnerabilityContext = {
  workloadScans: [],
  imageScans: new Map<string, ImageScan>(),
  currentCluster: '',
  vulnerabilityManifestContinuation: 0,
  vulnerabilityManifestSummaryContinuation: 0,
  pageSize: 50,
  allowedNamespaces: [],
  selectedTab: 0,
};

export default function KubescapeVulnerabilities() {
  const [workloadScanData, setWorkloadScanData] = useState<WorkloadScan[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');
  const continueReading = useRef(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (
        isNewClusterContext(
          vulnerabilityContext.currentCluster,
          vulnerabilityContext.allowedNamespaces
        )
      ) {
        vulnerabilityContext.vulnerabilityManifestContinuation = 0;
        vulnerabilityContext.vulnerabilityManifestSummaryContinuation = 0;
        vulnerabilityContext.currentCluster = getCluster() ?? '';
        vulnerabilityContext.allowedNamespaces = getAllowedNamespaces();
      }

      await fetchVulnerabilities(continueReading, setProgressMessage, setLoading, setError);

      setWorkloadScanData(vulnerabilityContext.workloadScans);
    };

    fetchData().catch(console.error);
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
          {vulnerabilityContext.vulnerabilityManifestSummaryContinuation !== undefined && (
            <Button
              onClick={() => {
                setTimeout(() => {
                  continueReading.current = true;
                  fetchVulnerabilities(continueReading, setProgressMessage, setLoading, setError);
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
          defaultIndex={vulnerabilityContext.selectedTab}
          onTabChanged={tabIndex => (vulnerabilityContext.selectedTab = tabIndex)}
          tabs={[
            {
              label: 'CVEs',
              component: <CVEListView loading={loading} workloadScans={workloadScanData} />,
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

function CVEListView(props: Readonly<{ loading: boolean; workloadScans: WorkloadScan[] | null }>) {
  const { loading, workloadScans } = props;
  const [isRelevantCVESwitchChecked, setIsRelevantCVESwitchChecked] = useState(false);
  const [isFixedCVESwitchChecked, setIsFixedCVESwitchChecked] = useState(false);

  if (loading || !workloadScans)
    return (
      <Box sx={{ padding: 2 }}>
        <RotatingLines />
      </Box>
    );

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
      <SectionBox>
        <HeadlampTable
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
              accessorFn: (item: CVEScan) => (
                <div style={{ whiteSpace: 'pre-line' }}>
                  {Array.from(item.artifacts).join('\n')}
                </div>
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
          ]}
          initialState={{
            sorting: [
              {
                id: 'Score',
                desc: true,
              },
            ],
          }}
        />
      </SectionBox>
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
