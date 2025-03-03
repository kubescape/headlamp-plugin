/* 
  Show vulnerability scan results for a container image. 
*/
import {
  NameValueTable,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/lib/k8s/cluster';
import { createRouteURL } from '@kinvolk/headlamp-plugin/lib/Router';
import { Link } from '@mui/material';
import { useState } from 'react';
import makeSeverityLabel from '../common/SeverityLabel';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { vulnerabilityManifestClass } from '../model';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';

export default function ImageVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [manifestVulnerability, setVulnerabilityManifest] = useState<KubeObject | null>(null);

  vulnerabilityManifestClass.useApiGet(setVulnerabilityManifest, name, namespace);

  if (manifestVulnerability) {
    return (
      manifestVulnerability && (
        <>
          <SectionBox
            title="Image Vulnerabilities"
            backLink={createRouteURL(RoutingName.KubescapeVulnerabilities)}
          >
            <NameValueTable
              rows={[
                {
                  name: 'Image',
                  value: manifestVulnerability.metadata.annotations['kubescape.io/image-tag'],
                },
                {
                  name: 'Last scan',
                  value: manifestVulnerability.metadata.creationTimestamp,
                },
              ]}
            />
          </SectionBox>

          <Matches manifestVulnerability={manifestVulnerability.jsonData} />
        </>
      )
    );
  }
}

function Matches(props: { manifestVulnerability: VulnerabilityManifest }) {
  const { manifestVulnerability } = props;
  const results = manifestVulnerability.spec.payload.matches;

  return (
    <SectionBox title="Findings">
      <HeadlampTable
        data={results}
        columns={[
          {
            header: 'Severity',
            accessorKey: 'vulnerability.severity',
            Cell: ({ cell }: any) => makeSeverityLabel(cell.getValue()),
            gridTemplate: 'auto',
          },
          {
            header: 'CVE',
            accessorKey: 'vulnerability.id',
            Cell: ({ cell }: any) => {
              return (
                <Link target="_blank" href={cell.row.original.vulnerability.dataSource}>
                  {cell.getValue()}
                </Link>
              );
            },
            gridTemplate: 'auto',
          },
          {
            id: 'Score',
            header: 'CVSS',
            accessorFn: (match: VulnerabilityManifest.Match) =>
              match.vulnerability.cvss ? match.vulnerability.cvss[0].metrics.baseScore : 0,
            gridTemplate: 'auto',
          },
          {
            header: 'Artifact',
            accessorKey: 'artifact.name',
            gridTemplate: 'auto',
          },
          {
            header: 'Version',
            accessorKey: 'artifact.version',
            gridTemplate: 'auto',
          },
          {
            header: 'Fix',
            accessorKey: 'vulnerability.fix.state',
            gridTemplate: 'auto',
          },
          {
            header: 'Fix in version',
            accessorFn: (item: VulnerabilityManifest.Match) =>
              item.vulnerability.fix?.versions && Array.isArray(item.vulnerability.fix?.versions)
                ? item.vulnerability.fix.versions.join(', ')
                : '',
            gridTemplate: 'auto',
          },
          {
            header: 'Description',
            accessorFn: (item: VulnerabilityManifest.Match) => {
              let relatedDescription: string = '';
              if (item.relatedVulnerabilities) {
                for (const related of item.relatedVulnerabilities) {
                  if (related.id === item.vulnerability.id) {
                    relatedDescription = related.description;
                  }
                }
              }
              return item.vulnerability.description ?? relatedDescription;
            },
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'Score',
              desc: true,
            },
          ],
        }}
      />
    </SectionBox>
  );
}
