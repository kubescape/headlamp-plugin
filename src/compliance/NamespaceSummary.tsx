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

export default function KubescapeConfigurationScanNamespaceSummary() {
  const namespace = getLastURLSegment();
  const [configurationScanSummary, setConfigurationScanSummary] = useState<KubeObject | null>(null);

  configurationScanSummariesClass.useApiGet(setConfigurationScanSummary, namespace);

  if (!configurationScanSummary) {
    return <></>;
  }
  return (
    <SectionBox title="Namespace Configuration scans">
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

      <ConfigurationScans configurationScans={configurationScanSummary.jsonData.spec.summaryRef} />
    </SectionBox>
  );
}

function ConfigurationScans(
  props: Readonly<{ configurationScans: ConfigurationScanSummary.SummaryRef[] }>
) {
  const { configurationScans } = props;

  return (
    <Table
      data={configurationScans}
      columns={[
        {
          header: 'Namespace',
          accessorKey: 'name',
          Cell: ({ cell }: any) => (
            <HeadlampLink
              routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
              params={{
                name: cell.row.original.name,
                namespace: cell.row.original.namespace,
              }}
            >
              {cell.getValue()}
            </HeadlampLink>
          ),
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
