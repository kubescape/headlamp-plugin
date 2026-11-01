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
import { Chip, Link, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import makeSeverityLabel from '../common/SeverityLabel';
import HeadlampTable from '../common/Table';
import { getURLSegments, useURLSearchParam } from '../common/url';
import { GuidedVulnerabilityExceptionForm } from '../exceptions/GuidedVulnerabilityExceptionForm';
import {
  CveException,
  exceptionStateLabels,
  findingException,
  imageCveExceptions,
  isSuppressing,
  summarizeWorkloadExceptions,
} from '../exceptions/vulnerabilityExceptions';
import { vulnerabilityManifestClass } from '../model';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { AcceptRiskButton, ExceptionChip, useSecurityExceptions } from './exceptionChips';
import { getVulnerabilityReportCreatedAt } from './reportTimestamp';

export default function ImageVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [manifestVulnerability, setManifestVulnerability] = useState<KubeObject | null>(null);

  const cluster = getCluster() ?? '';
  vulnerabilityManifestClass.useApiGet(setManifestVulnerability, name, namespace, undefined, {
    cluster: cluster || undefined,
  });

  // the exceptions for the image in the whole cluster; those of a workload do not cover it
  // wherever it runs
  const image: string | undefined =
    manifestVulnerability?.metadata.annotations?.['kubescape.io/image-tag'];
  const { exceptions, reload } = useSecurityExceptions([cluster], []);
  const exceptionData = exceptions.get(cluster);
  const covered = useMemo(
    () =>
      exceptionData && image
        ? imageCveExceptions(exceptionData, image)
        : new Map<string, CveException>(),
    [exceptionData, image]
  );
  const matches: VulnerabilityManifest.Match[] | undefined =
    manifestVulnerability?.jsonData.spec.payload.matches;
  const openCves = useMemo(
    () => summarizeWorkloadExceptions(covered, matches ?? []).open,
    [covered, matches]
  );
  const [accepting, setAccepting] = useState(false);

  if (manifestVulnerability) {
    const evaluatedAt = getVulnerabilityReportCreatedAt(manifestVulnerability.jsonData);
    return (
      <>
        <SectionBox title="Image Vulnerabilities" backLink>
          {image && openCves.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <AcceptRiskButton
                cveIds={openCves}
                cluster={cluster || undefined}
                onClick={() => setAccepting(true)}
              />
            </Stack>
          )}
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

        <Matches
          manifestVulnerability={manifestVulnerability.jsonData}
          covered={covered}
          cluster={cluster}
        />

        {accepting && image && (
          <GuidedVulnerabilityExceptionForm
            acceptRisk
            cveIds={openCves}
            imageRef={image}
            cluster={cluster || undefined}
            onClose={() => setAccepting(false)}
            onCreated={reload}
          />
        )}
      </>
    );
  }
}

function Matches(
  props: Readonly<{
    manifestVulnerability: VulnerabilityManifest;
    // the exceptions for the image in the whole cluster, by CVE id
    covered: Map<string, CveException>;
    cluster: string;
  }>
) {
  const { manifestVulnerability, covered, cluster } = props;
  const [severity, clearSeverity] = useURLSearchParam('severity');
  const results = useMemo(
    () =>
      (manifestVulnerability.spec.payload.matches ?? [])
        .filter(match => !severity || match.vulnerability.severity === severity)
        .map(match => ({ ...match, exception: findingException(covered, match) })),
    [manifestVulnerability, severity, covered]
  );
  const exceptionLabel = (match: (typeof results)[number]) =>
    match.exception ? exceptionStateLabels[match.exception.state] : '';

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
        toolbarStart={
          severity && (
            <Chip label={`Only ${severity} findings`} onDelete={clearSeverity} size="small" />
          )
        }
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
            'Exception',
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
              match.exception && `${exceptionLabel(match)}: ${match.exception.name}`,
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
            id: 'Exception',
            header: 'Exception',
            accessorFn: exceptionLabel,
            Cell: ({ row }: any) =>
              row.original.exception ? (
                <ExceptionChip
                  exception={row.original.exception}
                  cluster={cluster || undefined}
                  note={
                    isSuppressing(row.original.exception.state)
                      ? 'Kubescape stops counting this finding at its next scan, when the riskAcceptance capability is enabled.'
                      : undefined
                  }
                />
              ) : null,
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
