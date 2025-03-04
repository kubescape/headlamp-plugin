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
import { useEffect, useState } from 'react';
import { RotatingLines } from 'react-loader-spinner';
import { StatusLabel, StatusLabelProps } from '../common/StatusLabel';
import { RoutingName } from '../index';
import { fetchObject, listQuery, workloadConfigurationScanSummaryClass } from '../model';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { Control, controlLibrary } from './controlLibrary';
import NamespaceView from './NamespaceView';
import KubescapeWorkloadConfigurationScanList from './ResourceList';

// workloadScans are cached in global scope because it is an expensive query for the API server
type ConfigurationScanContext = {
  workloadScans: WorkloadConfigurationScanSummary[];
  currentCluster: string | null;
  summaries: WorkloadConfigurationScanSummary[];
  indexSummary: number;
  summaryFetchItems: number;
  allowedNamespaces: string[];
  selectedTab: number;
};

export const configurationScanContext: ConfigurationScanContext = {
  workloadScans: [],
  currentCluster: '',
  summaries: [],
  indexSummary: 0,
  summaryFetchItems: 20,
  allowedNamespaces: [],
  selectedTab: 0,
};

export default function ComplianceView() {
  const [workloadScanData, setWorkloadScanData] = useState<
    WorkloadConfigurationScanSummary[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const arraysEqual = (a: string[], b: string[]) =>
      a.length === b.length && a.every((element, index) => element === b[index]);

    if (
      configurationScanContext.currentCluster !== getCluster() || // check if user switched to another cluster
      !arraysEqual(getAllowedNamespaces(), configurationScanContext.allowedNamespaces) // check if user changed namespace selection
    ) {
      const fetchData = async () => {
        configurationScanContext.summaries = await listQuery(workloadConfigurationScanSummaryClass);
        configurationScanContext.currentCluster = getCluster();
        configurationScanContext.allowedNamespaces = getAllowedNamespaces();

        configurationScanContext.indexSummary =
          configurationScanContext.summaryFetchItems > configurationScanContext.summaries.length
            ? configurationScanContext.summaries.length
            : configurationScanContext.summaryFetchItems;

        fetchConfigurationScanSummaries(
          configurationScanContext.summaries.slice(0, configurationScanContext.indexSummary)
        ).then(response => {
          configurationScanContext.workloadScans = response;

          setWorkloadScanData(configurationScanContext.workloadScans);
          setLoading(false);
        });
      };

      fetchData().catch(console.error);
    } else {
      setWorkloadScanData(configurationScanContext.workloadScans);
    }
  }, []);

  return (
    <>
      <h1>Compliance</h1>
      <Stack direction="row" spacing={2}>
        <Typography variant="body1" component="div" sx={{ flexGrow: 1 }}>
          Reading {configurationScanContext.indexSummary} of{' '}
          {configurationScanContext.summaries.length} scans
        </Typography>
        <MoreButton
          setLoading={setLoading}
          setWorkloadScans={setWorkloadScanData}
          title="Read more"
        />
        <MoreButton
          setLoading={setLoading}
          setWorkloadScans={setWorkloadScanData}
          title="All"
          readToEnd
        />
      </Stack>
      <HeadlampTabs
        defaultIndex={configurationScanContext.selectedTab}
        onTabChanged={tabIndex => (configurationScanContext.selectedTab = tabIndex)}
        tabs={[
          {
            label: 'Controls',
            component: (
              <ConfigurationScanningListView
                loading={loading}
                workloadScanData={workloadScanData}
              />
            ),
          },
          {
            label: 'Resources',
            component: (
              <KubescapeWorkloadConfigurationScanList workloadScanData={workloadScanData} />
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
  );
}

function ConfigurationScanningListView(
  props: Readonly<{
    loading: boolean;
    workloadScanData: WorkloadConfigurationScanSummary[] | null;
  }>
) {
  const { loading, workloadScanData } = props;
  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] = useState(true);

  if (loading || !workloadScanData)
    return (
      <Box sx={{ padding: 2 }}>
        <RotatingLines />
      </Box>
    );

  const controlsWithFindings = controlLibrary.filter(control =>
    workloadScanData?.some(w =>
      Object.values(w.spec.controls).some(
        scan => control.controlID === scan.controlID && scan.status.status === 'failed'
      )
    )
  );

  const controls = isFailedControlSwitchChecked ? controlsWithFindings : controlLibrary;

  return (
    <>
      <h5>
        {countFailedScans(workloadScanData)} configuration issues, {controlsWithFindings.length}{' '}
        failed controls
      </h5>
      <FormControlLabel
        checked={isFailedControlSwitchChecked}
        control={<Switch color="primary" />}
        label={'Failed controls'}
        onChange={(event: any, checked: boolean) => {
          setIsFailedControlSwitchChecked(checked);
        }}
      />
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
    </>
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

function countScans(
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

export async function fetchConfigurationScanSummaries(
  summaries: WorkloadConfigurationScanSummary[]
): Promise<any> {
  return await Promise.all(
    summaries.map(async (summary: WorkloadConfigurationScanSummary) => {
      return await fetchObject(
        summary.metadata.name,
        summary.metadata.namespace,
        workloadConfigurationScanSummaryClass
      );
    })
  );
}

function MoreButton(
  props: Readonly<{
    setLoading: any;
    setWorkloadScans: any;
    title: string;
    readToEnd?: boolean;
  }>
) {
  const { setLoading, setWorkloadScans, title, readToEnd } = props;

  return (
    <Button
      disabled={configurationScanContext.indexSummary === configurationScanContext.summaries.length}
      onClick={() => {
        const currentIndex = configurationScanContext.indexSummary;
        if (readToEnd) {
          configurationScanContext.indexSummary = configurationScanContext.summaries.length;
        } else {
          configurationScanContext.indexSummary =
            currentIndex + configurationScanContext.summaryFetchItems >
            configurationScanContext.summaries.length
              ? configurationScanContext.summaries.length
              : currentIndex + configurationScanContext.summaryFetchItems;
        }

        setLoading(true);
        setTimeout(() =>
          fetchConfigurationScanSummaries(
            configurationScanContext.summaries.slice(
              currentIndex,
              configurationScanContext.indexSummary
            )
          ).then(response => {
            if (!configurationScanContext.workloadScans)
              configurationScanContext.workloadScans = response;
            else
              configurationScanContext.workloadScans =
                configurationScanContext.workloadScans?.concat(response);

            setWorkloadScans(configurationScanContext.workloadScans);
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
