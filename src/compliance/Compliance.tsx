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
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { isAllowedNamespaceUpdated } from '../common/clusterContext';
import { KubescapeConfig, kubescapeConfigStore } from '../common/config-store';
import { ProgressIndicator } from '../common/ProgressIndicator';
import {
  getItemFromSessionStorage,
  KubescapeSettings,
  setItemInSessionStorage,
  useSessionStorage,
} from '../common/sessionStorage';
import { StatusLabel, StatusLabelProps } from '../common/StatusLabel';
import { getKubescapeNamespace } from '../custom-objects/api-queries';
import {
  applyExceptionsToWorkloadScanData,
  countExcludedControls,
  countExcludedResources,
  countExcludedWorkloadsForControl,
} from '../exceptions/apply-exceptions';
import { ExceptionPolicy, ExceptionPolicyGroup } from '../exceptions/ExceptionPolicy';
import { RoutingName, useHLSelectedClusters } from '../index';
import { customObjectLabel, workloadConfigurationScanSummaryClass } from '../model';
import { handleListPaginationTasks as handleQueryTasks, QueryTask } from '../query';
import { Control, controls, fitControlsToFrameworks, FrameWork, frameworks } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import ClusterView from './ClusterView';
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

// workloadScans are cached in global scope because it is an expensive query for the API server
type ConfigurationScanContext = {
  workloadScans: WorkloadConfigurationScanSummary[];
  queryTasks: QueryTask[];
};

export const configurationScanContext: ConfigurationScanContext = {
  workloadScans: [],
  queryTasks: [],
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
  const pluginConfig = kubescapeConfigStore.useConfig();
  const kubescapeConfig = pluginConfig() as KubescapeConfig;

  const [workloadScanData, setWorkloadScanData] = useState<
    WorkloadConfigurationScanSummary[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState('Reading Kubescape scans');

  const clusters = useHLSelectedClusters();
  const [customFrameworks, setCustomFrameworks] = useState<FrameWork[]>([]);
  const [exceptionGroups, setExceptionGroups] = useState<ExceptionPolicyGroup[]>([]);

  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] =
    useSessionStorage<boolean>(KubescapeSettings.FailedControls, true);
  const continueReading = useRef(true);

  const framework =
    frameworks.find(fw => fw.name === kubescapeConfig?.framework) ??
    customFrameworks?.find(fw => fw.name === kubescapeConfig?.framework) ??
    frameworks[0];

  // kubescape namespace
  useEffect(() => {
    setItemInSessionStorage(KubescapeSettings.KubescapeNamespace, null);
    getKubescapeNamespace().then(({ error }) => {
      console.log(error);
    });
  }, []);

  // fetch workload scans
  useEffect(() => {
    async function fetchData() {
      initQueryTasks(clusters, setProgressMessage, kubescapeConfig);

      await handleQueryTasks(configurationScanContext.queryTasks, continueReading, setLoading);

      const exceptionGroup = await fetchCustomObjects(setExceptionGroups, setCustomFrameworks);

      applyExceptionsToWorkloadScanData(
        configurationScanContext.workloadScans,
        kubescapeConfig?.framework,
        exceptionGroup
      );
      setWorkloadScanData([...configurationScanContext.workloadScans]);
    }

    fetchData();
    return () => {
      continueReading.current = false;
    };
  }, [kubescapeConfig]);

  return (
    <>
      <h1>Compliance</h1>

      {!loading && (
        <Stack direction="row" spacing={2}>
          {configurationScanContext.queryTasks.some(task => task.continuation !== undefined) && (
            <Button
              onClick={() => {
                setTimeout(() => {
                  continueReading.current = true;
                  handleQueryTasks(
                    configurationScanContext.queryTasks,
                    continueReading,
                    setLoading
                  );
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
              frameworkName={kubescapeConfig?.framework}
              customFrameworks={customFrameworks}
            />
            <ExceptionsDropdown exceptionGroups={exceptionGroups} />
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
            defaultIndex={getItemFromSessionStorage(KubescapeSettings.ComplianceTab) ?? 0}
            onTabChanged={tabIndex =>
              setItemInSessionStorage(KubescapeSettings.ComplianceTab, tabIndex)
            }
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
              {
                label: 'Clusters',
                component: (
                  <ClusterView
                    workloadScanData={workloadScanData}
                    customFrameworks={customFrameworks}
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
              <HeadlampLink
                routeName={RoutingName.KubescapeControlResults}
                params={{
                  control: cell.getValue(),
                }}
              >
                <div>{cell.getValue()}</div>
              </HeadlampLink>
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
    return passedCount;
  }
}

function ExceptionsDropdown(
  props: Readonly<{
    exceptionGroups: ExceptionPolicyGroup[];
  }>
) {
  const { exceptionGroups } = props;

  const selectedExceptionGroupName = kubescapeConfigStore.get().exceptionGroupName ?? '';

  if (!exceptionGroups || exceptionGroups.length === 0) {
    return <></>;
  }
  return (
    <FormControl sx={{ m: 1, minWidth: 200 }} size="small">
      <InputLabel sx={{ marginLeft: 2 }} id="select-label">
        Exceptions
      </InputLabel>
      <Select
        labelId="select-label"
        sx={{ height: 40, width: 160 }}
        value={selectedExceptionGroupName}
        onChange={event => kubescapeConfigStore.update({ exceptionGroupName: event.target.value })}
        input={<OutlinedInput label="Exceptions" />}
      >
        <MenuItem value="">None</MenuItem>
        {exceptionGroups.map(exceptionGroup => (
          <MenuItem key={exceptionGroup.name} value={exceptionGroup.name}>
            {exceptionGroup.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

async function fetchCustomObjects(
  setExceptionGroups: (exceptionGroups: ExceptionPolicyGroup[]) => void,
  setCustomFrameworks: (customFrameworks: FrameWork[]) => void
) {
  const queryParams = new URLSearchParams();

  queryParams.append('labelSelector', `${customObjectLabel} in (framework,exceptions)`);
  const response = await request(`api/v1/configmaps?${queryParams.toString()}`).catch(error => {
    console.error(error);
  });

  const customFrameworks: FrameWork[] = [];
  const customExceptions: ExceptionPolicyGroup[] = [];

  response.items?.map((configMap: any) => {
    const label = configMap.metadata.labels[customObjectLabel];
    if (label === 'framework') {
      const controlsIDs: string[] = JSON.parse(configMap.data.controlsIDs) ?? [];
      customFrameworks.push({
        name: configMap.data.name,
        description: configMap.data.description,
        controls: controls.filter(c => controlsIDs?.some(controlID => controlID === c.controlID)),
        configmapManifestName: configMap.metadata.name,
      });
    } else if (label === 'exceptions') {
      const exceptionPolicies: ExceptionPolicy[] =
        JSON.parse(configMap.data.exceptionPolicies) ?? [];
      customExceptions.push({
        name: configMap.data.name,
        description: configMap.data.description,
        exceptionPolicies: exceptionPolicies,
        configmapManifestName: configMap.metadata.name,
      });
    }
  });

  setExceptionGroups(customExceptions);
  setCustomFrameworks(customFrameworks);

  return customExceptions.find(eg => eg.name === kubescapeConfigStore.get().exceptionGroupName);
}

function initQueryTasks(
  clusters: string[],
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>,
  kubescapeConfig: KubescapeConfig
) {
  // remove queryTask and data from clusters that are no more selected or where allowed namespaces are changed
  for (const queryTask of configurationScanContext.queryTasks) {
    if (clusters.indexOf(queryTask.cluster) === -1 || isAllowedNamespaceUpdated(queryTask)) {
      configurationScanContext.queryTasks.splice(
        configurationScanContext.queryTasks.indexOf(queryTask),
        1
      );
      configurationScanContext.workloadScans = configurationScanContext.workloadScans.filter(
        scan => scan.metadata.cluster !== queryTask.cluster
      );
    }
  }

  // add queryTask for new selected clusters
  for (const cluster of clusters) {
    if (!configurationScanContext.queryTasks.find(q => q.cluster === cluster)) {
      console.log(`new query task for scans for ${cluster}`);

      configurationScanContext.queryTasks.push({
        cluster: cluster,
        allowedNamespaces: getAllowedNamespaces(cluster),
        continuation: 0,
        objectClass: workloadConfigurationScanSummaryClass,
        pageSize: kubescapeConfig?.pageSize || 50,
        handleData: (queryTask: QueryTask, items: any[]) => {
          configurationScanContext.workloadScans.push(...items);
          setProgressMessage(`Reading ${configurationScanContext.workloadScans.length} scans...`);
        },
      });
    }
  }
}
