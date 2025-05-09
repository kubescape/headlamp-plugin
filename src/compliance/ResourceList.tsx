/* 
  List configuration scans for all workloads.  
*/
import { Link, Table } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, FormControlLabel, Stack, Switch, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { mutateResourceException } from '../exceptions/mutate-exception';
import { RoutingName } from '../index';
import { FrameWork } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

export default function KubescapeWorkloadConfigurationScanList(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[] | null;
    setWorkloadScanData: (workloadScanData: WorkloadConfigurationScanSummary[]) => void;
    framework: FrameWork;
    isFailedControlSwitchChecked: boolean;
  }>
) {
  const { enqueueSnackbar } = useSnackbar();
  const { workloadScanData, setWorkloadScanData, framework, isFailedControlSwitchChecked } = props;
  if (!workloadScanData) {
    return <></>;
  }

  const handleExcludeResource = async (
    workloadScan: WorkloadConfigurationScanSummary,
    checked: boolean
  ) => {
    const errorMessage = await mutateResourceException(
      workloadScan.metadata.labels['kubescape.io/workload-name'],
      workloadScan.metadata.namespace,
      workloadScan.metadata.labels['kubescape.io/workload-kind'],
      checked
    );
    if (errorMessage) {
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } else {
      workloadScan.exceptedByPolicy = checked;
      setWorkloadScanData([...workloadScanData]);
    }
  };

  const workloadsWithFindings = getWorkloadsWithFindings(workloadScanData);
  return (
    <Box>
      <Table
        data={isFailedControlSwitchChecked ? workloadsWithFindings : workloadScanData}
        columns={[
          {
            header: 'Name',
            accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
              workloadScan.metadata.labels['kubescape.io/workload-name'],
            Cell: ({ cell, row }: any) => (
              <Link
                routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
                params={{
                  name: row.original.metadata.name,
                  namespace: row.original.metadata.namespace,
                }}
              >
                {cell.getValue()}
              </Link>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Excluded',
            accessorKey: 'exceptedByPolicy',
            Cell: ({ cell }: any) => (
              <FormControlLabel
                label=""
                checked={cell.getValue() === true}
                control={<Switch color="primary" />}
                onChange={(event: any, checked: boolean) => {
                  handleExcludeResource(cell.row.original, checked);
                }}
              />
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Kind',
            accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
              workloadScan.metadata.labels['kubescape.io/workload-kind'],
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
              workloadScan.metadata.labels['kubescape.io/workload-namespace'],
            Cell: ({ cell }: any) => {
              if (cell.getValue())
                return (
                  <Link
                    routeName="namespace"
                    params={{
                      name: cell.getValue(),
                    }}
                  >
                    {cell.getValue()}
                  </Link>
                );
            },
            gridTemplate: 'auto',
          },
          {
            header: 'Passed',
            accessorFn: (workloadScan: WorkloadConfigurationScanSummary) => {
              const passedCount = Object.values(workloadScan.spec.controls).filter(
                scan => scan.status.status === WorkloadConfigurationScanSummary.Status.Passed
              ).length;
              return passedCount / Object.keys(workloadScan.spec.controls).length;
            },
            Cell: ({ cell }: any) => <progress value={cell.getValue()} />,
            gridTemplate: 'auto',
          },
          {
            id: 'Failed Controls',
            header: 'Failed Controls',
            Cell: ({ row }: any) => resultStack(row.original, framework),
            accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
              countResourceScans(workloadScan).join('.'),
            gridTemplate: 'auto',
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'Failed Controls',
              desc: true,
            },
          ],
        }}
        reflectInURL="resources"
      />
    </Box>
  );
}

function controlsList(
  workloadScan: WorkloadConfigurationScanSummary,
  framework: FrameWork,
  severity: string
) {
  const controls = [];
  for (const scan of Object.values(workloadScan.spec.controls)) {
    if (
      scan.status.status === WorkloadConfigurationScanSummary.Status.Failed &&
      scan.severity.severity === severity
    ) {
      const control = framework.controls.find(control => control.controlID === scan.controlID);
      if (control) {
        controls.push(control);
      }
    }
  }

  if (controls.length > 0) {
    return (
      <>
        <div style={{ fontSize: 'smaller' }}>{severity}</div>
        <br />
        <div style={{ whiteSpace: 'normal', textAlign: 'left', fontSize: 'small' }}>
          <Stack spacing={1}>
            {controls.map(control => (
              <div key={control.controlID}>{`${control.controlID}: ${control.name}`} </div>
            ))}
          </Stack>
        </div>
      </>
    );
  }
}

function resultStack(workloadScan: WorkloadConfigurationScanSummary, framework: FrameWork) {
  function box(color: string, severity: string) {
    return (
      <Box
        sx={{
          borderLeft: 2,
          borderTop: 1,
          borderRight: 1,
          borderBottom: 1,
          borderColor: `gray gray gray ${color}`,
          textAlign: 'center',
          width: 20,
        }}
      >
        <Tooltip title={controlsList(workloadScan, framework, severity)}>
          <Box>
            {
              Object.values(workloadScan.spec.controls)
                .filter(w => !w.exceptedByPolicy)
                .filter(
                  scan =>
                    !scan.exceptedByPolicy &&
                    scan.status.status === WorkloadConfigurationScanSummary.Status.Failed &&
                    scan.severity.severity === severity
                ).length
            }
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {box('purple', 'Critical')}
      {box('red', 'High')}
      {box('orange', 'Medium')}
      {box('yellow', 'Low')}
    </Stack>
  );
}

function countResourceScans(workloadScan: WorkloadConfigurationScanSummary) {
  const counters: number[] = [];
  const severities = ['Critical', 'High', 'Medium', 'Low'];

  severities.forEach(severity => {
    const count = Object.values(workloadScan.spec.controls).filter(
      scan =>
        scan.status.status === WorkloadConfigurationScanSummary.Status.Failed &&
        scan.severity.severity === severity
    ).length;
    counters.push(count);
  });

  return counters;
}

function getWorkloadsWithFindings(
  workloadScanData: WorkloadConfigurationScanSummary[]
): WorkloadConfigurationScanSummary[] {
  const workloads = [];
  for (const workload of workloadScanData) {
    for (const scan of Object.values(workload.spec.controls) as any) {
      if (scan.status.status === 'failed') {
        workloads.push(workload);
        break;
      }
    }
  }
  return workloads;
}
