/* 
  List configuration scans for all workloads.  
*/
import { Link, Table } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Stack, Tooltip } from '@mui/material';
import { RoutingName } from '../index';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { FrameWork } from './FrameWork';

export default function KubescapeWorkloadConfigurationScanList(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[] | null;
    framework: FrameWork;
    isFailedControlSwitchChecked: boolean;
  }>
) {
  const { workloadScanData, framework, isFailedControlSwitchChecked } = props;
  if (!workloadScanData) {
    return <></>;
  }

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
              Object.values(workloadScan.spec.controls).filter(
                scan =>
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
