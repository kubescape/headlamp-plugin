/* 
  List configuration scans for all workloads.  
*/
import { Link, TableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Stack } from '@mui/material';
import { useMemo } from 'react';
import { severityColors, SeverityCountStack } from '../common/SeverityCountBox';
import Table from '../common/Table';
import { RoutingName, useHLSelectedClusters } from '../index';
import { FrameWork } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

export default function KubescapeWorkloadConfigurationScanList(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[] | null;
    framework: FrameWork;
    isFailedControlSwitchChecked: boolean;
  }>
) {
  const clusters = useHLSelectedClusters();

  const { workloadScanData, framework, isFailedControlSwitchChecked } = props;
  // the same rows on every render, so the table does not compute its cells again
  const workloads = useMemo(
    () =>
      workloadScanData && isFailedControlSwitchChecked
        ? getWorkloadsWithFindings(workloadScanData)
        : workloadScanData,
    [workloadScanData, isFailedControlSwitchChecked]
  );
  if (!workloadScanData || !workloads) {
    return <></>;
  }

  const labels = (w: WorkloadConfigurationScanSummary) => w.metadata.labels;
  return (
    <Box>
      <Table
        csvExport={{
          fileName: 'kubescape-compliance-resources.csv',
          header: [
            'Name',
            'Kind',
            'Namespace',
            'Cluster',
            'Excluded',
            ...Object.keys(severityColors).map(severity => `${severity} failed controls`),
            'Failed controls',
          ],
          rows: () =>
            workloads.map(w => [
              labels(w)['kubescape.io/workload-name'],
              labels(w)['kubescape.io/workload-kind'],
              labels(w)['kubescape.io/workload-namespace'],
              w.metadata.cluster,
              w.exceptedByPolicy ? 'Yes' : 'No',
              ...Object.keys(severityColors).map(
                severity =>
                  failedControls(w).filter(scan => scan.severity.severity === severity).length
              ),
              failedControls(w)
                .map(scan => scan.controlID)
                .join('; '),
            ]),
        }}
        data={workloads}
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
                  cluster: row.original.metadata.cluster,
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
            Cell: ({ cell }: any) => (cell.getValue() ? 'Yes' : 'No'),
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
          clusters.length > 1
            ? {
                header: 'Cluster',
                accessorKey: 'metadata.cluster',
              }
            : ({} as TableColumn<WorkloadConfigurationScanSummary>),
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

// Failed controls of a resource that no exception applies to
function failedControls(workloadScan: WorkloadConfigurationScanSummary) {
  return Object.values(workloadScan.spec.controls).filter(
    scan =>
      !scan.exceptedByPolicy &&
      scan.status.status === WorkloadConfigurationScanSummary.Status.Failed
  );
}

function resultStack(workloadScan: WorkloadConfigurationScanSummary, framework: FrameWork) {
  return (
    <SeverityCountStack
      count={severity =>
        failedControls(workloadScan).filter(scan => scan.severity.severity === severity).length
      }
      tooltip={severity => controlsList(workloadScan, framework, severity)}
    />
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
