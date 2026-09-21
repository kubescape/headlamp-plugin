/*
  Information about a control and failed workloads.
*/
import { Icon } from '@iconify/react';
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  Table,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { FormControlLabel, IconButton, Link, Switch, Tooltip } from '@mui/material';
import { useState } from 'react';
import { makeNamespaceLink } from '../common/Namespace';
import { KubescapeSettings, useSessionStorage } from '../common/sessionStorage';
import { getLastURLSegment } from '../common/url';
import { GuidedComplianceExceptionForm } from '../exceptions/GuidedComplianceExceptionForm';
import { RoutingName, useHLSelectedClusters } from '../index';
import { useRegoData } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext } from './Compliance';

export default function KubescapeControlResults() {
  const controlID = getLastURLSegment();
  const clusters = useHLSelectedClusters();
  const { controls, loading } = useRegoData();

  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] =
    useSessionStorage<boolean>(KubescapeSettings.FailedControls, true);
  const [resourceList, setResourceList] = useState<WorkloadConfigurationScanSummary[]>(
    getFailedResources(controlID, isFailedControlSwitchChecked)
  );
  const [exceptionFormWorkload, setExceptionFormWorkload] =
    useState<WorkloadConfigurationScanSummary | null>(null);
  const control = controls.find(element => element.controlID === controlID);

  if (loading) {
    return <></>;
  }
  if (!control) {
    return <p>The control {controlID} was not found.</p>;
  }

  const setIsFailedControlSwitchChecked2 = (checked: boolean) => {
    setIsFailedControlSwitchChecked(checked);
    setResourceList(getFailedResources(controlID, checked));
  };

  return (
    <>
      <SectionBox title={`${controlID}: ${control.name}`} backLink>
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
                  href={'https://kubescape.io/docs/controls/' + controlID.toLowerCase()}
                >
                  https://kubescape.io/docs/controls/{controlID.toLowerCase()}
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
        <FormControlLabel
          checked={isFailedControlSwitchChecked}
          control={<Switch color="primary" />}
          label={'Failed controls'}
          onChange={(event: any, checked: boolean) => {
            setIsFailedControlSwitchChecked2(checked);
          }}
        />
        <Table
          data={resourceList}
          columns={[
            {
              header: 'Status',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) => {
                const ctl = Object.values(workloadScan.spec.controls).find(
                  c => c.controlID === controlID
                );
                if (workloadScan.exceptedByPolicy || ctl?.exceptedByPolicy) {
                  return 'excluded';
                }
                return ctl?.status.status;
              },
            },
            {
              header: 'Name',
              Cell: ({ cell }: any) => (
                <HeadlampLink
                  routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
                  params={{
                    name: cell.row.original.metadata.name,
                    namespace: cell.row.original.metadata.namespace,
                    cluster: cell.row.original.metadata.cluster,
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
            clusters.length > 1
              ? {
                  header: 'Cluster',
                  accessorKey: 'metadata.cluster',
                }
              : ({} as TableColumn<WorkloadConfigurationScanSummary>),
            {
              header: 'Scan name',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                workloadScan.metadata.name,
            },
            {
              header: '',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) => {
                if (
                  Object.values(workloadScan.spec.controls).find(c => c.controlID === controlID)
                    ?.status.status === WorkloadConfigurationScanSummary.Status.Passed
                )
                  return;
                return (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeWorkloadConfigurationScanFixes}
                    params={{
                      name: workloadScan.metadata.name,
                      namespace: workloadScan.metadata.namespace,
                      cluster: workloadScan.metadata.cluster,
                      control: control.controlID,
                    }}
                  >
                    Fix
                  </HeadlampLink>
                );
              },
            },
            {
              header: '',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) => {
                const scanControl = Object.values(workloadScan.spec.controls).find(
                  c => c.controlID === controlID
                );
                if (
                  !scanControl ||
                  workloadScan.exceptedByPolicy ||
                  scanControl.exceptedByPolicy ||
                  scanControl.status.status !== WorkloadConfigurationScanSummary.Status.Failed
                ) {
                  return null;
                }
                return (
                  <Tooltip title="Create Security Exception">
                    <IconButton size="small" onClick={() => setExceptionFormWorkload(workloadScan)}>
                      <Icon icon="mdi:shield-plus-outline" />
                    </IconButton>
                  </Tooltip>
                );
              },
              gridTemplate: 'auto',
            },
          ]}
        />
      </SectionBox>
      {exceptionFormWorkload && (
        <GuidedComplianceExceptionForm
          controlID={controlID}
          workloadName={exceptionFormWorkload.metadata.labels['kubescape.io/workload-name']}
          workloadNamespace={
            exceptionFormWorkload.metadata.labels['kubescape.io/workload-namespace']
          }
          workloadKind={exceptionFormWorkload.metadata.labels['kubescape.io/workload-kind']}
          onClose={() => setExceptionFormWorkload(null)}
        />
      )}
    </>
  );
}

function getFailedResources(controlID: string, isFailedControlSwitchChecked: boolean) {
  const workloadsAffected = configurationScanContext.workloadScans.filter(w =>
    Object.values(w.spec.controls).some(scan => scan.controlID === controlID)
  );

  if (isFailedControlSwitchChecked) {
    return workloadsAffected.filter(
      w =>
        !w.exceptedByPolicy &&
        Object.values(w.spec.controls).some(
          scan =>
            scan.controlID === controlID &&
            !scan.exceptedByPolicy &&
            scan.status.status !== WorkloadConfigurationScanSummary.Status.Passed
        )
    );
  } else {
    return workloadsAffected;
  }
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
