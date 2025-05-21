/* 
  Information about a control and failed workloads. 
*/
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  Table,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { FormControlLabel, Link, Switch } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { makeNamespaceLink } from '../common/Namespace';
import { KubescapeSettings, useSessionStorage } from '../common/sessionStorage';
import { getLastURLSegment } from '../common/url';
import { mutateControlException } from '../exceptions/mutate-exception';
import { RoutingName, useHLSelectedClusters } from '../index';
import { Control, controls } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext } from './Compliance';

export default function KubescapeControlResults() {
  const { enqueueSnackbar } = useSnackbar();
  const controlID = getLastURLSegment();
  const clusters = useHLSelectedClusters();

  const [isFailedControlSwitchChecked, setIsFailedControlSwitchChecked] =
    useSessionStorage<boolean>(KubescapeSettings.FailedControls, true);
  const [resourceList, setResourceList] = useState<WorkloadConfigurationScanSummary[]>(
    getFailedResources(controlID, isFailedControlSwitchChecked)
  );
  const control = controls.find(element => element.controlID === controlID);

  if (!control) {
    return <p>The control {controlID} was not found.</p>;
  }

  const setIsFailedControlSwitchChecked2 = (checked: boolean) => {
    setIsFailedControlSwitchChecked(checked);
    setResourceList(getFailedResources(controlID, checked));
  };

  const handleExcludeControl = async (
    workloadScan: WorkloadConfigurationScanSummary,
    control: Control,
    checked: boolean
  ) => {
    const errorMessage = await mutateControlException(
      workloadScan.metadata.labels['kubescape.io/workload-name'],
      workloadScan.metadata.namespace,
      workloadScan.metadata.labels['kubescape.io/workload-kind'],
      control,
      checked
    );
    if (errorMessage) {
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } else {
      Object.entries(workloadScan.spec.controls).forEach(([key, value]) => {
        if (value.controlID === control.controlID) {
          workloadScan.spec.controls[key].exceptedByPolicy = checked;
        }
      });
      setResourceList([...resourceList]);
    }
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
                const control = Object.values(workloadScan.spec.controls).find(
                  control => control.controlID === controlID
                );
                if (workloadScan.exceptedByPolicy || control?.exceptedByPolicy) {
                  return 'excluded';
                }
                return control?.status.status;
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
              header: 'Excluded',
              accessorFn: (workloadScan: WorkloadConfigurationScanSummary) =>
                Object.values(workloadScan.spec.controls).some(
                  control => control.controlID === controlID && control.exceptedByPolicy
                ),
              Cell: ({ cell }: any) => (
                <FormControlLabel
                  label=""
                  checked={cell.getValue()}
                  control={<Switch color="primary" />}
                  onChange={(event: any, checked: boolean) => {
                    handleExcludeControl(cell.row.original, control, checked);
                  }}
                />
              ),
              gridTemplate: 'auto',
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
                      cluster: workloadScan.metadata.cluster,
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
