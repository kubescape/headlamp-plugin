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
    <SectionBox title="Configuration scans">
      <NameValueTable
        rows={[
          {
            name: 'Namespace',
            value: configurationScanSummary.metadata.name,
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
