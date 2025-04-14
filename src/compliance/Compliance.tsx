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
import { RoutingName } from '../index';
import { paginatedListQuery, workloadConfigurationScanSummaryClass } from '../model';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { Control, FrameWork } from './FrameWork';
import { FrameworkButtons } from './FrameworkButtons';
import { frameworks } from './frameworks';
import NamespaceView from './NamespaceView';
import KubescapeWorkloadConfigurationScanList from './ResourceList';

// workloadScans are cached in global scope because it is an expensive query for the API server
type ConfigurationScanContext = {
  workloadScans: WorkloadConfigurationScanSummary[];
  currentCluster: string;
  continuation: number | undefined;
  pageSize: number;
  allowedNamespaces: string[];
  selectedTab: number;
  framework: FrameWork;
};

export const configurationScanContext: ConfigurationScanContext = {
  workloadScans: [],
  currentCluster: '',
  continuation: 0,
  pageSize: 50,
  allowedNamespaces: [],
  selectedTab: 0,
  framework: frameworks[0],
};

export default function ComplianceView() {
  const [workloadScanData, setWorkloadScanData] = useState<
    WorkloadConfigurationScanSummary[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');
  const [framework, setFramework] = useState(frameworks[0]);
  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] = useState(true);

  const continueReading = useRef(true);

  useEffect(() => {
    async function fetchData() {
      if (
        isNewClusterContext(
          configurationScanContext.currentCluster,
          configurationScanContext.allowedNamespaces
        )
      ) {
        configurationScanContext.continuation = 0;
        configurationScanContext.currentCluster = getCluster() ?? '';
        configurationScanContext.allowedNamespaces = getAllowedNamespaces();
      }
      if (configurationScanContext.continuation !== undefined) {
        await fetchWorkloadScanData(continueReading, setProgressMessage, setLoading);
      }
      setWorkloadScanData(
        filterWorkloadScanData(configurationScanContext.workloadScans, framework)
      );
    }

    fetchData();
    return () => {
      continueReading.current = false;
    };
  }, []);

  useEffect(() => {
    setWorkloadScanData(filterWorkloadScanData(configurationScanContext.workloadScans, framework));
    configurationScanContext.framework = framework;
  }, [framework]);

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
          <FormControlLabel
            checked={isFailedControlSwitchChecked}
            control={<Switch color="primary" />}
            label={'Failed controls'}
            onChange={(event: any, checked: boolean) => {
              setIsFailedControlSwitchChecked(checked);
            }}
          />
          <FrameworkButtons setFramework={setFramework} />
          <Typography variant="body1" component="div" sx={{ padding: 2 }}>
            {workloadScanData.length} scans, {countFailedScans(workloadScanData)} configuration
            issues
          </Typography>
          <HeadlampTabs
            defaultIndex={configurationScanContext.selectedTab}
            onTabChanged={tabIndex => (configurationScanContext.selectedTab = tabIndex)}
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
              makeCVSSLabel(
                control.baseScore,
                workloadScanData ? countScans(workloadScanData, control, 'failed') : 0
              ),
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
            header: 'Resources',
            accessorFn: (control: Control) =>
              workloadScanData ? makeResultsLabel(workloadScanData, control) : '',
            gridTemplate: 'auto',
          },
          // {
          //   header: 'Score',
          //   accessorFn: (control: Control) => {
          //     const evaluated = workloadScanData
          //       .flatMap(w => Object.values(w.spec.controls))
          //       .filter(scan => scan.controlID === control.controlID).length;
          //     const passed = countScans(workloadScanData, control, 'passed');
          //     return ((passed * 100) / evaluated).toFixed(0) + '%';
          //   },
          // },
        ]}
        initialState={{
          sorting: [
            {
              id: 'ID',
              desc: false,
            },
          ],
        }}
      />
    </SectionBox>
  );
}

function makeCVSSLabel(baseScore: number, failCount: number) {
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

  if (failCount > 0) {
    status = 'error';
  } else {
    status = 'success';
  }

  if (baseScore >= 7.0 && failCount > 0) {
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

export function countScans(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control,
  status: string
): number {
  return workloadScanData
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => scan.controlID === control.controlID)
    .filter(scan => scan.status.status === status).length;
}

function countFailedScans(workloadScanData: WorkloadConfigurationScanSummary[]): number {
  return workloadScanData
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => scan.status.status === 'failed').length;
}

async function fetchWorkloadScanData(
  continueReading: React.MutableRefObject<boolean>,
  setProgress: (progress: string) => void,
  setLoading: (loading: boolean) => void
): Promise<void> {
  while (continueReading.current && configurationScanContext.continuation !== undefined) {
    setLoading(true);
    await paginatedListQuery(
      workloadConfigurationScanSummaryClass,
      configurationScanContext.continuation,
      configurationScanContext.pageSize,
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
  setLoading(false);
}

function getControlsWithFindings(
  workloadScanData: WorkloadConfigurationScanSummary[],
  frameWork: FrameWork
) {
  return frameWork.controls.filter(control =>
    workloadScanData?.some(w =>
      Object.values(w.spec.controls).some(
        scan => control.controlID === scan.controlID && scan.status.status === 'failed'
      )
    )
  );
}

export function filterWorkloadScanData(
  workloadScans: WorkloadConfigurationScanSummary[],
  frameWork: FrameWork
): WorkloadConfigurationScanSummary[] {
  const filteredWorkloadScans: WorkloadConfigurationScanSummary[] = [];

  for (const workloadScan of workloadScans) {
    const w: WorkloadConfigurationScanSummary = structuredClone(workloadScan);

    if (frameWork) {
      w.spec.controls = Object.fromEntries(
        Object.entries(workloadScan.spec.controls).filter(([, value]) =>
          frameWork.controls.find(control => control.controlID === value.controlID)
        )
      );
    }

    filteredWorkloadScans.push(w);
  }
  return filteredWorkloadScans;
}
