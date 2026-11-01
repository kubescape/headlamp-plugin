/* 
  Show vulnerability scan results for a container image. 
*/
import {
  DateLabel,
  NameValueTable,
  SectionBox,
  ShowHideLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Link } from '@mui/material';
import { useState } from 'react';
import makeSeverityLabel from '../common/SeverityLabel';
import HeadlampTable from '../common/Table';
import { getURLSegments } from '../common/url';
import { vulnerabilityManifestClass } from '../model';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { getVulnerabilityReportCreatedAt } from './reportTimestamp';

export default function ImageVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [manifestVulnerability, setManifestVulnerability] = useState<KubeObject | null>(null);

  vulnerabilityManifestClass.useApiGet(setManifestVulnerability, name, namespace, undefined, {
    cluster: getCluster() ?? undefined,
  });

  if (manifestVulnerability) {
    const evaluatedAt = getVulnerabilityReportCreatedAt(manifestVulnerability.jsonData);
    return (
      <>
        <SectionBox title="Image Vulnerabilities" backLink>
          <NameValueTable
            rows={[
              {
                name: 'Image',
                value: manifestVulnerability.metadata.annotations
                  ? manifestVulnerability.metadata.annotations['kubescape.io/image-tag']
                  : '',
              },
              {
                name: 'Last evaluated',
                value: evaluatedAt ? <DateLabel date={evaluatedAt} /> : 'Unknown',
              },
              {
                name: 'Scan record created',
                value: manifestVulnerability.metadata.creationTimestamp,
              },
            ]}
          />
        </SectionBox>

        <Matches manifestVulnerability={manifestVulnerability.jsonData} />
      </>
    );
  }
}

function Matches(props: { manifestVulnerability: VulnerabilityManifest }) {
  const { manifestVulnerability } = props;
  const results = manifestVulnerability.spec.payload.matches ?? [];

  const fixVersions = (match: VulnerabilityManifest.Match) =>
    Array.isArray(match.vulnerability.fix?.versions)
      ? match.vulnerability.fix.versions.join(', ')
      : '';
  const description = (match: VulnerabilityManifest.Match) =>
    match.vulnerability.description ??
    match.relatedVulnerabilities?.find(related => related.id === match.vulnerability.id)
      ?.description ??
    '';
  const imageName =
    manifestVulnerability.metadata.annotations?.['kubescape.io/image-tag'] ??
    manifestVulnerability.metadata.name;

  return (
    <SectionBox title="Findings">
      <HeadlampTable
        csvExport={{
          fileName: `kubescape-${manifestVulnerability.metadata.name}-cves.csv`,
          header: [
            'Image',
            'Severity',
            'CVE',
            'CVSS',
            'Artifact',
            'Version',
            'Fix',
            'Fix in version',
            'Description',
          ],
          rows: () =>
            results.map(match => [
              imageName,
              match.vulnerability.severity,
              match.vulnerability.id,
              match.vulnerability.cvss?.[0]?.metrics.baseScore,
              match.artifact.name,
              match.artifact.version,
              match.vulnerability.fix?.state,
              fixVersions(match),
              description(match),
            ]),
        }}
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
            accessorFn: fixVersions,
            gridTemplate: 'auto',
          },
          {
            header: 'Description',
            accessorFn: description,
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
