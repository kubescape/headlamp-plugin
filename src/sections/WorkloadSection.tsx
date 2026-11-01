/*
  Provide a panel on the Headlamp resource pages (for deployments, statefulsets, pods, etc).
*/
import { Link, NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { useEffect, useState } from 'react';
import { getControlsSummary } from '../compliance/ControlsSummary';
import { RoutingName } from '../index';
import {
  fetchObject,
  vulnerabilityManifestSummaryClass,
  workloadConfigurationScanSummaryClass,
} from '../model';
import { getCVESummary } from '../vulnerabilities/CVESummary';
import { findScannedWorkload, WorkloadRef } from './scannedWorkload';

// Workload kinds with Kubescape results, with the location of their pod spec. Pods show the
// results of the workload that runs them.
const podSpecGetters: Record<string, (spec: any) => any> = {
  Deployment: spec => spec?.template?.spec,
  StatefulSet: spec => spec?.template?.spec,
  DaemonSet: spec => spec?.template?.spec,
  Job: spec => spec?.template?.spec,
  CronJob: spec => spec?.jobTemplate?.spec?.template?.spec,
  Pod: spec => spec,
};

export default function addKubescapeWorkloadSection(resource: any, sections: any) {
  if (!resource) {
    return sections;
  }

  if (!podSpecGetters[resource.kind]) {
    // Return early if we're not on a workload page
    return sections;
  }

  // Check if we already have added our custom section (this function may be called multiple times).
  const customSectionId = 'kubescape-resources';
  if (sections.findIndex((section: any) => section.id === customSectionId) !== -1) {
    return sections;
  }

  const metadataIdx = sections.findIndex((section: any) => section.id === 'METADATA');
  // If there is no metadata section, the resource has not loaded yet, so we do nothing.
  if (metadataIdx === -1) {
    return sections;
  }

  // We place our custom section after the metadata.
  sections.splice(metadataIdx + 1, 0, {
    id: customSectionId,
    section: <KubescapeInfo resource={resource} />,
  });

  return sections;
}

function KubescapeInfo(props: Readonly<{ resource: KubeObject }>) {
  const { resource } = props;
  const isPod = resource.kind === 'Pod';
  const [podWorkload, setPodWorkload] = useState<WorkloadRef | null>(null);

  useEffect(() => {
    if (!isPod) return;
    let active = true;
    findScannedWorkload(resource.jsonData, resource.cluster).then(workload => {
      if (active) setPodWorkload(workload);
    });
    return () => {
      active = false;
    };
  }, [isPod, resource.jsonData, resource.cluster]);

  if (isPod && !podWorkload) {
    return <></>;
  }
  return (
    <ScanResults
      resource={resource}
      workload={podWorkload ?? { kind: resource.kind, name: resource.jsonData.metadata.name }}
    />
  );
}

function ScanResults(props: Readonly<{ resource: KubeObject; workload: WorkloadRef }>) {
  const { resource, workload } = props;
  const namespace = resource.jsonData.metadata.namespace;
  const kind = resource.kind;

  const scanName = `${workload.kind.toLowerCase()}-${workload.name.toLowerCase()}`;
  const [vulnerabilityScans, setVulnerabilityScans] = useState<any[] | null>(null);

  const [configurationScan] = workloadConfigurationScanSummaryClass.useGet(scanName, namespace, {
    cluster: resource.cluster,
  });

  const podSpec = podSpecGetters[kind]?.(resource.jsonData.spec);
  const manifestNames: string[] = [
    ...(podSpec?.containers ?? []),
    ...(podSpec?.initContainers ?? []),
  ].map((container: any) => `${scanName}-${container.name}`);
  const manifestNamesKey = manifestNames.join(',');

  useEffect(() => {
    let active = true;
    // A container that has not been scanned yet has no summary; show the ones that exist.
    Promise.allSettled(
      manifestNames.map(name =>
        fetchObject(name, namespace, resource.cluster, vulnerabilityManifestSummaryClass)
      )
    ).then(results => {
      if (!active) return;
      setVulnerabilityScans(
        results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value)
      );
    });
    return () => {
      active = false;
    };
    // manifestNamesKey covers manifestNames, which is rebuilt on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestNamesKey, namespace, resource.cluster]);

  const tableRows: { name: JSX.Element | string; value: JSX.Element | string }[] = [];

  if (workload.kind !== kind) {
    tableRows.push({ name: 'Results of', value: `${workload.kind} ${workload.name}` });
  }

  if (configurationScan) {
    //if (configurationScan.jsonData.spec.severities.critical > 0)
    tableRows.push({
      name: (
        <Link
          routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
          params={{
            cluster: resource.cluster,
            name: scanName,
            namespace: namespace,
          }}
        >
          Compliance
        </Link>
      ),
      value: getControlsSummary(configurationScan.jsonData),
    });
  }

  if (vulnerabilityScans) {
    for (const vulnerabilityScan of vulnerabilityScans) {
      tableRows.push({
        name: (
          <Link
            routeName={RoutingName.KubescapeVulnerabilityDetails}
            params={{
              name: vulnerabilityScan.metadata.name,
              namespace: namespace,
            }}
          >
            {`Vulnerabilities / ${
              vulnerabilityScan.metadata.labels
                ? vulnerabilityScan.metadata.labels['kubescape.io/workload-container-name']
                : ''
            }`}
          </Link>
        ),
        value: getCVESummary(vulnerabilityScan, false, false),
      });
    }
  }

  return (
    <SectionBox title="Kubescape">
      <NameValueTable rows={tableRows} />
    </SectionBox>
  );
}
