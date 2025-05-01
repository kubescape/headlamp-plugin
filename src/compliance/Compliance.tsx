/* 
  Overview  page for configuration controls and resources. 
*/
import {
  Link as HeadlampLink,
  SectionBox,
  Table,
  Tabs as HeadlampTabs,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Box,
  Button,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { isNewClusterContext } from '../common/clusterContext';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { StatusLabel, StatusLabelProps } from '../common/StatusLabel';
import { KubescapeSettings, useLocalStorage } from '../common/webStorage';
import { RoutingName } from '../index';
import { paginatedListQuery, workloadConfigurationScanSummaryClass } from '../model';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { Control, FrameWork } from './FrameWork';
import { FrameworkButtons } from './FrameworkButtons';
import { frameworks } from './frameworks';
import NamespaceView from './NamespaceView';
import KubescapeWorkloadConfigurationScanList from './ResourceList';
import {
  controlComplianceScore,
  countFailedScans,
  countScans,
  filterWorkloadScanData,
  getControlsWithFindings,
} from './workload-scanning';
import { useSelectedClusters } from '@kinvolk/headlamp-plugin/lib/k8s';

const pageSize: number = 50;

// workloadScans are cached in global scope because it is an expensive query for the API server
type ConfigurationScanContext = {
  workloadScans: WorkloadConfigurationScanSummary[];
  clusters: string[];
  clusterCursor: number;
  continuation: number | undefined;
  context: {
    currentCluster: string;
    allowedNamespaces: string[];
  };
};

export const configurationScanContext: ConfigurationScanContext = {
  workloadScans: [],
  clusters: [],
  clusterCursor: 0,
  continuation: 0,
  context: {
    currentCluster: '',
    allowedNamespaces: [],
  },
};

export default function ComplianceView() {
  const [selectedTab, setSelectedTab] = useLocalStorage<number>(KubescapeSettings.ComplianceTab, 0);
  const [workloadScanData, setWorkloadScanData] = useState<
    WorkloadConfigurationScanSummary[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');
  const [exceptions, setExceptions] = useState<{
    controlsExcepted: number;
    resourcesExcepted: number;
  }>({ controlsExcepted: 0, resourcesExcepted: 0 });
  const [frameworkName, setFrameworkName] = useLocalStorage<string>(
    KubescapeSettings.Framework,
    'AllControls'
  );
  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] = useLocalStorage<boolean>(
    KubescapeSettings.FailedControls,
    true
  );

  const useHLSelectedClusters = useSelectedClusters ?? (() => null); // Needed for backwards compatibility
  const clusters = useHLSelectedClusters() ?? [getCluster()];
  const continueReading = useRef(true);

  const framework = frameworks.find(fw => fw.name === frameworkName) ?? frameworks[0];

  useEffect(() => {
    async function fetchData() {
      if (isNewClusterContext(configurationScanContext.context)) {
        configurationScanContext.clusters = clusters;
        configurationScanContext.clusterCursor = 0;
        configurationScanContext.continuation = 0;
        configurationScanContext.workloadScans = [];
        configurationScanContext.context.currentCluster = getCluster() ?? '';
        configurationScanContext.context.allowedNamespaces = getAllowedNamespaces();
      }
      if (
        configurationScanContext.continuation !== undefined &&
        configurationScanContext.clusterCursor < configurationScanContext.clusters.length
      ) {
        await fetchWorkloadScanData(continueReading, setProgressMessage, setLoading);
      }
      const [filteredWorkloadScans, controlsExcepted, resourcesExcepted] = filterWorkloadScanData(
        configurationScanContext.workloadScans,
        framework
      );
      setExceptions({ resourcesExcepted, controlsExcepted });
      setWorkloadScanData(filteredWorkloadScans);
    }

    fetchData();
    return () => {
      continueReading.current = false;
    };
  }, [frameworkName]);

  return (
    <>
      <h1>Compliance</h1>

      {!loading && (
        <Stack direction="row" spacing={2}>
          {configurationScanContext.continuation !== undefined && (
            <Button
              onClick={() => {
                setTimeout(() => {
                  continueReading.current = true;
                  fetchWorkloadScanData(continueReading, setProgressMessage, setLoading);
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

      {loading && (
        <Box sx={{ padding: 2 }}>
          <ProgressIndicator continueReading={continueReading} progressMessage={progressMessage} />
        </Box>
      )}

      {!loading && workloadScanData && (
        <>
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              checked={isFailedControlSwitchChecked}
              control={<Switch color="primary" />}
              label={'Failed controls'}
              onChange={(event: any, checked: boolean) => {
                setIsFailedControlSwitchChecked(checked);
              }}
            />
            <FrameworkButtons frameworkName={frameworkName} setFrameworkName={setFrameworkName} />
          </Stack>
          <Typography variant="body1" component="div" sx={{ padding: 2 }}>
            {`${workloadScanData.length} total checks, ${countFailedScans(
              workloadScanData
            )} configuration issues, excluding ${exceptions.resourcesExcepted} resources and 
            ${exceptions.controlsExcepted} controls`}
          </Typography>
          <HeadlampTabs
            defaultIndex={selectedTab}
            onTabChanged={tabIndex => setSelectedTab(tabIndex)}
            tabs={[
              {
                label: 'Controls',
                component: (
                  <ConfigurationScanningListView
                    workloadScanData={workloadScanData}
                    framework={framework}
                    isFailedControlSwitchChecked={isFailedControlSwitchChecked}
                  />
                ),
              },
              {
                label: 'Resources',
                component: (
                  <KubescapeWorkloadConfigurationScanList
                    workloadScanData={workloadScanData}
                    framework={framework}
                    isFailedControlSwitchChecked={isFailedControlSwitchChecked}
                  />
                ),
              },
              {
                label: 'Namespaces',
                component: <NamespaceView workloadScanData={workloadScanData} />,
              },
            ]}
            ariaLabel="Navigation Tabs"
          />
        </>
      )}
    </>
  );
}

function ConfigurationScanningListView(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[];
    framework: FrameWork;
    isFailedControlSwitchChecked: boolean;
  }>
) {
  const { workloadScanData, framework, isFailedControlSwitchChecked } = props;

  const controlsWithFindings = getControlsWithFindings(workloadScanData, framework);

  const controls = isFailedControlSwitchChecked ? controlsWithFindings : framework.controls;

  return (
    <SectionBox>
      <Table
        data={controls}
        columns={[
          {
            header: 'Severity',
            accessorFn: (control: Control) =>
              makeCVSSLabel(control.baseScore, hasFailedScans(workloadScanData, control)),
            gridTemplate: 'min-content',
          },
          {
            id: 'ID',
            header: 'ID',
            accessorKey: 'controlID',
            Cell: ({ cell }: any) => (
              <Link
                target="_blank"
                href={'https://hub.armosec.io/docs/' + cell.getValue().toLowerCase()}
              >
                <div>{cell.getValue()}</div>
              </Link>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Control Name',
            accessorKey: 'name',
            Cell: ({ cell, row }: any) => (
              <Tooltip
                title={row.original.description}
                slotProps={{ tooltip: { sx: { fontSize: '0.9em' } } }}
              >
                <Box>{cell.getValue()}</Box>
              </Tooltip>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Category',
            accessorFn: (control: Control) =>
              control.category?.subCategory?.name ?? control.category?.name,
            gridTemplate: 'auto',
          },
          {
            header: 'Remediation',
            accessorFn: (control: Control) => control.remediation.replaceAll('`', "'"),
          },
          {
            header: 'Compliance',
            accessorFn: (control: Control) =>
              Math.trunc(controlComplianceScore(workloadScanData, control)),
            Cell: ({ cell }: any) => cell.getValue() + '%',
            gridTemplate: 'auto',
          },
          {
            header: 'Resources',
            accessorFn: (control: Control) =>
              workloadScanData ? makeResultsLabel(workloadScanData, control) : '',

            gridTemplate: 'auto',
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'ID',
              desc: false,
            },
          ],
        }}
        reflectInURL="controls"
      />
    </SectionBox>
  );
}

function makeCVSSLabel(baseScore: number, hasFailedScans: boolean) {
  let status: StatusLabelProps['status'] = '';
  let severity: string;

  // https://nvd.nist.gov/vuln-metrics/cvss
  if (baseScore < 0.1) {
    severity = 'None';
  } else if (baseScore < 4.0) {
    severity = 'Low';
  } else if (baseScore < 7.0) {
    severity = 'Medium';
  } else if (baseScore < 9.0) {
    severity = 'High';
  } else {
    severity = 'Critical';
  }

  if (hasFailedScans) {
    status = 'error';
  } else {
    status = 'success';
  }

  if (baseScore >= 7.0 && hasFailedScans) {
    return <StatusLabel status={status}>{severity}</StatusLabel>;
  } else {
    return severity;
  }
}

function makeResultsLabel(workloadScanData: WorkloadConfigurationScanSummary[], control: Control) {
  const failCount = countScans(workloadScanData, control, 'failed');
  const passedCount = countScans(workloadScanData, control, 'passed');

  if (failCount > 0) {
    return (
      <HeadlampLink
        routeName={RoutingName.KubescapeControlResults}
        params={{
          control: control.controlID,
        }}
      >
        <div>
          {failCount} Failed, {passedCount} Accepted
        </div>
      </HeadlampLink>
    );
  } else {
    return failCount;
  }
}

function hasFailedScans(workloadScanData: WorkloadConfigurationScanSummary[], control: Control) {
  return workloadScanData?.some(w =>
    Object.values(w.spec.controls).some(
      scan => scan.controlID === control.controlID && scan.status.status === 'failed'
    )
  );
}

async function fetchWorkloadScanData(
  continueReading: React.MutableRefObject<boolean>,
  setProgress: (progress: string) => void,
  setLoading: (loading: boolean) => void
): Promise<void> {
  while (configurationScanContext.clusterCursor < configurationScanContext.clusters.length) {
    while (continueReading.current && configurationScanContext.continuation !== undefined) {
      setLoading(true);
      await paginatedListQuery(
        configurationScanContext.clusters[configurationScanContext.clusterCursor],
        workloadConfigurationScanSummaryClass,
        configurationScanContext.continuation,
        pageSize,
        getAllowedNamespaces()
      ).then(response => {
        const { items, continuation } = response;

        configurationScanContext.continuation = continuation;
        configurationScanContext.workloadScans.push(...items);
      });

      if (configurationScanContext.continuation !== undefined) {
        setProgress(`Reading ${configurationScanContext.workloadScans.length} scans...`);
      }
    }
    configurationScanContext.clusterCursor++; // move to the next cluster
    if (configurationScanContext.clusterCursor < configurationScanContext.clusters.length) {
      configurationScanContext.continuation = 0;
    }
  }

  setLoading(false);
}
