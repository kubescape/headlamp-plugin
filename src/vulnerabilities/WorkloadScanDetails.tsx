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
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Button, Chip, FormControlLabel, Link, Stack, Switch } from '@mui/material';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { vulnerabilityScanCommand } from '../common/operatorCommands';
import { createExceptionCheck, Permitted, PermittedIconButton } from '../common/permissions';
import { ScanNowButton } from '../common/ScanNowButton';
import makeSeverityLabel from '../common/SeverityLabel';
import HeadlampTable from '../common/Table';
import { getURLSegments, useURLSearchParam } from '../common/url';
import { getKubescapeNamespace } from '../custom-objects/api-queries';
import { GuidedVulnerabilityExceptionForm } from '../exceptions/GuidedVulnerabilityExceptionForm';
import {
  CveException,
  exceptionStateLabels,
  findingException,
  ignoredMatchException,
  isSuppressing,
  ScannedWorkload,
  workloadCveExceptions,
} from '../exceptions/vulnerabilityExceptions';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { getCVESummary } from './CVESummary';
import { AcceptRiskButton, ExceptionChip, useSecurityExceptions } from './exceptionChips';
import { ImageReference } from './ImageReference';
import { getScanTime, getVulnerabilityReportCreatedAt } from './reportTimestamp';
import { getManifestNamespace } from './scanData';

export default function KubescapeVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);
  const cluster = getCluster() ?? undefined;

  const [summary, setSummary] = useState<VulnerabilityManifestSummary | null>(null);
  const [manifestAll, setManifestAll] = useState<VulnerabilityManifest | null>(null);
  const [manifestRelevant, setManifestRelevant] = useState<VulnerabilityManifest | null>(null);
  const [scanStarted, setScanStarted] = useState(false);
  // changed to read the scan results again
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [name, namespace, cluster, reloadKey]);

  const wlid = summary?.metadata.annotations?.['kubescape.io/wlid'];

  return (
    summary && (
      <WorkloadVulnerabilities
        summary={summary}
        manifestAll={manifestAll}
        manifestRelevant={manifestRelevant}
        cluster={cluster}
        scanActions={
          wlid &&
          cluster && (
            <>
              <ScanNowButton
                clusters={[cluster]}
                command={scanCluster => vulnerabilityScanCommand(wlid, scanCluster)}
                label="Rescan"
                tooltip="Ask Kubescape to scan the images of this workload for vulnerabilities now"
                onStarted={() => setScanStarted(true)}
              />
              {scanStarted && (
                <Button variant="outlined" size="small" onClick={() => setReloadKey(k => k + 1)}>
                  Reload results
                </Button>
              )}
            </>
          )
        }
      />
    )
  );
}

// A finding with the exception that covers it; hidden when kubevuln no longer counts it
type Finding = VulnerabilityManifest.Match & { exception?: CveException; hidden?: boolean };

function WorkloadVulnerabilities(
  props: Readonly<{
    summary: VulnerabilityManifestSummary;
    manifestAll: VulnerabilityManifest | null;
    manifestRelevant: VulnerabilityManifest | null;
    cluster?: string;
    scanActions: ReactNode;
  }>
) {
  const { summary, manifestAll, manifestRelevant, cluster, scanActions } = props;
  const workload = useMemo<ScannedWorkload>(
    () => ({
      kind: summary.metadata.labels['kubescape.io/workload-kind'],
      name: summary.metadata.labels['kubescape.io/workload-name'],
      namespace: summary.metadata.labels['kubescape.io/workload-namespace'],
      image: summary.metadata.annotations['kubescape.io/image-tag'],
    }),
    [summary]
  );
  const { exceptions, reload } = useSecurityExceptions([cluster ?? ''], [workload.kind]);
  const exceptionData = exceptions.get(cluster ?? '');
  const [accepting, setAccepting] = useState(false);

  // the findings, with those that an exception hid from the report
  const findings = useMemo(() => {
    if (!manifestAll) return [];
    const covered = exceptionData
      ? workloadCveExceptions(exceptionData, workload)
      : new Map<string, CveException>();
    return [
      ...(manifestAll.spec.payload.matches ?? []).map(
        (match): Finding => ({ ...match, exception: findingException(covered, match) })
      ),
      ...(manifestAll.spec.payload.ignoredMatches ?? []).map(
        (match): Finding => ({
          ...match,
          hidden: true,
          exception: findingException(covered, match) ?? ignoredMatchException(match),
        })
      ),
    ];
  }, [manifestAll, exceptionData, workload]);
  // the CVEs that kubevuln counts, which no exception hides
  const openCves = useMemo(
    () => [
      ...new Set(
        findings
          .filter(
            finding =>
              !finding.hidden && !(finding.exception && isSuppressing(finding.exception.state))
          )
          .map(finding => finding.vulnerability.id)
      ),
    ],
    [findings]
  );

  const imageEvaluatedAt = getVulnerabilityReportCreatedAt(manifestAll);
  const relevantEvaluatedAt = getVulnerabilityReportCreatedAt(manifestRelevant);
  // recent kubevuln versions only record when they scanned, on the summary
  const scannedAt = getScanTime(summary);
  const evaluationRows =
    imageEvaluatedAt || relevantEvaluatedAt || !scannedAt
      ? [
          {
            name: 'Image last evaluated',
            value: imageEvaluatedAt ? <DateLabel date={imageEvaluatedAt} /> : 'Unknown',
          },
          {
            name: 'Relevant findings last evaluated',
            value: relevantEvaluatedAt ? <DateLabel date={relevantEvaluatedAt} /> : 'Unknown',
          },
        ]
      : [{ name: 'Last scanned', value: <DateLabel date={scannedAt} /> }];

  return (
    <>
      <SectionBox title="Vulnerabilities" backLink>
        {(scanActions || openCves.length > 0) && (
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            {scanActions}
            {openCves.length > 0 && (
              <AcceptRiskButton
                cveIds={openCves}
                namespace={workload.namespace}
                cluster={cluster}
                onClick={() => setAccepting(true)}
              />
            )}
          </Stack>
        )}
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
              value: (
                <ImageReference
                  image={summary.metadata.annotations['kubescape.io/image-tag']}
                  report={
                    manifestAll
                      ? {
                          name: manifestAll.metadata.name,
                          namespace: manifestAll.metadata.namespace,
                          cluster,
                        }
                      : undefined
                  }
                />
              ),
            },
            ...evaluationRows,
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
            findings={findings}
            relevant={manifestRelevant}
            workloadName={workload.name}
            workloadNamespace={workload.namespace}
            workloadKind={workload.kind}
            imageRef={workload.image}
            cluster={cluster}
            onExceptionCreated={reload}
          />
        )}
      </SectionBox>

      {accepting && (
        <GuidedVulnerabilityExceptionForm
          acceptRisk
          cveIds={openCves}
          imageRef={workload.image}
          workloadName={workload.name}
          workloadNamespace={workload.namespace}
          workloadKind={workload.kind}
          cluster={cluster}
          onClose={() => setAccepting(false)}
          onCreated={reload}
        />
      )}
    </>
  );
}

function findingId(finding: Finding) {
  return JSON.stringify([
    finding.vulnerability.id,
    finding.artifact.name,
    finding.artifact.version,
    !!finding.hidden,
  ]);
}

function Matches(
  props: Readonly<{
    findings: Finding[];
    relevant: VulnerabilityManifest | null;
    workloadName: string;
    workloadNamespace: string;
    workloadKind: string;
    imageRef?: string;
    cluster?: string;
    onExceptionCreated: () => void;
  }>
) {
  const {
    findings,
    relevant,
    workloadName,
    workloadNamespace,
    workloadKind,
    imageRef,
    cluster,
    onExceptionCreated: reload,
  } = props;

  // Severity links count all findings, so they open with the Relevant CVE switch off
  const [severity, clearSeverity] = useURLSearchParam('severity');
  const results = findings.filter(match => !severity || match.vulnerability.severity === severity);
  const [isRelevantCVESwitchChecked, setIsRelevantCVESwitchChecked] = useState(!severity);
  const [selectedCve, setSelectedCve] = useState<string | null>(null);
  const [acceptedCves, setAcceptedCves] = useState<string[] | null>(null);
  const clearSelection = useRef<() => void>(() => {});

  // Without a relevant manifest all findings are shown. A relevant manifest without matches
  // means that none of the findings is relevant.
  const relevantIds = relevant
    ? new Set(
        [
          ...(relevant.spec.payload.matches ?? []),
          ...(relevant.spec.payload.ignoredMatches ?? []),
        ].map(m => m.vulnerability.id)
      )
    : undefined;
  const isRelevant = (match: VulnerabilityManifest.Match) =>
    !relevantIds ? 'Unknown' : relevantIds.has(match.vulnerability.id) ? 'Yes' : 'No';
  const shown =
    isRelevantCVESwitchChecked && relevantIds
      ? results.filter(r => relevantIds.has(r.vulnerability.id))
      : results;
  const fixVersions = (match: VulnerabilityManifest.Match) =>
    Array.isArray(match.vulnerability.fix?.versions)
      ? match.vulnerability.fix.versions.join(', ')
      : '';
  const exceptionLabel = (finding: Finding) =>
    finding.exception ? exceptionStateLabels[finding.exception.state] : '';

  return (
    <SectionBox title="Findings">
      <HeadlampTable
        toolbarStart={
          <>
            <FormControlLabel
              checked={isRelevantCVESwitchChecked}
              control={<Switch color="primary" />}
              label={'Relevant CVE'}
              onChange={(event: any, checked: boolean) => {
                setIsRelevantCVESwitchChecked(checked);
              }}
            />
            {severity && (
              <Chip label={`Only ${severity} findings`} onDelete={clearSeverity} size="small" />
            )}
          </>
        }
        csvExport={{
          fileName: `kubescape-${workloadNamespace}-${workloadName}-cves.csv`,
          header: [
            'Severity',
            'CVE',
            'CVSS',
            'Artifact',
            'Version',
            'Relevant',
            'Fix',
            'Fix in version',
            'Exception',
            'Description',
          ],
          rows: () =>
            shown.map(match => [
              match.vulnerability.severity,
              match.vulnerability.id,
              match.vulnerability.cvss?.[0]?.metrics.baseScore,
              match.artifact.name,
              match.artifact.version,
              isRelevant(match),
              match.vulnerability.fix?.state,
              fixVersions(match),
              match.exception && `${exceptionLabel(match)}: ${match.exception.name}`,
              match.vulnerability.description,
            ]),
        }}
        data={shown}
        emptyMessage={
          shown.length === 0 && results.length > 0
            ? `None of the ${results.length} findings is relevant: Kubescape did not see the workload use the vulnerable packages. Switch off Relevant CVE to show them all.`
            : undefined
        }
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
            accessorFn: isRelevant,
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
            Cell: ({ row }: any) => {
              const { exception, hidden } = row.original as Finding;
              if (!exception) return null;
              let note: string | undefined;
              if (hidden) note = 'Kubescape no longer counts this finding.';
              else if (isSuppressing(exception.state)) {
                note =
                  'Kubescape stops counting this finding at its next scan, when the riskAcceptance capability is enabled.';
              }
              return <ExceptionChip exception={exception} cluster={cluster} note={note} />;
            },
            gridTemplate: 'auto',
          },
          {
            header: 'Description',
            accessorKey: 'vulnerability.description',
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
          },
          {
            header: '',
            accessorFn: () => '',
            // rendered for the rows on the page only
            Cell: ({ row }: any) => (
              <PermittedIconButton
                check={createExceptionCheck(workloadNamespace)}
                title="Create Vulnerability Exception"
                onClick={() => setSelectedCve(row.original.vulnerability.id)}
              >
                <Icon icon="mdi:shield-plus-outline" />
              </PermittedIconButton>
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
        enableRowSelection
        getRowId={findingId}
        renderRowSelectionToolbar={({ table }) => {
          const selected = [
            ...new Set(table.getSelectedRowModel().rows.map(row => row.original.vulnerability.id)),
          ];
          clearSelection.current = () => table.resetRowSelection();
          return (
            <Permitted check={createExceptionCheck(workloadNamespace)} cluster={cluster}>
              {allowed => (
                <Button
                  variant="contained"
                  size="small"
                  disabled={!allowed}
                  startIcon={<Icon icon="mdi:shield-check-outline" />}
                  onClick={() => setAcceptedCves(selected)}
                >
                  Accept the risk of {selected.length} {selected.length === 1 ? 'CVE' : 'CVEs'}
                </Button>
              )}
            </Permitted>
          );
        }}
      />

      {acceptedCves && (
        <GuidedVulnerabilityExceptionForm
          acceptRisk
          cveIds={acceptedCves}
          imageRef={imageRef}
          workloadName={workloadName}
          workloadNamespace={workloadNamespace}
          workloadKind={workloadKind}
          cluster={cluster}
          onClose={() => setAcceptedCves(null)}
          onCreated={() => {
            clearSelection.current();
            reload();
          }}
        />
      )}

      {selectedCve && (
        <GuidedVulnerabilityExceptionForm
          cveIds={[selectedCve]}
          imageRef={imageRef}
          workloadName={workloadName}
          workloadNamespace={workloadNamespace}
          workloadKind={workloadKind}
          cluster={cluster}
          onClose={() => setSelectedCve(null)}
          onCreated={reload}
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
    const read = (namespace: string) =>
      request(
        `/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/${namespace}/vulnerabilitymanifests/${reference.name}`,
        { cluster }
      );
    const referenced = getManifestNamespace(reference);
    try {
      return await read(referenced);
    } catch (error: any) {
      // the storage may keep the report in the operator namespace instead of the referenced one
      if (error?.status === 404) {
        const { kubeScapeNamespace } = await getKubescapeNamespace(cluster ?? getCluster());
        if (kubeScapeNamespace && kubeScapeNamespace !== referenced) {
          try {
            return await read(kubeScapeNamespace);
          } catch (fallbackError) {
            console.error(fallbackError);
            return null;
          }
        }
      }
      console.error(error);
      return null;
    }
  }

  const all = await getManifest(summary.spec.vulnerabilitiesRef?.all);
  const relevant = await getManifest(summary.spec.vulnerabilitiesRef?.relevant);
  return [summary, all, relevant];
}
