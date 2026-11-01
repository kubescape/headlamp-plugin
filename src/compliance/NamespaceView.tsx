/* 
  Information about a namespace and failed workloads. 
*/
import {
  Link as HeadlampLink,
  SectionBox,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useMemo } from 'react';
import Table from '../common/Table';
import { RoutingName, useHLSelectedClusters } from '../index';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

class NamespaceResult {
  namespace: string;
  cluster: string;
  criticalCount: number = 0;
  highCount: number = 0;
  mediumCount: number = 0;
  lowCount: number = 0;
  total: number = 0;
  unknownCount: number = 0;
  passed: number = 0;
  failed: number = 0;
  exceptedControls: number = 0;
  exceptedNamespace: boolean = false;

  constructor(namespace: string, cluster: string) {
    this.namespace = namespace;
    this.cluster = cluster;
  }
}

export default function NamespaceView(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[] | null;
  }>
) {
  const clusters = useHLSelectedClusters();
  const { workloadScanData } = props;
  const namespaceResults = useMemo(
    () => (workloadScanData ? getNamespaceResults(workloadScanData) : []),
    [workloadScanData]
  );
  if (!workloadScanData) {
    return <></>;
  }

  return (
    <SectionBox>
      <Table
        data={namespaceResults}
        columns={[
          {
            id: 'Namespace',
            header: 'Namespace',
            accessorKey: 'namespace',
            Cell: ({ cell }: any) => (
              <HeadlampLink
                routeName={RoutingName.KubescapeConfigurationScanNamespaceSummary}
                params={{
                  namespace: cell.getValue(),
                }}
              >
                {cell.getValue()}
              </HeadlampLink>
            ),
          },
          clusters.length > 1
            ? {
                header: 'Cluster',
                accessorKey: 'cluster',
              }
            : ({} as TableColumn<NamespaceResult>),
          {
            header: 'Passed',
            accessorFn: (namespaceResult: NamespaceResult) =>
              namespaceResult.total === namespaceResult.exceptedControls
                ? 100
                : namespaceResult.passed / namespaceResult.total,
            Cell: ({ cell }: any) => <progress value={cell.getValue()} />,
          },
          {
            header: 'Excluded Namespace',
            accessorKey: 'exceptedNamespace',
            Cell: ({ cell }: any) => (cell.getValue() ? 'Yes' : 'No'),
            gridTemplate: 'auto',
          },
          {
            header: 'Compliance',
            accessorFn: (namespaceResult: NamespaceResult) =>
              namespaceResult.total === namespaceResult.exceptedControls
                ? 100
                : Math.trunc((namespaceResult.passed / namespaceResult.total) * 100),
            Cell: ({ cell }: any) => cell.getValue() + '%',
            gridTemplate: 'auto',
          },
          {
            header: 'Excluded Controls',
            accessorKey: 'exceptedControls',
            gridTemplate: 'min-content',
          },
          {
            header: 'Critical',
            accessorKey: 'criticalCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'High',
            accessorKey: 'highCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'Medium',
            accessorKey: 'mediumCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'Low',
            accessorKey: 'lowCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'Unknown',
            accessorKey: 'unknownCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'Total',
            accessorKey: 'total',
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'Namespace',
              desc: false,
            },
          ],
        }}
        reflectInURL="namespaces"
      />
    </SectionBox>
  );
}

function getNamespaceResults(
  workloadScanData: WorkloadConfigurationScanSummary[]
): NamespaceResult[] {
  // the same namespace in two clusters is two rows
  const namespaces = new Map<string, NamespaceResult>();

  for (const scan of workloadScanData) {
    const key = `${scan.metadata.cluster}/${scan.metadata.namespace}`;
    let namespaceResult = namespaces.get(key);
    if (!namespaceResult) {
      namespaceResult = new NamespaceResult(scan.metadata.namespace, scan.metadata.cluster);
      // excepted while all its workloads are
      namespaceResult.exceptedNamespace = true;
      namespaces.set(key, namespaceResult);
    }
    if (!scan.exceptedByPolicy) namespaceResult.exceptedNamespace = false;

    for (const controlResult of Object.values(scan.spec.controls)) {
      namespaceResult.total++;

      if (scan.exceptedByPolicy || controlResult.exceptedByPolicy) {
        namespaceResult.exceptedControls++;
      } else if (controlResult.status.status === WorkloadConfigurationScanSummary.Status.Failed) {
        namespaceResult.failed++;
        switch (controlResult.severity?.severity?.toLowerCase()) {
          case 'critical': {
            namespaceResult.criticalCount++;
            break;
          }
          case 'high': {
            namespaceResult.highCount++;
            break;
          }
          case 'medium': {
            namespaceResult.mediumCount++;
            break;
          }
          case 'low': {
            namespaceResult.lowCount++;
            break;
          }
          case 'unknown': {
            namespaceResult.unknownCount++;
            break;
          }
        }
      } else if (controlResult.status.status === WorkloadConfigurationScanSummary.Status.Passed) {
        namespaceResult.passed++;
      }
    }
  }

  return [...namespaces.values()];
}
