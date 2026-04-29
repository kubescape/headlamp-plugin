import { Icon } from '@iconify/react';
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getAlertmanagerUrl } from '../common/config-store';
import { RoutingName } from '../index';
import { applicationProfileClass } from '../model';
import { AlertMessagePopup } from './AlertMessagePopup';

interface AlertmanagerAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  status: { state: string };
  fingerprint: string;
}

export function ApplicationProfiles() {
  const [applicationProfiles, setApplicationProfiles] = useState<KubeObject[] | null>(null);

  applicationProfileClass.useApiList(setApplicationProfiles);

  return (
    <>
      <SectionBox title="Application Profiles">
        <Typography variant="body1" sx={{ mb: 1 }}>
          Kubescape operator should be configured with{' '}
          <code>capabilities.runtimeDetection: enable</code>.
        </Typography>
        <HeadlampTable
          data={applicationProfiles ?? []}
          columns={[
            {
              header: 'Name',
              accessorFn: (profile: KubeObject) =>
                profile.jsonData.metadata.labels['kubescape.io/workload-name'],
              Cell: ({ cell, row }: any) => (
                <HeadlampLink
                  routeName={RoutingName.RuntimeDetection}
                  params={{
                    name: row.original.metadata.name,
                    namespace: row.original.metadata.namespace,
                  }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
            },
            {
              header: 'Kind',
              accessorFn: (profile: KubeObject) =>
                profile.jsonData.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              header: 'Namespace',
              accessorFn: (profile: KubeObject) => profile.metadata.namespace,
            },
            {
              header: 'Status',
              accessorFn: (profile: KubeObject) =>
                profile.jsonData.metadata.annotations?.['kubescape.io/status'],
            },
          ]}
        />
      </SectionBox>

      <AlertmanagerAlerts />
    </>
  );
}

function AlertmanagerAlerts() {
  const [alerts, setAlerts] = useState<AlertmanagerAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAlerts = () => {
    setLoading(true);
    setError('');
    const base = getAlertmanagerUrl();
    const url = `${base}/api/v2/alerts?filter=alertname%3D%22KubescapeRuleViolated%22&active=true&silenced=false&inhibited=false`;
    request(url)
      .then((data: any) => {
        const items: AlertmanagerAlert[] = Array.isArray(data) ? data : [];
        items.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
        setAlerts(items);
        setLastRefresh(new Date());
      })
      .catch((err: any) => setError(err?.message ?? String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SectionBox
      title={
        <Stack direction="row" alignItems="center" spacing={1}>
          <span>Runtime Detection Alerts</span>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchAlerts} disabled={loading}>
              <Icon icon={loading ? 'mdi:loading' : 'mdi:refresh'} />
            </IconButton>
          </Tooltip>
          {lastRefresh && (
            <Typography variant="caption" color="text.secondary">
              {new Date(lastRefresh).toLocaleTimeString()}
            </Typography>
          )}
        </Stack>
      }
    >
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      <HeadlampTable
        data={alerts}
        columns={[
          {
            id: 'time',
            header: 'Time',
            accessorKey: 'startsAt',
            Cell: ({ cell }: any) => {
              const d = new Date(cell.getValue());
              const startOfToday = new Date().setUTCHours(0, 0, 0, 0);
              return d < new Date(startOfToday)
                ? localeDate(cell.getValue())
                : d.toLocaleTimeString();
            },
            gridTemplate: 'min-content',
          },
          {
            header: 'Rule',
            accessorFn: (a: AlertmanagerAlert) => a.labels.rule_name ?? a.labels.alertname,
            gridTemplate: 'auto',
          },
          {
            header: 'Severity',
            accessorFn: (a: AlertmanagerAlert) => a.labels.severity,
            Cell: ({ cell }: any) => {
              const v = cell.getValue();
              if (!v) return null;
              const color: any = v === 'critical' ? 'error' : v === 'high' ? 'warning' : 'default';
              return <Chip label={v} color={color} size="small" />;
            },
            gridTemplate: 'min-content',
          },
          {
            header: 'Pod',
            accessorFn: (a: AlertmanagerAlert) => a.labels.pod ?? a.labels.pod_name,
            gridTemplate: 'auto',
          },
          {
            header: 'Workload',
            accessorFn: (a: AlertmanagerAlert) => a.labels.workload_name ?? a.labels.workload,
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (a: AlertmanagerAlert) => a.labels.namespace ?? a.labels.workload_namespace,
            gridTemplate: 'auto',
          },
          {
            header: 'Message',
            accessorFn: (a: AlertmanagerAlert) =>
              a.annotations.summary ?? a.annotations.description ?? a.annotations.message,
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
            gridTemplate: '2fr',
          },
          {
            header: '',
            accessorFn: () => '...',
            Cell: ({ row }: any) => (
              <AlertMessagePopup
                content={JSON.stringify(
                  { labels: row.original.labels, annotations: row.original.annotations },
                  null,
                  2
                )}
              />
            ),
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{ sorting: [{ id: 'time', desc: true }] }}
      />
    </SectionBox>
  );
}
