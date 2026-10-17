/* 
  Show vulnerability scan results for a workload. 
*/
import { Icon } from '@iconify/react';
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  DateLabel,
  NameValueTable,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { FormControlLabel, IconButton, Link, Switch, Tooltip } from '@mui/material';
import { useEffect, useState } from 'react';
import makeSeverityLabel from '../common/SeverityLabel';
import { getURLSegments } from '../common/url';
import { GuidedVulnerabilityExceptionForm } from '../exceptions/GuidedVulnerabilityExceptionForm';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { getCVESummary } from './CVESummary';
import { getVulnerabilityReportCreatedAt } from './reportTimestamp';
import { getManifestNamespace } from './scanData';

export default function KubescapeVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const cluster = getCluster() ?? undefined;

  const [summary, setSummary] = useState<VulnerabilityManifestSummary | null>(null);
  const [manifestAll, setManifestAll] = useState<VulnerabilityManifest | null>(null);
  const [manifestRelevant, setManifestRelevant] = useState<VulnerabilityManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setManifestAll(null);
    setManifestRelevant(null);
    fetchVulnerabilityManifest(name, namespace, cluster)
      .then(([summary, all, relevant]) => {
        if (cancelled) return;
        setSummary(summary);
        setManifestAll(all);
        setManifestRelevant(relevant);
      })
      .catch(error => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [name, namespace, cluster]);

  const imageEvaluatedAt = getVulnerabilityReportCreatedAt(manifestAll);
  const relevantEvaluatedAt = getVulnerabilityReportCreatedAt(manifestRelevant);

  return (
    summary && (
      <>
        <SectionBox title="Vulnerabilities" backLink>
          <NameValueTable
            rows={[
              {
                name: 'Workload',
                value: summary.metadata.labels['kubescape.io/workload-name'],
              },
              {
                name: 'Namespace',
                value: summary.metadata.labels['kubescape.io/workload-namespace'],
              },
              {
                name: 'Container',
                value: summary.metadata.labels['kubescape.io/workload-container-name'],
              },
              {
                name: 'Kind',
                value: summary.metadata.labels['kubescape.io/workload-kind'],
              },
              {
                name: 'Image',
                value: summary.metadata.annotations['kubescape.io/image-tag'],
              },
              {
                name: 'Image last evaluated',
                value: imageEvaluatedAt ? <DateLabel date={imageEvaluatedAt} /> : 'Unknown',
              },
              {
                name: 'Relevant findings last evaluated',
                value: relevantEvaluatedAt ? <DateLabel date={relevantEvaluatedAt} /> : 'Unknown',
              },
              {
                name: 'Scan record created',
                value: summary.metadata.creationTimestamp,
              },
              {
                name: 'Type',
                value: manifestAll?.spec.payload.source.type,
              },
              {
                name: 'CVE',
                value: getCVESummary(summary, true, true),
              },
              {
                name: 'Relevant CVE',
                value: getCVESummary(summary, true, true, true),
              },
            ]}
          />

          {manifestAll && (
            <Matches
              manifest={manifestAll}
              relevant={manifestRelevant}
              workloadName={summary.metadata.labels['kubescape.io/workload-name']}
              workloadNamespace={summary.metadata.labels['kubescape.io/workload-namespace']}
              workloadKind={summary.metadata.labels['kubescape.io/workload-kind']}
              imageRef={summary.metadata.annotations['kubescape.io/image-tag']}
            />
          )}
        </SectionBox>
      </>
    )
  );
}

function Matches(
  props: Readonly<{
    manifest: VulnerabilityManifest;
    relevant: VulnerabilityManifest | null;
    workloadName: string;
    workloadNamespace: string;
    workloadKind: string;
    imageRef?: string;
  }>
) {
  const { manifest, relevant, workloadName, workloadNamespace, workloadKind, imageRef } = props;
  const results: VulnerabilityManifest.Match[] = manifest.spec.payload.matches ?? [];
  const [isRelevantCVESwitchChecked, setIsRelevantCVESwitchChecked] = useState(true);
  const [selectedCve, setSelectedCve] = useState<string | null>(null);

  let relevantResults;
  if (isRelevantCVESwitchChecked && relevant?.spec.payload.matches && results) {
    relevantResults = results.filter(r =>
      relevant.spec.payload.matches.some(m => m.vulnerability.id === r.vulnerability.id)
    );
  }

  return (
    <SectionBox title="Findings">
      <FormControlLabel
        checked={isRelevantCVESwitchChecked}
        control={<Switch color="primary" />}
        label={'Relevant CVE'}
        onChange={(event: any, checked: boolean) => {
          setIsRelevantCVESwitchChecked(checked);
        }}
      />
      <HeadlampTable
        data={relevantResults ?? results}
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
            Cell: ({ cell }: any) => (
              <Link target="_blank" href={cell.row.original.vulnerability.dataSource}>
                {cell.getValue()}
              </Link>
            ),
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
            header: 'Relevant',
            accessorFn: (item: VulnerabilityManifest.Match) => {
              if (!relevant) return 'Unknown';

              return relevant.spec.payload.matches &&
                relevant.spec.payload.matches.some(
                  m => m.vulnerability.id === item.vulnerability.id
                )
                ? 'Yes'
                : 'No';
            },
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
            accessorKey: 'vulnerability.description',
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
          },
          {
            header: '',
            accessorFn: (item: VulnerabilityManifest.Match) => (
              <Tooltip title="Create Vulnerability Exception">
                <IconButton size="small" onClick={() => setSelectedCve(item.vulnerability.id)}>
                  <Icon icon="mdi:shield-plus-outline" />
                </IconButton>
              </Tooltip>
            ),
            gridTemplate: 'min-content',
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

      {selectedCve && (
        <GuidedVulnerabilityExceptionForm
          cveId={selectedCve}
          imageRef={imageRef}
          workloadName={workloadName}
          workloadNamespace={workloadNamespace}
          workloadKind={workloadKind}
          onClose={() => setSelectedCve(null)}
        />
      )}
    </SectionBox>
  );
}

// Full reports carry evaluation times; the summary only supplies their references.
export async function fetchVulnerabilityManifest(
  name: string,
  namespace: string,
  cluster?: string
): Promise<
  [VulnerabilityManifestSummary, VulnerabilityManifest | null, VulnerabilityManifest | null]
> {
  const summary: VulnerabilityManifestSummary = await request(
    `/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/${namespace}/vulnerabilitymanifestsummaries/${name}`,
    { cluster }
  );

  async function getManifest(reference?: {
    name?: string;
    namespace?: string;
  }): Promise<VulnerabilityManifest | null> {
    if (!reference?.name) return null;
    try {
      return await request(
        `/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/${getManifestNamespace(
          reference
        )}/vulnerabilitymanifests/${reference.name}`,
        { cluster }
      );
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  const all = await getManifest(summary.spec.vulnerabilitiesRef?.all);
  const relevant = await getManifest(summary.spec.vulnerabilitiesRef?.relevant);
  return [summary, all, relevant];
}
