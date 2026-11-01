/*
  Show workload configuration scans. This view is part of the main Vulnerabilities page.
*/
import {
  Link,
  SectionBox,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { makeNamespaceLink } from '../common/Namespace';
import { SeverityCountStack } from '../common/SeverityCountBox';
import HeadlampTable from '../common/Table';
import { RoutingName, useHLSelectedClusters } from '../index';
import { WorkloadScan } from './Vulnerabilities';

export default function WorkloadScanListView(
  props: Readonly<{
    workloadScans: WorkloadScan[] | null;
  }>
) {
  const { workloadScans } = props;
  const clusters = useHLSelectedClusters();

  if (!workloadScans) {
    return <></>;
  }

  const filteredWorkloadScans = workloadScans.filter(w => w.name && w.namespace);

  return (
    <>
      <h5>{filteredWorkloadScans.length} resources</h5>
      <SectionBox>
        <HeadlampTable
          csvExport={{
            fileName: 'kubescape-vulnerable-resources.csv',
            header: [
              'Name',
              'Container',
              'Kind',
              'Namespace',
              'Cluster',
              'Image',
              'Critical',
              'High',
              'Medium',
              'Low',
              'Relevant',
            ],
            rows: () =>
              filteredWorkloadScans.map(w => [
                w.name,
                w.container,
                w.kind,
                w.namespace,
                w.cluster,
                w.imageScan?.imageName,
                ...['Critical', 'High', 'Medium', 'Low'].map(severity => countScans(w, severity)),
                relevantSummary(w),
              ]),
          }}
          data={filteredWorkloadScans}
          columns={[
            {
              header: 'Name',
              accessorKey: 'name',
              Cell: ({ cell }: any) => {
                return (
                  <Link
                    routeName={RoutingName.KubescapeVulnerabilityDetails}
                    activeCluster={cell.row.original.cluster}
                    params={{
                      name: cell.row.original.manifestName,
                      namespace: cell.row.original.namespace,
                    }}
                  >
                    {cell.getValue()}
                  </Link>
                );
              },
              gridTemplate: 'max-content',
            },
            {
              header: 'Container',
              accessorKey: 'container',
              gridTemplate: 'min-content',
            },
            {
              header: 'Kind',
              accessorKey: 'kind',
              gridTemplate: 'min-content',
            },
            {
              header: 'Namespace',
              accessorKey: 'namespace',
              Cell: ({ cell }: any) => makeNamespaceLink(cell.getValue()),
              gridTemplate: 'min-content',
            },
            clusters.length > 1
              ? {
                  header: 'Cluster',
                  accessorKey: 'cluster',
                }
              : ({} as TableColumn<WorkloadScan>),
            {
              header: 'Image',
              accessorFn: (workloadScan: WorkloadScan) => workloadScan.imageScan?.imageName,
            },
            {
              id: 'CVE',
              header: 'CVE',
              Cell: ({ row }: any) => resultStack(row.original),
              accessorFn: (workloadScan: WorkloadScan) =>
                countResourceScans(workloadScan).join('.'),
            },
            {
              header: 'Relevant',
              accessorFn: relevantSummary,
              gridTemplate: 'min-content',
            },
            {
              header: 'SBOM',
              accessorFn: (workloadScan: WorkloadScan) => {
                if (workloadScan.imageScan?.manifestName) {
                  return (
                    <Link
                      routeName={RoutingName.KubescapeSBOMDetails}
                      activeCluster={workloadScan.cluster}
                      params={{
                        name:
                          workloadScan.relevant?.manifestName ??
                          workloadScan.imageScan?.manifestName,
                        namespace: (workloadScan.relevant ?? workloadScan.imageScan).namespace,
                      }}
                      search={workloadScan.relevant ? '?filtered' : ''}
                    >
                      SBOM
                    </Link>
                  );
                }
              },
              gridTemplate: 'min-content',
            },
          ]}
          initialState={{
            sorting: [
              {
                id: 'CVE',
                desc: true,
              },
            ],
          }}
          reflectInURL="resources"
        />
      </SectionBox>
    </>
  );
}

// Number of relevant findings of the total, e.g. "3 of 40"
function relevantSummary(workloadScan: WorkloadScan): string {
  if (!workloadScan.imageScan) return 'Unknown';

  const total = workloadScan.imageScan.matches.length;
  if (!workloadScan.relevant) return `? of ${total}`;

  const relevantIds = new Set(workloadScan.relevant.matches.map(r => r.vulnerability.id));
  const count = workloadScan.imageScan.matches.filter(match =>
    relevantIds.has(match.vulnerability.id)
  ).length;
  return `${count} of ${total}`;
}

function countScans(workloadScan: WorkloadScan, severity: string): number {
  let count: number = 0;

  if (workloadScan.imageScan) {
    for (const match of workloadScan.imageScan.matches) {
      if (match.vulnerability.severity === severity) {
        count++;
      }
    }
  }
  return count;
}

function resultStack(workloadScan: WorkloadScan) {
  if (!workloadScan.imageScan) {
    return <div />;
  }

  return (
    <SeverityCountStack
      count={severity => countScans(workloadScan, severity)}
      link={{
        routeName: RoutingName.KubescapeVulnerabilityDetails,
        params: { name: workloadScan.manifestName, namespace: workloadScan.namespace },
        activeCluster: workloadScan.cluster,
      }}
    />
  );
}

function countResourceScans(workloadScan: WorkloadScan) {
  const counters: number[] = [];
  const severities = ['Critical', 'High', 'Medium', 'Low'];

  severities.map(severity => {
    const count = countScans(workloadScan, severity);
    counters.push(count);
  });

  return counters;
}
