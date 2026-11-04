/*
  Show workload configuration scans. This view is part of the main Vulnerabilities page.
*/
import { Icon } from '@iconify/react';
import { Link, SectionBox, TableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useMemo, useState } from 'react';
import { makeNamespaceLink } from '../common/Namespace';
import { createExceptionCheck, PermittedIconButton } from '../common/permissions';
import { severityColors, SeverityCountStack } from '../common/SeverityCountBox';
import HeadlampTable from '../common/Table';
import { GuidedVulnerabilityExceptionForm } from '../exceptions/GuidedVulnerabilityExceptionForm';
import {
  summarizeWorkloadExceptions,
  workloadCveExceptions,
  WorkloadExceptions,
} from '../exceptions/vulnerabilityExceptions';
import { RoutingName, useHLSelectedClusters } from '../index';
import { AcceptedChip, useSecurityExceptions } from './exceptionChips';
import { WorkloadScan } from './Vulnerabilities';

export default function WorkloadScanListView(
  props: Readonly<{
    workloadScans: WorkloadScan[] | null;
  }>
) {
  const { workloadScans } = props;
  const clusters = useHLSelectedClusters();
  const kinds = useMemo(() => (workloadScans ?? []).map(w => w.kind), [workloadScans]);
  const { exceptions, reload } = useSecurityExceptions(clusters, kinds);
  const [accepting, setAccepting] = useState<{ workloadScan: WorkloadScan; cveIds: string[] }>();

  // what the exceptions say about the CVEs of each workload
  const exceptionSummaries = useMemo(() => {
    const summaries = new Map<WorkloadScan, WorkloadExceptions>();
    for (const workloadScan of workloadScans ?? []) {
      const data = exceptions.get(workloadScan.cluster);
      const imageScan = workloadScan.imageScan;
      if (!data || !imageScan) continue;
      const covered = workloadCveExceptions(data, {
        kind: workloadScan.kind,
        name: workloadScan.name,
        namespace: workloadScan.namespace,
        image: imageScan.imageName,
      });
      if (covered.size === 0) continue;
      summaries.set(
        workloadScan,
        summarizeWorkloadExceptions(covered, imageScan.matches, imageScan.ignoredMatches)
      );
    }
    return summaries;
  }, [workloadScans, exceptions]);

  if (!workloadScans) {
    return <></>;
  }

  const filteredWorkloadScans = workloadScans.filter(w => w.name && w.namespace);
  const acceptedCount = (workloadScan: WorkloadScan) =>
    exceptionSummaries.get(workloadScan)?.accepted.size ?? 0;
  // the CVEs that no exception covers yet
  const openCves = (workloadScan: WorkloadScan) =>
    exceptionSummaries.get(workloadScan)?.open ?? [
      ...new Set(workloadScan.imageScan?.matches.map(match => match.vulnerability.id)),
    ];

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
              ...Object.keys(severityColors),
              'Relevant',
              'Accepted',
            ],
            rows: () =>
              filteredWorkloadScans.map(w => [
                w.name,
                w.container,
                w.kind,
                w.namespace,
                w.cluster,
                w.imageScan?.imageName,
                ...Object.keys(severityColors).map(severity => countScans(w, severity)),
                relevantSummary(w),
                acceptedCount(w),
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
              id: 'Accepted',
              header: 'Accepted',
              accessorFn: acceptedCount,
              Cell: ({ row }: any) => {
                const summary = exceptionSummaries.get(row.original);
                return summary ? (
                  <AcceptedChip summary={summary} cluster={row.original.cluster} />
                ) : null;
              },
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
            {
              header: '',
              accessorFn: () => '',
              // rendered for the rows on the page only
              Cell: ({ row }: any) => {
                const workloadScan: WorkloadScan = row.original;
                const cveIds = openCves(workloadScan);
                return (
                  cveIds.length > 0 && (
                    <PermittedIconButton
                      check={createExceptionCheck(workloadScan.namespace)}
                      cluster={workloadScan.cluster}
                      title={`Accept the risk of the ${
                        cveIds.length === 1 ? 'open CVE' : `${cveIds.length} open CVEs`
                      }`}
                      onClick={() => setAccepting({ workloadScan, cveIds })}
                    >
                      <Icon icon="mdi:shield-check-outline" />
                    </PermittedIconButton>
                  )
                );
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

      {accepting && (
        <GuidedVulnerabilityExceptionForm
          acceptRisk
          cveIds={accepting.cveIds}
          imageRef={accepting.workloadScan.imageScan?.imageName}
          workloadName={accepting.workloadScan.name}
          workloadNamespace={accepting.workloadScan.namespace}
          workloadKind={accepting.workloadScan.kind}
          cluster={accepting.workloadScan.cluster}
          onClose={() => setAccepting(undefined)}
          onCreated={reload}
        />
      )}
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
