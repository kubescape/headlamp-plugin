/* 
  Provide a panel on the Headlamp resource pages (for deployments, statefulsets, etc). 
*/
import {
  DefaultDetailsViewSection,
  DetailsViewSection,
  KubeObject,
} from '@kinvolk/headlamp-plugin/lib';
import { Link, NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useEffect, useState } from 'react';
import { getControlsSummary } from '../compliance/ControlsSummary';
import { RoutingName } from '../index';
import {
  fetchObject,
  vulnerabilityManifestSummaryClass,
  workloadConfigurationScanSummaryClass,
} from '../model';
import { getCVESummary } from '../vulnerabilities/CVESummary';

export default function addKubescapeWorkloadSection(
  resource: KubeObject,
  sections: DetailsViewSection[]
) {
  // Ignore if there is no resource.
  if (!resource) {
    return sections;
  }

  if (resource.kind === 'Namespace') {
    // Return early if we're on the Namespace page
    return sections;
  }

  if (resource.kind !== 'Deployment') {
    // Return early if we're not on a Deployment page
    return sections;
  }

  // Check if we already have added our custom section (this function may be called multiple times).
  const customSectionId = 'kubescape-resources';
  if (sections.findIndex(section => section.id === customSectionId) !== -1) {
    return sections;
  }

  const detailsHeaderIdx = sections.findIndex(
    section => section.id === DefaultDetailsViewSection.MAIN_HEADER
  ); // There is no header, so we do nothing.
  if (detailsHeaderIdx === -1) {
    return sections;
  }

  // We place our custom section after the header.
  sections.splice(detailsHeaderIdx + 4, 0, {
    id: customSectionId,
    section: (
      <>
        <KubescapeInfo resource={resource} />
      </>
    ),
  });

  return sections;
}

function KubescapeInfo(props: { resource: KubeObject }) {
  const { resource } = props;
  const resourceName = resource.jsonData.metadata.name;
  const namespace = resource.jsonData.metadata.namespace;
  const kind = resource.kind;

  const scanName = `${kind.toLowerCase()}-${resourceName.toLowerCase()}`;
  const [vulnerabilityScans, setVulnerabilityScans] = useState<Array<KubeObject> | null>(null);

  const [configurationScan] = workloadConfigurationScanSummaryClass.useGet(scanName, namespace);

  if (kind === 'Deployment') {
    const manifestNames: string[] = [];
    for (const container of resource.jsonData.spec.template.spec.containers) {
      manifestNames.push(`${scanName}-${container.name}`);
    }
    if (resource.jsonData.spec.template.spec.initContainers) {
      for (const container of resource.jsonData.spec.template.spec.initContainers) {
        manifestNames.push(`${scanName}-${container.name}`);
      }
    }

    useEffect(() => {
      Promise.all(
        manifestNames.map(name => fetchObject(name, namespace, vulnerabilityManifestSummaryClass))
      ).then((results: any[]) => setVulnerabilityScans(results));
    }, []);
  }

  const tableRows: { name: JSX.Element | string; value: JSX.Element | string }[] = [];

  if (configurationScan) {
    //if (configurationScan.jsonData.spec.severities.critical > 0)
    tableRows.push({
      name: (
        <>
          <Link
            routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
            params={{
              name: scanName,
              namespace: namespace,
            }}
          >
            Compliance
          </Link>
        </>
      ),
      value: getControlsSummary(configurationScan.jsonData),
    });

    // const scan: WorkloadConfigurationScanSummary = configurationScan.jsonData;
    // for (const control of Object.values(scan.spec.controls)) {
    //   tableRows.push({
    //     name: '',
    //     value: `${control.controlID} ${
    //       controlLibrary.find(c => c.controlID === control.controlID)?.name
    //     }`,
    //   });
    // }
  }

  if (vulnerabilityScans) {
    for (const vulnerabilityScan of vulnerabilityScans) {
      tableRows.push({
        name: (
          <>
            <Link
              routeName={RoutingName.KubescapeVulnerabilityDetails}
              params={{
                name: vulnerabilityScan.metadata.name,
                namespace: namespace,
              }}
            >
              {`Vulnerabilities / ${vulnerabilityScan.metadata.labels['kubescape.io/workload-container-name']}`}
            </Link>
          </>
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
