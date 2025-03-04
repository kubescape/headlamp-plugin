/* 
  Show the configuration findings for workloads in a single namespace.  
*/
import { KubeObject } from '@kinvolk/headlamp-plugin/lib';
import {
  Link as HeadlampLink,
  MainInfoSection,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useState } from 'react';
import { getLastURLSegment } from '../common/url';
import { RoutingName } from '../index';
import { configurationScanSummariesClass } from '../model';
import { ConfigurationScanSummary } from '../softwarecomposition/ConfigurationScanSummary';

export default function KubescapeConfigurationScanNamespaceSummary() {
  const namespace = getLastURLSegment();
  const [configurationScanSummary, setConfigurationScanSummary] = useState<KubeObject>(null);

  configurationScanSummariesClass.useApiGet(setConfigurationScanSummary, namespace);

  return (
    <>
      {configurationScanSummary && (
        <MainInfoSection
          title="Namespace Configuration Scans"
          resource={configurationScanSummary}
        />
      )}

      {configurationScanSummary && (
        <ConfigurationScans
          configurationScans={configurationScanSummary.jsonData.spec.summaryRef}
        />
      )}
    </>
  );
}

function ConfigurationScans(
  props: Readonly<{ configurationScans: ConfigurationScanSummary.SummaryRef[] }>
) {
  const { configurationScans } = props;

  return (
    <SectionBox title="Configuration scans">
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
    </SectionBox>
  );
}
