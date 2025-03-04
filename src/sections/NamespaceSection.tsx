/* 
  Provide a panel on the Headlamp namespace page. 
*/
import {
  DefaultDetailsViewSection,
  DetailsViewSection,
  KubeObject,
} from '@kinvolk/headlamp-plugin/lib';
import { Link, NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useState } from 'react';
import { getControlsSummary } from '../compliance/ControlsSummary';
import { RoutingName } from '../index';
import { configurationScanSummariesClass, vulnerabilitySummaryClass } from '../model';
import { getCVESummary } from '../vulnerabilities/CVESummary';

export default function addKubescapeNamespaceSection(
  resource: KubeObject,
  sections: DetailsViewSection[]
) {
  // Ignore if there is no resource.
  if (!resource) {
    return sections;
  }

  if (resource.kind !== 'Namespace') {
    // Return early if we're not on the Namespace page
    return sections;
  }

  // Check if we already have added our custom section (this function may be called multiple times).
  const customSectionId = 'kubescape-configuration-scan-summaries';
  if (sections.findIndex(section => section.id === customSectionId) !== -1) {
    return sections;
  }

  const detailsHeaderIdx = sections.findIndex(
    section => section.id === DefaultDetailsViewSection.EVENTS
  );
  // There is no EVENTS section, so we do nothing.
  if (detailsHeaderIdx === -1) {
    return sections;
  }

  // We place our custom section before the EVENTS.
  sections.splice(detailsHeaderIdx, 0, {
    id: customSectionId,
    section: <KubescapeInfo resource={resource} />,
  });

  return sections;
}

function KubescapeInfo(props: { resource: KubeObject }) {
  const { resource } = props;
  const resourceName = resource.jsonData.metadata.name;

  const [configurationScanSummary, setConfigurationScanSummary] = useState<KubeObject | null>(null);
  const [vulnerabilitySummary, setVulnerabilitySummary] = useState<KubeObject | null>(null);

  configurationScanSummariesClass.useApiGet(setConfigurationScanSummary, resourceName);
  vulnerabilitySummaryClass.useApiGet(setVulnerabilitySummary, resourceName);

  return (
    configurationScanSummary &&
    vulnerabilitySummary && (
      <SectionBox title="Kubescape">
        <NameValueTable
          rows={[
            {
              name: (
                <Link
                  routeName={RoutingName.KubescapeConfigurationScanNamespaceSummary}
                  params={{
                    namespace: resourceName,
                  }}
                >
                  Configuration scan
                </Link>
              ),
              value: getControlsSummary(configurationScanSummary.jsonData),
            },
            {
              name: (
                <Link
                  routeName={RoutingName.VulnerabilitiesNamespaceSummary}
                  params={{
                    namespace: resourceName,
                  }}
                >
                  Vulnerabilities
                </Link>
              ),
              value: getCVESummary(vulnerabilitySummary.jsonData, false, false),
            },
          ]}
        />
      </SectionBox>
    )
  );
}
