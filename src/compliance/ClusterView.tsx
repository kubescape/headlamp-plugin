/* 
  Information about a namespace and failed workloads. 
*/
import { SectionBox, Table, TableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useMemo } from 'react';
import { kubescapeConfigStore } from '../common/config-store';
import { defaultFrameworkNames, FrameWork, frameworks } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { frameworkComplianceScore } from './workload-scanning';

class ClusterResult {
  cluster: string;
  workloadScans: WorkloadConfigurationScanSummary[] = [];

  constructor(cluster: string) {
    this.cluster = cluster;
  }
}

export default function ClusterView(
  props: Readonly<{
    workloadScanData: WorkloadConfigurationScanSummary[];
    customFrameworks?: FrameWork[];
  }>
) {
  const { workloadScanData, customFrameworks } = props;
  const clusterResults = useMemo(() => getClusterResults(workloadScanData), [workloadScanData]);

  if (!workloadScanData) {
    return <></>;
  }

  const selectedFrameworkNames =
    (kubescapeConfigStore.get().activeFrameworks as string[]) ?? defaultFrameworkNames;

  const frameworkCells: TableColumn<ClusterResult>[] = [];

  selectedFrameworkNames
    .toSorted((a, b) => a.localeCompare(b))
    .forEach(name => {
      const framework =
        frameworks.find(fw => fw.name === name) ?? customFrameworks?.find(fw => fw.name === name);
      if (framework) {
        frameworkCells.push({
          header: framework.name,
          accessorFn: (clusterResult: ClusterResult) => {
            const percentage = clusterResult.workloadScans
              ? Math.trunc(frameworkComplianceScore(clusterResult.workloadScans, framework))
              : 0;
            return percentage;
          },
        });
      }
    });

  return (
    <SectionBox>
      <Table
        key={selectedFrameworkNames.join(',')} // force re-render when frameworks change
        aria-label="Cluster results"
        data={clusterResults}
        columns={[
          {
            id: 'cluster',
            header: 'Cluster',
            accessorKey: 'cluster',
          },
          ...frameworkCells,
        ]}
        initialState={{
          sorting: [
            {
              id: 'cluster',
              desc: false,
            },
          ],
        }}
        reflectInURL="clusters"
      />
    </SectionBox>
  );
}

function getClusterResults(workloadScanData: WorkloadConfigurationScanSummary[]): ClusterResult[] {
  const clusterResults: ClusterResult[] = [];

  for (const scan of workloadScanData) {
    let clusterResult = clusterResults.find(ns => ns.cluster === scan.metadata.cluster);
    if (!clusterResult) {
      clusterResult = new ClusterResult(scan.metadata.cluster);
      clusterResults.push(clusterResult);
    }

    clusterResult.workloadScans.push(scan);
  }

  return clusterResults;
}
