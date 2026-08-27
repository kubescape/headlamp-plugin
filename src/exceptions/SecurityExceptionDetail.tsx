import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getAllowedNamespaces, KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Chip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { kubescapeConfigStore } from '../common/config-store';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import {
  clusterSecurityExceptionClass,
  securityExceptionClass,
  workloadConfigurationScanSummaryClass,
} from '../model';
import { paginatedListQuery } from '../query';
import {
  ClusterSecurityException,
  SecurityException,
  VulnerabilityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import {
  AnySecurityException,
  exceptionMatchesWorkload,
  fetchMatchContext,
  isExpired,
  workloadIdentity,
} from './apply-security-exceptions';

interface ExceptionEvent {
  uid: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp: string;
}

interface MatchedWorkload {
  kind: string;
  name: string;
  namespace: string;
  scope: string;
  // Identity of the scan summary itself, which is what the detail route needs.
  scanName: string;
  cluster: string;
}

export function SecurityExceptionDetail() {
  const [namespace, name] = getURLSegments(-2, -1);
  const [obj, setObj] = useState<KubeObject | null>(null);

  securityExceptionClass.useApiGet(setObj, name, namespace);

  if (!obj) return <></>;
  return <SecurityExceptionView obj={obj} />;
}

export function ClusterSecurityExceptionDetail() {
  const [name] = getURLSegments(-1);
  const [obj, setObj] = useState<KubeObject | null>(null);

  clusterSecurityExceptionClass.useApiGet(setObj, name);

  if (!obj) return <></>;
  return <SecurityExceptionView obj={obj} isCluster />;
}

/**
 * Kubescape and kubevuln record an Event on the exception itself whenever it
 * suppresses a finding. Events are namespaced but a ClusterSecurityException is
 * not, so query cluster-wide and let the field selector do the filtering.
 */
function useExceptionEvents(uid?: string): ExceptionEvent[] | null {
  const [events, setEvents] = useState<ExceptionEvent[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    request(`/api/v1/events?fieldSelector=involvedObject.uid=${uid}`)
      .then(response => {
        if (cancelled) return;
        const items: ExceptionEvent[] = (response.items ?? []).map((e: any) => ({
          uid: e.metadata.uid,
          type: e.type ?? '',
          reason: e.reason ?? '',
          message: e.message ?? '',
          count: e.count ?? 1,
          lastTimestamp: e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp ?? '',
        }));
        items.sort((a, b) => (a.lastTimestamp < b.lastTimestamp ? 1 : -1));
        setEvents(items);
      })
      .catch(error => {
        console.error('Failed to load events for security exception', error);
        if (!cancelled) setEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return events;
}

/**
 * Resolves which workloads this exception currently covers, using the same
 * matcher the compliance view applies to scan results.
 */
function useMatchedWorkloads(exception: AnySecurityException | null): MatchedWorkload[] | null {
  const [matched, setMatched] = useState<MatchedWorkload[] | null>(null);

  // Namespace disambiguates same-named exceptions, resourceVersion re-resolves after an edit.
  const key = exception
    ? [
        exception.kind,
        (exception as SecurityException).metadata.namespace ?? '',
        exception.metadata.name,
        (exception.metadata as any).resourceVersion ?? '',
      ].join('/')
    : '';

  useEffect(() => {
    if (!exception) return;
    let cancelled = false;

    async function resolve(target: AnySecurityException) {
      // The detail route carries no cluster, so the exception itself was read from
      // the current one. Resolve its matches against that same cluster.
      const cluster = getCluster() ?? '';
      const allowedNamespaces = getAllowedNamespaces(cluster);
      const context = await fetchMatchContext([target], cluster);
      if (cancelled) return;

      const postureIDs = (target.spec.posture ?? []).map(p => p.controlID);
      const isResourceLevel =
        (target.spec.posture ?? []).length === 0 && (target.spec.vulnerabilities ?? []).length === 0;

      // Scan summaries are the heaviest list the plugin reads, so page through them
      // and keep only the matching rows rather than the whole collection.
      const pageSize = kubescapeConfigStore.get()?.pageSize || 50;
      const rows: MatchedWorkload[] = [];
      let continuation: number | undefined = 0;

      while (!cancelled && continuation !== undefined) {
        const response = await paginatedListQuery(
          cluster,
          workloadConfigurationScanSummaryClass,
          continuation,
          pageSize,
          allowedNamespaces
        );
        continuation = response.continuation;

        for (const scan of response.items as WorkloadConfigurationScanSummary[]) {
          const { kind, name, namespace } = workloadIdentity(scan);
          if (!kind || !name) continue;
          if (!exceptionMatchesWorkload(target, kind, name, namespace, context)) continue;

          let scope: string;
          if (isResourceLevel) {
            scope = 'Whole resource';
          } else if (postureIDs.length > 0) {
            const covered = Object.values(scan.spec.controls ?? {})
              .filter(c => postureIDs.includes(c.controlID))
              .map(c => c.controlID);
            scope = covered.length > 0 ? covered.join(', ') : 'No control in this scan';
          } else {
            scope = 'Vulnerability entries only';
          }
          rows.push({
            kind,
            name,
            namespace,
            scope,
            scanName: scan.metadata.name,
            // paginatedListQuery stamps metadata.cluster, which the scan detail route needs.
            cluster: scan.metadata.cluster,
          });
        }
      }

      if (!cancelled) setMatched(rows);
    }

    resolve(exception).catch(error => {
      console.error('Failed to resolve matched workloads', error);
      if (!cancelled) setMatched([]);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return matched;
}

function selectorSummary(selector?: {
  matchLabels?: Record<string, string>;
  matchExpressions?: any[];
}): string {
  if (!selector) return '';
  const parts = Object.entries(selector.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`);
  for (const expr of selector.matchExpressions ?? []) {
    const values = expr.values?.join(', ');
    parts.push(values ? `${expr.key} ${expr.operator} (${values})` : `${expr.key} ${expr.operator}`);
  }
  return parts.join(', ');
}

function SecurityExceptionView({
  obj,
  isCluster = false,
}: Readonly<{ obj: KubeObject; isCluster?: boolean }>) {
  const exception = obj.jsonData as SecurityException | ClusterSecurityException;
  const spec = exception?.spec ?? {};

  const events = useExceptionEvents(obj.metadata.uid);
  const matchedWorkloads = useMatchedWorkloads(exception ?? null);

  const expiresAt = spec.expiresAt ? new Date(spec.expiresAt) : null;
  const expired = isExpired(spec.expiresAt);

  const overviewRows = [
    { name: 'Name', value: obj.metadata.name },
    {
      name: isCluster ? 'Scope' : 'Namespace',
      value: isCluster ? 'Cluster-scoped' : obj.metadata.namespace,
    },
    { name: 'Author', value: spec.author ?? '—' },
    { name: 'Reason', value: spec.reason ?? '—' },
    {
      name: 'Expires',
      value: expiresAt ? (
        <span style={expired ? { color: 'red', fontWeight: 'bold' } : {}}>
          {expiresAt.toISOString()} {expired ? '(expired)' : ''}
        </span>
      ) : (
        '—'
      ),
    },
  ];

  const objectSelector = selectorSummary(spec.match?.objectSelector);
  const namespaceSelector = selectorSummary(spec.match?.namespaceSelector);

  const matchRows = [
    {
      name: 'Resources',
      value:
        spec.match?.resources && spec.match.resources.length > 0
          ? spec.match.resources.map((r: any) => `${r.kind}/${r.name ?? '*'}`).join(', ')
          : '—',
    },
    {
      name: 'Images',
      value:
        spec.match?.images && spec.match.images.length > 0 ? spec.match.images.join(', ') : '—',
    },
    { name: 'Object selector', value: objectSelector || '—' },
    ...(isCluster ? [{ name: 'Namespace selector', value: namespaceSelector || '—' }] : []),
  ];

  return (
    <>
      <SectionBox title={obj.metadata.name} backLink>
        <NameValueTable rows={overviewRows} />
      </SectionBox>

      <SectionBox title="Match">
        <NameValueTable rows={matchRows} />
      </SectionBox>

      {spec.posture && spec.posture.length > 0 && (
        <SectionBox title="Posture Exceptions">
          <Table
            data={spec.posture}
            columns={[
              { header: 'Control ID', accessorKey: 'controlID' },
              { header: 'Framework', accessorKey: 'frameworkName' },
              {
                header: 'Action',
                accessorKey: 'action',
                Cell: ({ cell }: any) => (
                  <Chip
                    label={cell.getValue()}
                    size="small"
                    color={cell.getValue() === 'ignore' ? 'error' : 'warning'}
                  />
                ),
              },
            ]}
          />
        </SectionBox>
      )}

      {spec.vulnerabilities && spec.vulnerabilities.length > 0 && (
        <SectionBox title="Vulnerability Exceptions">
          <Table
            data={spec.vulnerabilities}
            columns={[
              {
                header: 'CVE ID',
                accessorFn: (v: VulnerabilityException) => v.vulnerability.id,
              },
              { header: 'Status', accessorKey: 'status' },
              { header: 'Justification', accessorKey: 'justification' },
              {
                header: 'Expired on Fix',
                accessorKey: 'expiredOnFix',
                Cell: ({ cell }: any) => (cell.getValue() ? 'Yes' : 'No'),
              },
              { header: 'Impact Statement', accessorKey: 'impactStatement' },
            ]}
          />
        </SectionBox>
      )}

      <SectionBox title="Matched Workloads">
        {matchedWorkloads === null ? (
          <Typography variant="body2" color="text.secondary">
            Resolving matched workloads...
          </Typography>
        ) : matchedWorkloads.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {expired
              ? 'This exception has expired, so it no longer covers any workload.'
              : 'No scanned workload currently matches this exception.'}
          </Typography>
        ) : (
          <Table
            data={matchedWorkloads}
            columns={[
              {
                header: 'Workload',
                accessorFn: (w: MatchedWorkload) => `${w.kind}/${w.name}`,
                Cell: ({ row }: any) => (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeWorkloadConfigurationScanDetails}
                    params={{
                      name: row.original.scanName,
                      namespace: row.original.namespace,
                      cluster: row.original.cluster,
                    }}
                  >
                    {`${row.original.kind}/${row.original.name}`}
                  </HeadlampLink>
                ),
              },
              { header: 'Namespace', accessorKey: 'namespace' },
              { header: 'Covers', accessorKey: 'scope' },
            ]}
          />
        )}
      </SectionBox>

      <SectionBox title="Events">
        {events === null ? (
          <Typography variant="body2" color="text.secondary">
            Loading events...
          </Typography>
        ) : events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No events recorded yet. Kubescape and kubevuln record one when a scan applies this
            exception, so an event appears after the next scan.
          </Typography>
        ) : (
          <Table
            data={events}
            columns={[
              { header: 'Type', accessorKey: 'type' },
              { header: 'Reason', accessorKey: 'reason' },
              { header: 'Message', accessorKey: 'message' },
              { header: 'Count', accessorKey: 'count' },
              {
                header: 'Last seen',
                accessorKey: 'lastTimestamp',
                Cell: ({ cell }: any) => {
                  const value = cell.getValue();
                  return value ? new Date(value).toLocaleString() : '';
                },
              },
            ]}
          />
        )}
      </SectionBox>
    </>
  );
}
