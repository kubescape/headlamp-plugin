/* 
  Show configuration scan results for a workload. 
*/
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  StatusLabel,
  StatusLabelProps,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Link } from '@mui/material';
import { useEffect, useState } from 'react';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { fetchObject, workloadConfigurationScanClass } from '../model';
import { controls } from '../rego';
import { WorkloadConfigurationScan } from '../softwarecomposition/WorkloadConfigurationScan';
import { configurationScanContext } from './Compliance';

export default function KubescapeWorkloadConfigurationScanDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [configurationScan, setConfigurationScan] = useState<WorkloadConfigurationScan | null>(
    null
  );

  useEffect(() => {
    fetchObject(name, namespace, workloadConfigurationScanClass).then(
      (result: WorkloadConfigurationScan) => {
        const workloadConfigurationScanSummary = configurationScanContext.workloadScans.find(
          w =>
            w.metadata.name === result.metadata.name &&
            w.metadata.namespace === result.metadata.namespace
        );

        if (workloadConfigurationScanSummary) {
          result.exceptedByPolicy = workloadConfigurationScanSummary.exceptedByPolicy;
          Object.values(result.spec.controls).forEach(control => {
            control.exceptedByPolicy = Object.values(
              workloadConfigurationScanSummary.spec.controls
            ).some(scan => scan.controlID === control.controlID && scan.exceptedByPolicy);
          });
        }
        setConfigurationScan(result);
      }
    );
  }, []);
  if (!configurationScan) {
    return <></>;
  }

  return (
    <>
      <SectionBox title="Workload Configuration Scan" backLink>
        <NameValueTable
          rows={[
            {
              name: 'Name',
              value: configurationScan.metadata.labels['kubescape.io/workload-name'],
            },
            {
              name: 'Namespace',
              value: configurationScan.metadata.labels['kubescape.io/workload-namespace'],
            },
            {
              name: 'Kind',
              value: configurationScan.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              name: 'Last scan',
              value: configurationScan.metadata.creationTimestamp,
            },
            {
              name: 'Results',
              value: getResults(configurationScan),
            },
          ]}
        />
      </SectionBox>

      <Controls workloadConfigurationScan={configurationScan} />
    </>
  );
}

function Controls(props: Readonly<{ workloadConfigurationScan: WorkloadConfigurationScan }>) {
  const { workloadConfigurationScan } = props;

  return (
    <SectionBox title="Controls">
      <HeadlampTable
        data={Object.values(workloadConfigurationScan.spec.controls)}
        columns={[
          {
            id: 'Status',
            header: 'Status',
            accessorKey: 'status.status',
            Cell: ({ row }: any) => makeStatusLabel(workloadConfigurationScan, row.original),
            gridTemplate: 'min-content',
          },
          {
            header: 'Control',
            accessorKey: 'controlID',
            Cell: ({ cell }: any) => {
              return (
                <Link
                  target="_blank"
                  href={'https://hub.armosec.io/docs/' + cell.getValue().toLowerCase()}
                >
                  {cell.getValue()}
                </Link>
              );
            },
            gridTemplate: 'min-content',
          },
          {
            header: 'Name',
            accessorKey: 'name',
          },
          {
            header: 'Category',
            accessorFn: (control: WorkloadConfigurationScan.Control) => {
              const controlInfo = controls.find(
                controlInfo => controlInfo.controlID === control.controlID
              );
              return controlInfo?.category?.subCategory?.name ?? controlInfo?.category?.name;
            },
            gridTemplate: 'auto',
          },
          {
            header: 'Severity',
            accessorKey: 'severity.severity',
            gridTemplate: 'min-content',
          },
          {
            header: 'Explain',
            accessorFn: (control: WorkloadConfigurationScan.Control) =>
              controls.find(controlInfo => controlInfo.controlID === control.controlID)
                ?.description,
          },
          {
            header: 'Remediation',
            accessorFn: (control: WorkloadConfigurationScan.Control) =>
              controls.find(controlInfo => controlInfo.controlID === control.controlID)
                ?.remediation,
          },
          {
            header: '',
            accessorFn: (control: WorkloadConfigurationScan.Control) => {
              if (control.rules.some(rule => rule.paths)) {
                return (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeWorkloadConfigurationScanFixes}
                    params={{
                      name: workloadConfigurationScan.metadata.name,
                      namespace: workloadConfigurationScan.metadata.namespace,
                      control: control.controlID,
                    }}
                  >
                    Fix
                  </HeadlampLink>
                );
              }
            },
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'Status',
              desc: false,
            },
          ],
        }}
      />
    </SectionBox>
  );
}

function getResults(workloadConfigurationScan: WorkloadConfigurationScan): string {
  let failCount: number = 0;
  let passedCount: number = 0;
  let skippedCount: number = 0;
  let excludedCount: number = 0;
  if (workloadConfigurationScan.exceptedByPolicy) {
    excludedCount = Object.values(workloadConfigurationScan.spec.controls).length;
  } else {
    for (const scan of Object.values(workloadConfigurationScan.spec.controls)) {
      if (scan.exceptedByPolicy) {
        excludedCount++;
        continue;
      }
      switch (scan.status.status) {
        case 'failed': {
          failCount++;
          break;
        }
        case 'passed': {
          passedCount++;
          break;
        }
        case 'skipped': {
          skippedCount++;
          break;
        }
      }
    }
  }

  return `Failed ${failCount}, Passed ${passedCount}, Skipped ${skippedCount}, Excluded ${excludedCount}`;
}

function makeStatusLabel(
  workloadConfigurationScan: WorkloadConfigurationScan,
  control: WorkloadConfigurationScan.Control
) {
  let status: StatusLabelProps['status'] = '';
  let statusLabel: string = control.status.status;

  if (workloadConfigurationScan.exceptedByPolicy || control.exceptedByPolicy) {
    statusLabel = 'excluded';
  } else if (statusLabel === 'failed') {
    status = 'error';
  } else {
    status = 'success';
  }

  return <StatusLabel status={status}>{statusLabel}</StatusLabel>;
}
