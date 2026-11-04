import {
  DateLabel,
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Chip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import Table from '../common/Table';
import { getURLSegments } from '../common/url';
import { clusterSecurityExceptionClass, securityExceptionClass } from '../model';
import { VulnerabilityException } from '../softwarecomposition/SecurityException';
import { eventTime, ExceptionEvent, fetchExceptionEvents } from './events';
import { exceptionHistory, HistoryEntry } from './history';

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

function SecurityExceptionView({
  obj,
  isCluster = false,
}: Readonly<{ obj: KubeObject; isCluster?: boolean }>) {
  const spec = obj.jsonData?.spec ?? {};

  const expiresAt = spec.expiresAt ? new Date(spec.expiresAt) : null;
  const expired = expiresAt ? expiresAt < new Date() : false;

  const overviewRows = [
    { name: 'Name', value: obj.metadata.name },
    {
      name: isCluster ? 'Scope' : 'Namespace',
      value: isCluster ? 'Cluster-scoped' : obj.metadata.namespace,
    },
    { name: 'Author', value: spec.author ?? '—' },
    {
      name: 'Created',
      value: obj.metadata.creationTimestamp ? (
        <DateLabel date={obj.metadata.creationTimestamp} />
      ) : (
        '—'
      ),
    },
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
    ...(isCluster && spec.match?.namespaceSelector
      ? [
          {
            name: 'Namespace selector',
            value: JSON.stringify(spec.match.namespaceSelector),
          },
        ]
      : []),
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

      <ExceptionHistory obj={obj} />
      <ExceptionMatches obj={obj} isCluster={isCluster} />

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
    </>
  );
}

// The creates and changes of the exception that this plugin recorded, newest first
function ExceptionHistory({ obj }: Readonly<{ obj: KubeObject }>) {
  const history = exceptionHistory(obj.jsonData).reverse();
  return (
    <SectionBox title="History">
      {history.length === 0 ? (
        <Typography variant="body2">
          No changes recorded. The history only contains changes made with this plugin.
        </Typography>
      ) : (
        <Table
          data={history}
          columns={[
            {
              header: 'Time',
              accessorKey: 'time',
              Cell: ({ cell }: any) => <DateLabel date={cell.getValue()} />,
            },
            {
              header: 'Change',
              accessorFn: (entry: HistoryEntry) =>
                entry.action === 'created' ? 'Created' : 'Changed',
            },
            {
              header: 'User',
              accessorFn: (entry: HistoryEntry) => entry.user ?? 'Unknown',
            },
          ]}
        />
      )}
    </SectionBox>
  );
}

// The findings that the Kubescape scanner suppressed with the exception, as reported in events
function ExceptionMatches({ obj, isCluster }: Readonly<{ obj: KubeObject; isCluster: boolean }>) {
  const [events, setEvents] = useState<ExceptionEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchExceptionEvents(
      isCluster ? 'ClusterSecurityException' : 'SecurityException',
      obj.metadata.name,
      isCluster ? undefined : obj.metadata.namespace
    )
      .then(found => {
        if (active) setEvents(found);
      })
      .catch(err => {
        if (active) setError(err?.message ?? String(err));
      });
    return () => {
      active = false;
    };
  }, [obj.metadata.name, obj.metadata.namespace, isCluster]);

  return (
    <SectionBox title="Applied by the scanner">
      {error ? (
        <Typography variant="body2" color="error">
          Unable to read the events of the exception: {error}
        </Typography>
      ) : events === null ? (
        <Typography variant="body2" color="text.secondary">
          Reading events…
        </Typography>
      ) : events.length === 0 ? (
        <Typography variant="body2">
          No recent reports. When the riskAcceptance capability of the operator is enabled, the
          scanner reports every finding it suppresses with this exception. Kubernetes keeps these
          events for a limited time, by default one hour.
        </Typography>
      ) : (
        <Table
          data={events}
          columns={[
            {
              header: 'Last seen',
              accessorFn: (event: ExceptionEvent) => eventTime(event),
              Cell: ({ cell }: any) =>
                cell.getValue() ? <DateLabel date={cell.getValue()} /> : '',
            },
            { header: 'Report', accessorKey: 'message' },
            {
              header: 'Count',
              accessorFn: (event: ExceptionEvent) => event.count ?? 1,
            },
          ]}
        />
      )}
    </SectionBox>
  );
}
