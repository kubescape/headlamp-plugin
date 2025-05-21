/* 
  Information about a namespace and failed workloads. 
*/
import {
  Link as HeadlampLink,
  SectionBox,
  Table,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { FormControlLabel, Switch } from '@mui/material';
import { useSnackbar } from 'notistack';
import { mutateNamespaceException } from '../exceptions/mutate-exception';
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
    setWorkloadScanData: (workloadScanData: WorkloadConfigurationScanSummary[]) => void;
  }>
) {
  const clusters = useHLSelectedClusters();
  const { enqueueSnackbar } = useSnackbar();
  const { workloadScanData, setWorkloadScanData } = props;
  if (!workloadScanData) {
    return <></>;
  }

  const handleExcludeNamespace = async (namespace: NamespaceResult, checked: boolean) => {
    const errorMessage = await mutateNamespaceException(namespace.namespace, checked);
    if (errorMessage) {
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } else {
      workloadScanData.forEach(w => {
        if (w.metadata.namespace === namespace.namespace) {
          w.exceptedByPolicy = checked;
        }
      });
      setWorkloadScanData([...workloadScanData]);
    }
  };

  return (
    <SectionBox>
      <Table
        data={getNamespaceResults(workloadScanData)}
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
            Cell: ({ cell }: any) => (
              <FormControlLabel
                label=""
                checked={cell.getValue() === true}
                control={<Switch color="primary" />}
                onChange={(event: any, checked: boolean) => {
                  handleExcludeNamespace(cell.row.original, checked);
                }}
              />
            ),
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
  const namespaces: NamespaceResult[] = [];

  for (const scan of workloadScanData) {
    let namespaceResult = namespaces.find(ns => ns.namespace === scan.metadata.namespace);
    if (!namespaceResult) {
      namespaceResult = new NamespaceResult(scan.metadata.namespace, scan.metadata.cluster);
      namespaces.push(namespaceResult);
      namespaceResult.exceptedNamespace = !workloadScanData
        .filter(w => w.metadata.namespace === scan.metadata.namespace)
        .some(w => !w.exceptedByPolicy);
    }

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

  return namespaces;
}
