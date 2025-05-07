/* 
  Overview  page for configuration controls and resources. 
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
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
import {
  applyExceptionsToWorkloadScanData,
  countExcludedControls,
  countExcludedResources,
  countExcludedWorkloadsForControl,
} from '../exceptions/apply-exceptions';
import { RoutingName } from '../index';
import {
  customObjectLabel,
  paginatedListQuery,
  workloadConfigurationScanSummaryClass,
} from '../model';
import { Control, controls, fitControlsToFrameworks, FrameWork, frameworks } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { FrameworkButtons } from './FrameworkButtons';
import NamespaceView from './NamespaceView';
import KubescapeWorkloadConfigurationScanList from './ResourceList';
import {
  controlComplianceScore,
  countFailedScans,
  countScans,
  getControlsWithFindings,
  hasFailedScans,
} from './workload-scanning';

const pageSize: number = 50;

// workloadScans are cached in global scope because it is an expensive query for the API server
type ConfigurationScanContext = {
  workloadScans: WorkloadConfigurationScanSummary[];
  continuation: number | undefined;
  context: {
    currentCluster: string;
    allowedNamespaces: string[];
  };
};

export const configurationScanContext: ConfigurationScanContext = {
  workloadScans: [],
  continuation: 0,
  context: {
    currentCluster: '',
    allowedNamespaces: [],
  },
};

fitControlsToFrameworks();

/**
 * Overview page for configuration controls and resources.
 *
 * This page is the main entry point for viewing the compliance posture of the cluster.
 * It displays a list of all controls and resources that have been scanned by Kubescape,
 * along with information about the compliance posture of each control and resource.
 * The page also provides a filter for viewing the compliance posture of specific
 * resources and controls.
 *
 * @returns The ComplianceView component.
 */
export default function ComplianceView(): JSX.Element {
  const [selectedTab, setSelectedTab] = useLocalStorage<number>(KubescapeSettings.ComplianceTab, 0);
  const [workloadScanData, setWorkloadScanData] = useState<
    WorkloadConfigurationScanSummary[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');
  const [frameworkName, setFrameworkName] = useLocalStorage<string>(
    KubescapeSettings.Framework,
    'AllControls'
  );
  const [customFrameworks, setCustomFrameworks] = useState<any[]>([]);

  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] = useLocalStorage<boolean>(
    KubescapeSettings.FailedControls,
    true
  );
  const continueReading = useRef(true);

  const framework =
    frameworks.find(fw => fw.name === frameworkName) ??
    customFrameworks?.find(fw => fw.name === frameworkName) ??
    frameworks[0];

  useEffect(() => {
    const queryParams = new URLSearchParams();
    queryParams.append('labelSelector', `${customObjectLabel}=framework`);
    request(`api/v1/configmaps?${queryParams.toString()}`)
      .then(response => {
        const customFrameworks =
          response.items?.map((configMap: any) => {
            const controlsIDs: string[] = JSON.parse(configMap.data.controlsIDs) ?? [];
            return {
              name: configMap.data.name,
              description: configMap.data.description,
              controls: controls.filter(c =>
                controlsIDs?.some(controlID => controlID === c.controlID)
              ),
            } as FrameWork;
          }) ?? [];
        setCustomFrameworks(customFrameworks);
      })
      .catch(error => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (isNewClusterContext(configurationScanContext.context)) {
        configurationScanContext.continuation = 0;
        configurationScanContext.workloadScans = [];
        configurationScanContext.context.currentCluster = getCluster() ?? '';
        configurationScanContext.context.allowedNamespaces = getAllowedNamespaces();
      }
      if (configurationScanContext.continuation !== undefined) {
        await fetchWorkloadScanData(continueReading, setProgressMessage, setLoading);
      }
      applyExceptionsToWorkloadScanData(configurationScanContext.workloadScans, frameworkName);
      setWorkloadScanData(configurationScanContext.workloadScans);
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
            <FrameworkButtons
              frameworkName={frameworkName}
              customFrameworks={customFrameworks}
              setFrameworkName={setFrameworkName}
            />
          </Stack>
          <Typography variant="body1" component="div" sx={{ padding: 2 }}>
            {`${workloadScanData.length} total checks, ${countFailedScans(
              workloadScanData
            )} configuration issues, excluding ${countExcludedResources(
              workloadScanData
            )} resources and 
            ${countExcludedControls(workloadScanData)} controls`}
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
                    setWorkloadScanData={setWorkloadScanData}
                    framework={framework}
                    isFailedControlSwitchChecked={isFailedControlSwitchChecked}
                  />
                ),
              },
              {
                label: 'Namespaces',
                component: (
                  <NamespaceView
                    workloadScanData={workloadScanData}
                    setWorkloadScanData={setWorkloadScanData}
                  />
                ),
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
              makeSeverityLabel(control.baseScore, hasFailedScans(workloadScanData, control)),
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
            header: 'Excluded',
            accessorFn: (control: Control) =>
              countExcludedWorkloadsForControl(workloadScanData, control),
            Cell: ({ cell }: any) => cell.getValue(),
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

function makeSeverityLabel(baseScore: number, hasFailedScans: boolean) {
  const severity = complianceSeverity(baseScore);
  let status: StatusLabelProps['status'] = '';

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

export function complianceSeverity(baseScore: number) {
  let severity: string;

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
  return severity;
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
  setLoading(false);
}
