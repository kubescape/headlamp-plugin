/* 
  Information about a control and failed workloads. 
*/
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { createRouteURL } from '@kinvolk/headlamp-plugin/lib/Router';
import { Link } from '@mui/material';
import { makeNamespaceLink } from '../common/Namespace';
import { getLastURLSegment } from '../common/url';
import { RoutingName } from '../index';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext } from './Compliance';
import controlLibrary from './controlLibrary';

export default function KubescapeControlResults() {
  const controlID = getLastURLSegment();
  const control = controlLibrary.find(element => element.controlID === controlID);

  if (!control) {
    return <p>The control {controlID} was not found.</p>;
  }

  const resourceList =
    configurationScanContext.workloadScans?.filter(w =>
      Object.values(w.spec.controls).some(scan => scan.controlID === controlID)
    ) ?? [];

  return (
    <>
      <SectionBox
        title={`${controlID}: ${control.name}`}
        backLink={createRouteURL(RoutingName.ComplianceView)}
      >
        <NameValueTable
          rows={[
            {
              name: 'Description',
              value: control.description,
            },
            {
              name: 'Category',
              value: control.category?.name,
            },
            {
              name: 'Remediation',
              value: control.remediation,
            },
            {
              name: 'More information',
              value: (
                <Link
                  target="_blank"
                  href={'https://hub.armosec.io/docs/' + controlID.toLowerCase()}
                >
                  https://hub.armosec.io/docs/{controlID.toLowerCase()}
                </Link>
              ),
            },
            {
              name: 'Passed',
              value: `${getPassedResources(resourceList, controlID).length} of ${
                resourceList.length
              }`,
            },
          ]}
        />
      </SectionBox>

      <SectionBox title="Resources">
        <Table
          data={resourceList}
          columns={[
            {
              header: 'Status',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                Object.values(workloadScan.spec.controls).find(
                  control => control.controlID === controlID
                )?.status.status,
            },
            {
              header: 'Name',
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
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                workloadScan.metadata.labels['kubescape.io/workload-name'],
            },
            {
              header: 'Kind',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                workloadScan.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              header: 'Namespace',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                workloadScan.metadata.labels['kubescape.io/workload-namespace'],
              Cell: ({ cell }: any) => (cell.getValue() ? makeNamespaceLink(cell.getValue()) : ''),
            },
            {
              header: 'Scan name',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                workloadScan.metadata.name,
            },
            {
              header: '',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) => {
                if (
                  Object.values(workloadScan.spec.controls).find(
                    control => control.controlID === controlID
                  )?.status.status === WorkloadConfigurationScanSummary.Status.Passed
                )
                  return;
                return (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeWorkloadConfigurationScanFixes}
                    params={{
                      name: workloadScan.metadata.name,
                      namespace: workloadScan.metadata.namespace,
                      control: control.controlID,
                    }}
                  >
                    Fix
                  </HeadlampLink>
                );
                //  }
              },
            },
          ]}
        />
      </SectionBox>
    </>
  );
}

function getPassedResources(
  workloadScanData: WorkloadConfigurationScanSummary[],
  controlID: string
): WorkloadConfigurationScanSummary[] {
  return workloadScanData.filter(w =>
    Object.values(w.spec.controls).some(
      scan =>
        scan.controlID === controlID &&
        scan.status.status === WorkloadConfigurationScanSummary.Status.Passed
    )
  );
}
