/* 
  Overview page for vulnerability issues, workloads and images. 
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
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
import { useEffect, useState } from 'react';
import { RotatingLines } from 'react-loader-spinner';
import makeSeverityLabel from '../common/SeverityLabel';
import { RoutingName } from '../index';
import { listQuery, vulnerabilityManifestSummaryClass } from '../model';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { fetchVulnerabilityManifests, WorkloadScan } from './fetch-vulnerabilities';
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
  currentCluster: string | null;
  summaries: VulnerabilityManifestSummary[];
  indexSummary: number;
  summaryFetchItems: number;
  allowedNamespaces: string[];
  selectedTab: number;
  kubescapeNamespace: string;
};

export const vulnerabilityContext: VulnerabilityContext = {
  workloadScans: [],
  currentCluster: '',
  summaries: [],
  indexSummary: 0,
  summaryFetchItems: 20,
  allowedNamespaces: [],
  selectedTab: 0,
  kubescapeNamespace: '',
};

export default function KubescapeVulnerabilities() {
  const [workloadScans, setWorkloadScans] = useState<WorkloadScan[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const arraysEqual = (a: string[], b: string[]) =>
      a.length === b.length && a.every((element, index) => element === b[index]);

    if (
      vulnerabilityContext.currentCluster !== getCluster() || // check if user switched to another cluster
      !arraysEqual(getAllowedNamespaces(), vulnerabilityContext.allowedNamespaces) // check if user changed namespace selection
    ) {
      const fetchData = async () => {
        const kubescapePods: any[0] = await request(
          `/api/v1/pods?labelSelector=${encodeURI(
            'app.kubernetes.io/component=kubescape,app.kubernetes.io/instance=kubescape'
          )}`
        );
        if (kubescapePods?.items.length === 0) {
          console.error('Could not find Kubescape operator in cluster');
          return;
        }
        vulnerabilityContext.summaries = await listQuery(vulnerabilityManifestSummaryClass);
        vulnerabilityContext.currentCluster = getCluster();
        vulnerabilityContext.allowedNamespaces = getAllowedNamespaces();
        vulnerabilityContext.kubescapeNamespace = kubescapePods.items[0].metadata.namespace;

        vulnerabilityContext.indexSummary =
          vulnerabilityContext.summaryFetchItems > vulnerabilityContext.summaries.length
            ? vulnerabilityContext.summaries.length
            : vulnerabilityContext.summaryFetchItems;

        fetchVulnerabilityManifests(
          vulnerabilityContext.summaries.slice(0, vulnerabilityContext.indexSummary),
          vulnerabilityContext.kubescapeNamespace
        ).then(response => {
          vulnerabilityContext.workloadScans = response;

          setWorkloadScans(vulnerabilityContext.workloadScans);
          setLoading(false);
        });
      };

      fetchData().catch(console.error);
    } else {
      setWorkloadScans(vulnerabilityContext.workloadScans);
    }
  }, []);

  return (
    <>
      <h1>Vulnerabilities</h1>
      <Stack direction="row" spacing={2}>
        <Typography variant="body1" component="div" sx={{ flexGrow: 1 }}>
          Reading {vulnerabilityContext.indexSummary} of {vulnerabilityContext.summaries.length}{' '}
          scans
        </Typography>
        <MoreButton setLoading={setLoading} setWorkloadScans={setWorkloadScans} title="Read more" />
        <MoreButton
          setLoading={setLoading}
          setWorkloadScans={setWorkloadScans}
          title="All"
          readToEnd
        />
      </Stack>
      <HeadlampTabs
        defaultIndex={vulnerabilityContext.selectedTab}
        onTabChanged={tabIndex => (vulnerabilityContext.selectedTab = tabIndex)}
        tabs={[
          {
            label: 'CVEs',
            component: <CVEListView loading={loading} workloadScans={workloadScans} />,
          },
          {
            label: 'Resources',
            component: <WorkloadScanListView workloadScans={workloadScans} />,
          },
          {
            label: 'Images',
            component: <ImageListView workloadScans={workloadScans} />,
          },
        ]}
        ariaLabel="Navigation Tabs"
      />
    </>
  );
}

function CVEListView(props: { loading: boolean; workloadScans: WorkloadScan[] | null }) {
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

function MoreButton(props: {
  setLoading: any;
  setWorkloadScans: any;
  title: string;
  readToEnd?: boolean;
}) {
  const { setLoading, setWorkloadScans, title, readToEnd } = props;

  return (
    <Button
      disabled={vulnerabilityContext.indexSummary === vulnerabilityContext.summaries.length}
      onClick={() => {
        const currentIndex = vulnerabilityContext.indexSummary;
        if (readToEnd) {
          vulnerabilityContext.indexSummary = vulnerabilityContext.summaries.length;
        } else {
          vulnerabilityContext.indexSummary =
            currentIndex + vulnerabilityContext.summaryFetchItems >
            vulnerabilityContext.summaries.length
              ? vulnerabilityContext.summaries.length
              : currentIndex + vulnerabilityContext.summaryFetchItems;
        }

        setLoading(true);
        setTimeout(() =>
          fetchVulnerabilityManifests(
            vulnerabilityContext.summaries.slice(currentIndex, vulnerabilityContext.indexSummary),
            vulnerabilityContext.kubescapeNamespace
          ).then(response => {
            if (!vulnerabilityContext.workloadScans) vulnerabilityContext.workloadScans = response;
            else
              vulnerabilityContext.workloadScans =
                vulnerabilityContext.workloadScans?.concat(response);

            setWorkloadScans(vulnerabilityContext.workloadScans);
            setLoading(false);
          })
        );
      }}
      variant="contained"
    >
      {title}
    </Button>
  );
}
