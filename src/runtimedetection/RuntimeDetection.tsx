import { Icon } from '@iconify/react';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import { remove, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import { TabContext, TabList } from '@mui/lab';
import { Alert, Chip, IconButton, Stack, Tab, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getAlertmanagerUrl } from '../common/config-store';
import { TabPanel } from '../common/TabPanel';
import { RoutingName } from '../index';
import {
  applicationProfileClass,
  listQuery,
  networkNeighborhoodsClass,
  rulesClass,
} from '../model';
import { AlertMessagePopup } from './AlertMessagePopup';

const { createRouteURL } = Router;

interface AlertmanagerAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  status: { state: string };
  fingerprint: string;
}

export function RuntimeDetection() {
  const [tabValue, setTabValue] = useState('alerts');

  return (
    <SectionBox title="Runtime Detection">
      <TabContext value={tabValue}>
        <TabList onChange={(_: any, v: string) => setTabValue(v)} sx={{ mb: 1 }}>
          <Tab label="Alerts" value="alerts" />
          <Tab label="Application Profiles" value="profiles" />
          <Tab label="Network Neighborhoods" value="networks" />
          <Tab label="Rules" value="rules" />
          <Tab label="Rule Bindings" value="bindings" />
        </TabList>
        <TabPanel value="alerts">
          <AlertsTab />
        </TabPanel>
        <TabPanel value="profiles">
          <ApplicationProfilesTab />
        </TabPanel>
        <TabPanel value="networks">
          <NetworkNeighborhoodsTab />
        </TabPanel>
        <TabPanel value="rules">
          <RulesTab />
        </TabPanel>
        <TabPanel value="bindings">
          <RuleBindingsTab />
        </TabPanel>
      </TabContext>
    </SectionBox>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertmanagerAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const alertmanagerUrl = getAlertmanagerUrl();

  const fetchAlerts = () => {
    if (!alertmanagerUrl) return;
    setLoading(true);
    setError('');
    const url = `${alertmanagerUrl}/api/v2/alerts?filter=alertname%3D%22KubescapeRuleViolated%22&active=true&silenced=false&inhibited=false`;
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

  if (!alertmanagerUrl) {
    return (
      <Alert severity="warning" variant="filled">
        Alertmanager URL is not configured. Please set it in the Kubescape plugin settings.
      </Alert>
    );
  }

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchAlerts} disabled={loading}>
            <Icon icon={loading ? 'mdi:loading' : 'mdi:refresh'} />
          </IconButton>
        </Tooltip>
        {lastRefresh && (
          <Typography variant="caption" color="text.secondary">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </Typography>
        )}
      </Stack>

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
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              return d < startOfToday ? localeDate(cell.getValue()) : d.toLocaleTimeString();
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
    </>
  );
}

// ── Application Profiles ──────────────────────────────────────────────────────

function ApplicationProfilesTab() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listQuery(applicationProfileClass)
      .then(setProfiles)
      .catch((err: any) => setError(err?.message ?? String(err)));
  }, []);

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Baseline of workload behaviour recorded by Kubescape during the learning phase. Used by{' '}
        <code>ap.*</code> CEL functions in rules.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <HeadlampTable
        data={profiles}
        columns={[
          {
            header: 'Name',
            accessorFn: (p: any) => p.metadata.labels?.['kubescape.io/workload-name'],
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
            gridTemplate: 'auto',
          },
          {
            header: 'Kind',
            accessorFn: (p: any) => p.metadata.labels?.['kubescape.io/workload-kind'],
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (p: any) => p.metadata.namespace,
            gridTemplate: 'auto',
          },
          {
            header: 'Status',
            accessorFn: (p: any) => p.metadata.annotations?.['kubescape.io/status'],
            gridTemplate: 'auto',
          },
        ]}
      />
    </>
  );
}

// ── Network Neighborhoods ─────────────────────────────────────────────────────

function NetworkNeighborhoodsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listQuery(networkNeighborhoodsClass)
      .then(setItems)
      .catch((err: any) => setError(err?.message ?? String(err)));
  }, []);

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Baseline of workload network activity recorded by Kubescape. Used by <code>nn.*</code> CEL
        functions in rules.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <HeadlampTable
        data={items}
        columns={[
          {
            header: 'Name',
            accessorFn: (p: any) =>
              p.metadata.labels?.['kubescape.io/workload-name'] ?? p.metadata.name,
            Cell: ({ cell, row }: any) => (
              <HeadlampLink
                routeName={RoutingName.NetworkNeighborhoodDetail}
                params={{
                  name: row.original.metadata.name,
                  namespace: row.original.metadata.namespace,
                }}
              >
                {cell.getValue()}
              </HeadlampLink>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Kind',
            accessorFn: (p: any) => p.metadata.labels?.['kubescape.io/workload-kind'],
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (p: any) => p.metadata.namespace,
            gridTemplate: 'auto',
          },
          {
            header: 'Containers',
            accessorFn: (p: any) => p.spec?.containers?.length ?? 0,
            gridTemplate: 'min-content',
          },
        ]}
      />
    </>
  );
}

// ── Rules ─────────────────────────────────────────────────────────────────────

function RulesTab() {
  const [rulesCRDs] = rulesClass.useList() as any;
  const history = useHistory();

  const items =
    rulesCRDs?.map((crd: any) => ({
      crdName: crd.jsonData.metadata.name,
      namespace: crd.jsonData.metadata.namespace,
      ruleCount: crd.jsonData.spec?.rules?.length ?? 0,
    })) ?? [];

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0} sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          <code>kubescape.io/v1 Rules</code> CRDs deployed in the cluster. Click a name to open the
          rule editor.
        </Typography>
        <Tooltip title="Add new rule">
          <IconButton onClick={() => history.push(createRouteURL(RoutingName.RuleNew))}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
      </Stack>
      <HeadlampTable
        data={items}
        columns={[
          {
            id: 'name',
            header: 'Name',
            accessorKey: 'crdName',
            Cell: ({ cell, row }: any) => (
              <HeadlampLink
                routeName={RoutingName.RuleEdit}
                params={{ namespace: row.original.namespace, name: row.original.crdName }}
              >
                {cell.getValue()}
              </HeadlampLink>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorKey: 'namespace',
            gridTemplate: 'auto',
          },
          {
            header: 'Rules',
            accessorKey: 'ruleCount',
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{ sorting: [{ id: 'name', desc: false }] }}
      />
    </>
  );
}

// ── Rule Bindings ─────────────────────────────────────────────────────────────

function formatSelector(selector: any): string {
  if (!selector) return '(all)';
  const parts: string[] = [];
  if (selector.matchLabels) {
    parts.push(...Object.entries(selector.matchLabels).map(([k, v]) => `${k}=${v}`));
  }
  if (selector.matchExpressions) {
    parts.push(
      ...selector.matchExpressions.map(
        (e: any) => `${e.key} ${e.operator} [${(e.values ?? []).join(', ')}]`
      )
    );
  }
  return parts.length ? parts.join(', ') : '(all)';
}

function severityColor(severity: string | undefined): 'error' | 'warning' | 'default' {
  if (severity === 'Critical' || severity === 'High') return 'error';
  if (severity === 'Medium') return 'warning';
  return 'default';
}

const RULE_BINDING_API = '/apis/kubescape.io/v1/runtimerulealertbindings';

function RuleBindingsTab() {
  const history = useHistory();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = () =>
    request(RULE_BINDING_API)
      .then((res: any) => setItems(res.items ?? []))
      .catch((err: any) => setError(err?.message ?? String(err)));

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (name: string) => {
    try {
      await remove(`${RULE_BINDING_API}/${name}`);
      load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          <code>RuntimeRuleAlertBinding</code> objects bind runtime rules to workloads by namespace
          and pod selectors.
        </Typography>
        <Tooltip title="Add rule binding">
          <IconButton onClick={() => history.push(createRouteURL(RoutingName.RuleBindingNew))}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <HeadlampTable
        data={items}
        columns={[
          {
            id: 'name',
            header: 'Name',
            accessorFn: (b: any) => b.metadata.name,
            Cell: ({ cell, row }: any) => (
              <HeadlampLink
                routeName={RoutingName.RuleBindingEdit}
                params={{ name: row.original.metadata.name }}
              >
                {cell.getValue()}
              </HeadlampLink>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace Selector',
            accessorFn: (b: any) => formatSelector(b.spec?.namespaceSelector),
            gridTemplate: 'auto',
          },
          {
            header: 'Pod Selector',
            accessorFn: (b: any) => formatSelector(b.spec?.podSelector),
            gridTemplate: 'auto',
          },
          {
            header: 'Rules',
            accessorFn: (b: any) => b.spec?.rules ?? [],
            Cell: ({ cell }: any) => (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {(cell.getValue() as any[]).map((r: any) => (
                  <Chip
                    key={r.ruleName}
                    label={r.ruleName}
                    size="small"
                    color={severityColor(r.severity)}
                  />
                ))}
              </Stack>
            ),
            gridTemplate: '2fr',
          },
          {
            header: '',
            accessorFn: (b: any) => b.metadata.name,
            Cell: ({ cell }: any) => (
              <IconButton size="small" onClick={() => handleDelete(cell.getValue())}>
                <Icon icon="mdi:delete-outline" />
              </IconButton>
            ),
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{ sorting: [{ id: 'name', desc: false }] }}
      />
    </>
  );
}
