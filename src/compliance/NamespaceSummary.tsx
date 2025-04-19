/* 
  Show the configuration findings for workloads in a single namespace.  
*/
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { Box, Stack } from '@mui/material';
import { useState } from 'react';
import { getLastURLSegment } from '../common/url';
import { RoutingName } from '../index';
import { configurationScanSummariesClass } from '../model';
import { ConfigurationScanSummary } from '../softwarecomposition/ConfigurationScanSummary';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext } from './Compliance';

export default function KubescapeConfigurationScanNamespaceSummary() {
  const namespace = getLastURLSegment();
  const [configurationScanSummary, setConfigurationScanSummary] = useState<KubeObject | null>(null);

  configurationScanSummariesClass.useApiGet(setConfigurationScanSummary, namespace);

  if (!configurationScanSummary) {
    return <></>;
  }
  return (
    <SectionBox title="Namespace Configuration scans" backLink>
      <NameValueTable
        rows={[
          {
            name: 'Namespace',
            value: configurationScanSummary.metadata.name,
          },
          {
            name: 'Failed Controls',
            value: resultStack(configurationScanSummary.jsonData),
          },
        ]}
      />

      <ConfigurationScans namespace={namespace} />
    </SectionBox>
  );
}

function ConfigurationScans(props: Readonly<{ namespace: string }>) {
  const { namespace } = props;

  const configurationScans = configurationScanContext.workloadScans.filter(
    w => w.metadata.namespace === namespace
  );

  return (
    <Table
      data={configurationScans}
      columns={[
        {
          header: 'Namespace',
          accessorKey: 'metadata.name',
          Cell: ({ cell }: any) => (
            <HeadlampLink
              routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
              params={{
                name: cell.row.original.metadata.name,
                namespace: cell.row.original.metadata.namespace,
              }}
            >
              {cell.getValue()}
            </HeadlampLink>
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
          Cell: ({ row }: any) => resultStack(row.original),
          accessorFn: (w: WorkloadConfigurationScanSummary) =>
            Object.values(w.spec.controls).filter(
              scan => scan.status.status === WorkloadConfigurationScanSummary.Status.Failed
            ).length,
          gridTemplate: 'auto',
        },
      ]}
    />
  );
}

export function resultStack(scanSummary: ConfigurationScanSummary) {
  const severities = scanSummary.spec.severities;

  const criticalCount = severities.critical;
  const mediumCount = severities.medium;
  const highCount = severities.high;
  const lowCount = severities.low;

  function controlsBox(color: string, severity: string, countScan: number) {
    return (
      <Box
        sx={{
          borderLeft: 2,
          borderTop: 1,
          borderRight: 1,
          borderBottom: 1,
          borderColor: `gray gray gray ${color}`,
          textAlign: 'center',
          width: 100,
        }}
      >
        {countScan} {severity}
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {controlsBox('purple', 'Critical', criticalCount)}
      {controlsBox('red', 'High', highCount)}
      {controlsBox('orange', 'Medium', mediumCount)}
      {controlsBox('yellow', 'Low', lowCount)}
    </Stack>
  );
}
