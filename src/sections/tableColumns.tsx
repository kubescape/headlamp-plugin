/*
  Kubescape columns in the Headlamp resource lists of workloads and pods: the critical and
  high CVEs and failed controls of each workload.
*/
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Box, Stack } from '@mui/material';
import { kubescapeConfigStore } from '../common/config-store';
import { SeverityCountBox } from '../common/SeverityCountBox';
import { RoutingName } from '../index';
import {
  cachedWorkloadSummaries,
  findWorkloadSummary,
  loadWorkloadSummaries,
  scannedWorkloadCandidates,
  SeverityCounts,
  useWorkloadSummaries,
  WorkloadControls,
  WorkloadSummaries,
  WorkloadVulnerabilities,
} from './workloadSummaries';

// The ids of the Headlamp tables that get the columns
export const kubescapeColumnTables = [
  'headlamp-deployments',
  'headlamp-statefulsets',
  'headlamp-daemonsets',
  'headlamp-jobs',
  'headlamp-cronjobs',
  'headlamp-pods',
];

type Which = keyof WorkloadSummaries;

interface ListedItem {
  kind: string;
  cluster?: string;
  metadata: { name: string; namespace: string; labels?: Record<string, string> };
}

function clusterOf(item: ListedItem): string {
  return item.cluster || getCluster() || '';
}

function lookUp(summaries: WorkloadSummaries | undefined, which: Which, item: ListedItem) {
  if (!summaries) return undefined;
  return findWorkloadSummary<SeverityCounts>(
    summaries[which],
    item.metadata.namespace,
    scannedWorkloadCandidates(item)
  );
}

function cachedCounts(which: Which, item: ListedItem) {
  return lookUp(cachedWorkloadSummaries(clusterOf(item), item.metadata.namespace), which, item);
}

// Sorting needs the counts of all rows, also of the namespaces not on the page
function sortedCounts(which: Which, item: ListedItem) {
  loadWorkloadSummaries(clusterOf(item), item.metadata.namespace);
  return cachedCounts(which, item);
}

// Most critical first, then most high; rows without results last
function compareCounts(a: SeverityCounts | undefined, b: SeverityCounts | undefined) {
  if (!a || !b) return Number(!a) - Number(!b);
  return b.critical - a.critical || b.high - a.high || b.medium - a.medium;
}

function breakdown(counts: SeverityCounts) {
  return `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`;
}

function vulnerabilityTooltip(summary: WorkloadVulnerabilities) {
  return (
    <>
      <div>CVEs: {breakdown(summary)}</div>
      {summary.containers.length > 1 &&
        summary.containers.map(container => (
          <div key={container.name}>
            {container.container}: {breakdown(container)}
          </div>
        ))}
    </>
  );
}

function KubescapeCell(props: Readonly<{ item: ListedItem; which: Which }>) {
  const { item, which } = props;
  const cluster = clusterOf(item);
  const namespace = item.metadata.namespace;
  const summary = lookUp(useWorkloadSummaries(cluster, namespace), which, item);
  if (!summary) return null;

  let tooltip;
  let link;
  if (which === 'vulnerabilities') {
    const vulnerabilities = summary as WorkloadVulnerabilities;
    // the container with the most serious CVEs
    const container = [...vulnerabilities.containers].sort(compareCounts)[0];
    tooltip = vulnerabilityTooltip(vulnerabilities);
    link = {
      routeName: RoutingName.KubescapeVulnerabilityDetails,
      params: { namespace, name: container.name },
      activeCluster: cluster,
    };
  } else {
    tooltip = `Failed controls: ${breakdown(summary)}`;
    link = {
      routeName: RoutingName.KubescapeWorkloadConfigurationScanDetails,
      params: { cluster, namespace, name: (summary as WorkloadControls).name },
      activeCluster: cluster,
    };
  }

  return (
    <Stack direction="row" spacing={0.5}>
      {(['Critical', 'High'] as const).map(severity => (
        <SeverityCountBox
          key={severity}
          severity={severity}
          count={summary[severity === 'Critical' ? 'critical' : 'high']}
          tooltip={<Box>{tooltip}</Box>}
          link={link}
        />
      ))}
    </Stack>
  );
}

function column(which: Which, label: string) {
  return {
    id: `kubescape-${which}`,
    label,
    gridTemplate: 'min-content',
    // critical and high, for searching; the counts are sorted by the sort function
    getValue: (item: ListedItem) => {
      const counts = cachedCounts(which, item);
      return counts ? `${counts.critical} ${counts.high}` : '';
    },
    sort: (a: ListedItem, b: ListedItem) =>
      compareCounts(sortedCounts(which, a), sortedCounts(which, b)),
    render: (item: ListedItem) => <KubescapeCell item={item} which={which} />,
  };
}

/** Adds the Kubescape columns to the workload and pod lists, before their Age column. */
export function addKubescapeColumns(args: { id: string; columns: any[] }) {
  const { id, columns } = args;
  if (!kubescapeColumnTables.includes(id)) return columns;
  if (kubescapeConfigStore.get()?.tableColumns === false) return columns;
  if (columns.some(existing => existing?.id === 'kubescape-vulnerabilities')) return columns;

  const age = columns.findIndex(existing => existing === 'age' || existing?.id === 'age');
  const at = age === -1 ? columns.length : age;
  return [
    ...columns.slice(0, at),
    column('vulnerabilities', 'CVEs'),
    column('controls', 'Failed controls'),
    ...columns.slice(at),
  ];
}
