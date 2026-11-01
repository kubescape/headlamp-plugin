import { Icon } from '@iconify/react';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import { remove, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import { TabContext, TabList } from '@mui/lab';
import { Alert, Chip, IconButton, Stack, Tab, Tooltip, Typography } from '@mui/material';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ClusterErrors } from '../common/ClusterErrors';
import { clusterColumns, rejectedClusters } from '../common/clusters';
import { getAlertmanagerUrl, kubescapeConfigStore } from '../common/config-store';
import { PermittedIconButton } from '../common/permissions';
import { SetupCheck } from '../common/SetupCheck';
import HeadlampTable from '../common/Table';
import { TabPanel } from '../common/TabPanel';
import { RoutingName, useHLSelectedClusters } from '../index';
import {
  applicationProfileClass,
  ClusterError,
  containerProfileClass,
  listQuery,
  networkNeighborhoodsClass,
  rulesClass,
} from '../model';
import { ContainerProfile } from '../softwarecomposition/ContainerProfile';
import { discoverProfileResource } from '../softwarecomposition/profileApi';
import { AlertDetailsDialog } from './AlertDetails';
import {
  alertMessage,
  alertNamespace,
  alertPod,
  alertRule,
  alertSeverity,
  alertWorkload,
  indexRules,
  ruleDescription,
  severityColor,
  severityRank,
} from './alertFields';
import {
  AlertmanagerAlert,
  detectAlertmanager,
  fetchKubescapeAlerts,
  fetchKubescapeSilences,
  Silence,
} from './alertmanager';
import { SilenceButton, SilenceList, SilenceNotice } from './Silences';

const { createRouteURL } = Router;

// Offers to use the Alertmanager found in the cluster when none is configured
function AlertmanagerSuggestion(props: Readonly<{ cluster: string }>) {
  const { cluster } = props;
  const [addresses, setAddresses] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    detectAlertmanager(cluster)
      .catch(() => [])
      .then(found => {
        if (active) setAddresses(found);
      });
    return () => {
      active = false;
    };
  }, [cluster]);

  return (
    <Alert severity="warning" variant="filled">
      Alertmanager URL is not configured. Please set it in the Kubescape plugin settings.
      {addresses && addresses.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap">
          <span>Found in cluster {cluster}:</span>
          {addresses.map(address => (
            <Chip
              key={address}
              label={`Use ${address}`}
              size="small"
              onClick={() => kubescapeConfigStore.update({ alertmanagerUrl: address })}
            />
          ))}
        </Stack>
      )}
    </Alert>
  );
}

export function RuntimeDetection() {
  const [tabValue, setTabValue] = useState('alerts');

  return (
    <SectionBox title="Runtime Detection">
      <SetupCheck features={['runtime']} />
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
          {tabValue === 'profiles' && <ApplicationProfilesTab />}
        </TabPanel>
        <TabPanel value="networks">
          {tabValue === 'networks' && <NetworkNeighborhoodsTab />}
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
  const clusters = useHLSelectedClusters();
  const clustersKey = clusters.join(',');
  const [alerts, setAlerts] = useState<AlertmanagerAlert[]>([]);
  const [silences, setSilences] = useState<Silence[]>([]);
  const [notice, setNotice] = useState<SilenceNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ClusterError[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selected, setSelected] = useState<AlertmanagerAlert | null>(null);
  // the rules of the clusters, for what each alert's rule detects
  const [ruleObjects] = rulesClass.useList({ clusters }) as any;
  const rules = useMemo(
    () =>
      indexRules(
        (ruleObjects ?? []).map((object: any) => ({
          cluster: object.cluster,
          rules: object.jsonData?.spec?.rules,
        }))
      ),
    [ruleObjects]
  );
  // re-render when the Alertmanager address is configured
  kubescapeConfigStore.useConfig()();
  const alertmanagerUrl = getAlertmanagerUrl();

  const fetchAlerts = () => {
    if (!alertmanagerUrl) return;
    setLoading(true);
    Promise.all([
      Promise.allSettled(clusters.map(cluster => fetchKubescapeAlerts(cluster))),
      // the silences only add to the alerts, so failing to read them is not reported
      Promise.allSettled(clusters.map(cluster => fetchKubescapeSilences(cluster))),
    ])
      .then(([results, silenceResults]) => {
        setAlerts(
          results
            .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        );
        setSilences(
          silenceResults.flatMap(result => (result.status === 'fulfilled' ? result.value : []))
        );
        setErrors(rejectedClusters(clusters, results));
        setLastRefresh(new Date());
      })
      .finally(() => setLoading(false));
  };

  // a silenced alert leaves the list, and an ended silence brings its alerts back
  const onSilenceChange = (change: SilenceNotice) => {
    setNotice(change);
    if (change.severity === 'success') fetchAlerts();
  };

  useEffect(() => {
    fetchAlerts();
    // no refreshing while Headlamp is minimized or in a background tab
    const interval = setInterval(() => {
      if (!document.hidden) fetchAlerts();
    }, 60_000);
    return () => clearInterval(interval);
  }, [alertmanagerUrl, clustersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alertmanagerUrl) {
    return <AlertmanagerSuggestion cluster={clusters[0]} />;
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

      <ClusterErrors errors={errors} what="the alerts" />
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 1 }}>
          {notice.text}
        </Alert>
      )}

      <HeadlampTable
        data={alerts}
        // a click on an alert shows its details
        onRowClick={setSelected}
        // the cells of a row keep what the row first showed, so each alert is a row of its own
        getRowId={(a: AlertmanagerAlert) => `${a.cluster}/${a.fingerprint}/${a.startsAt}`}
        columns={[
          ...clusterColumns<AlertmanagerAlert>(clusters, alert => alert.cluster),
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
            // with what the rule detects, which the search also finds; Headlamp only redraws a
            // cell when its value changes, so rules read after the alerts are part of it
            accessorFn: (a: AlertmanagerAlert) =>
              [a.labels.rule_name ?? a.labels.alertname, ruleDescription(alertRule(rules, a))]
                .filter(Boolean)
                .join('\n'),
            Cell: ({ cell }: any) => {
              const [name, description] = String(cell.getValue()).split('\n');
              return description ? (
                <Tooltip title={description}>
                  <span>{name}</span>
                </Tooltip>
              ) : (
                name
              );
            },
            // the details can also be opened with the keyboard
            muiTableBodyCellProps: ({ row }: any) => ({
              tabIndex: 0,
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelected(row.original);
                }
              },
            }),
            gridTemplate: 'auto',
          },
          {
            id: 'severity',
            header: 'Severity',
            accessorFn: (a: AlertmanagerAlert) => alertSeverity(a) ?? '',
            sortingFn: (a: any, b: any) =>
              (severityRank[alertSeverity(a.original) ?? 'None'] ?? 0) -
              (severityRank[alertSeverity(b.original) ?? 'None'] ?? 0),
            Cell: ({ cell }: any) => {
              const severity = cell.getValue();
              if (!severity) return null;
              return <Chip label={severity} color={severityColor(severity)} size="small" />;
            },
            gridTemplate: 'min-content',
          },
          {
            header: 'Pod',
            accessorFn: (a: AlertmanagerAlert) => alertPod(a),
            gridTemplate: 'auto',
          },
          {
            header: 'Workload',
            accessorFn: (a: AlertmanagerAlert) => alertWorkload(a),
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (a: AlertmanagerAlert) => alertNamespace(a),
            gridTemplate: 'auto',
          },
          {
            header: 'Message',
            accessorFn: (a: AlertmanagerAlert) => alertMessage(a),
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
            gridTemplate: 'minmax(280px, 2fr)',
          },
          {
            header: '',
            accessorFn: (a: AlertmanagerAlert) => `${a.cluster}/${a.fingerprint}`,
            Cell: ({ row }: any) => <SilenceButton alert={row.original} onDone={onSilenceChange} />,
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{ sorting: [{ id: 'time', desc: true }] }}
      />
      {selected && (
        <AlertDetailsDialog
          alert={selected}
          rule={alertRule(rules, selected)}
          onClose={() => setSelected(null)}
          onSilenced={change => {
            setSelected(null);
            onSilenceChange(change);
          }}
        />
      )}

      <SilenceList silences={silences} showCluster={clusters.length > 1} onDone={onSilenceChange} />
    </>
  );
}

// ── Container Profile perspectives ───────────────────────────────────────────

function ApplicationProfilesTab() {
  return <ContainerProfilesTab view="behavior" />;
}

function NetworkNeighborhoodsTab() {
  return <ContainerProfilesTab view="network" />;
}

function ContainerProfilesTab({ view }: Readonly<{ view: 'behavior' | 'network' }>) {
  const [items, setItems] = useState<ContainerProfile[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    discoverProfileResource(view)
      .then(source =>
        listQuery(
          source.modern
            ? containerProfileClass
            : view === 'behavior'
            ? applicationProfileClass
            : networkNeighborhoodsClass
        )
      )
      .then((profiles: ContainerProfile[]) => {
        if (active) setItems(profiles);
      })
      .catch((err: any) => {
        if (active) setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view]);

  const behavior = view === 'behavior';
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {behavior ? (
          <>
            Workload behaviour baselines recorded by Kubescape. Used by <code>ap.*</code> CEL
            functions in rules.
          </>
        ) : (
          <>
            Workload network baselines recorded by Kubescape. Used by <code>nn.*</code> CEL
            functions in rules.
          </>
        )}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      {!loading && !error && items.length === 0 && (
        <Typography variant="body2">No profiles found.</Typography>
      )}
      {!error && (
        <HeadlampTable
          data={items}
          columns={[
            {
              header: 'Name',
              accessorFn: (p: ContainerProfile) =>
                p.metadata.labels?.['kubescape.io/workload-name'] ?? p.metadata.name,
              Cell: ({ cell, row }: any) => (
                <HeadlampLink
                  routeName={
                    behavior ? RoutingName.RuntimeDetection : RoutingName.NetworkNeighborhoodDetail
                  }
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
              accessorFn: (p: ContainerProfile) =>
                p.metadata.labels?.['kubescape.io/workload-kind'],
              gridTemplate: 'auto',
            },
            {
              header: 'Namespace',
              accessorFn: (p: ContainerProfile) => p.metadata.namespace,
              gridTemplate: 'auto',
            },
            {
              header: 'Container',
              accessorFn: (p: ContainerProfile) =>
                p.metadata.labels?.['kubescape.io/workload-container-name'] ?? '—',
              gridTemplate: 'auto',
            },
            {
              header: 'Status',
              accessorFn: (p: ContainerProfile) => p.metadata.annotations?.['kubescape.io/status'],
              gridTemplate: 'auto',
            },
          ]}
        />
      )}
    </>
  );
}

// ── Rules ─────────────────────────────────────────────────────────────────────

function RulesTab() {
  const clusters = useHLSelectedClusters();
  const [rulesCRDs] = rulesClass.useList({ clusters }) as any;
  const history = useHistory();
  const [error, setError] = useState('');

  const items =
    rulesCRDs?.map((crd: any) => ({
      crdName: crd.jsonData.metadata.name,
      namespace: crd.jsonData.metadata.namespace,
      cluster: crd.cluster,
      ruleCount: crd.jsonData.spec?.rules?.length ?? 0,
    })) ?? [];

  // The list is watched, so a successful delete removes the row without a reload.
  const handleDelete = async (namespace: string, crdName: string, cluster?: string) => {
    try {
      await remove(
        `/apis/kubescape.io/v1/namespaces/${namespace}/rules/${crdName}`,
        cluster ? { cluster } : undefined
      );
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

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
            accessorKey: 'crdName',
            Cell: ({ cell, row }: any) => (
              <HeadlampLink
                routeName={RoutingName.RuleEdit}
                activeCluster={row.original.cluster}
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
          ...clusterColumns<any>(clusters, item => item.cluster),
          {
            header: 'Rules',
            accessorKey: 'ruleCount',
            gridTemplate: 'min-content',
          },
          {
            header: '',
            accessorFn: (item: any) => item.crdName,
            Cell: ({ row }: any) => (
              <PermittedIconButton
                check={{
                  group: 'kubescape.io',
                  resource: 'rules',
                  verb: 'delete',
                  namespace: row.original.namespace,
                  name: row.original.crdName,
                }}
                cluster={row.original.cluster}
                title="Delete"
                ariaLabel={`Delete ${row.original.crdName}`}
                onClick={() =>
                  handleDelete(row.original.namespace, row.original.crdName, row.original.cluster)
                }
              >
                <Icon icon="mdi:delete-outline" />
              </PermittedIconButton>
            ),
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

const RULE_BINDING_API = '/apis/kubescape.io/v1/runtimerulealertbindings';

function RuleBindingsTab() {
  const history = useHistory();
  const clusters = useHLSelectedClusters();
  const clustersKey = clusters.join(',');
  const [items, setItems] = useState<any[]>([]);
  const [errors, setErrors] = useState<ClusterError[]>([]);
  const [error, setError] = useState('');

  const load = () =>
    Promise.allSettled(
      clusters.map(cluster =>
        request(RULE_BINDING_API, { cluster }).then((res: any) =>
          (res.items ?? []).map((item: any) => ({ ...item, cluster }))
        )
      )
    ).then(results => {
      setItems(results.flatMap(result => (result.status === 'fulfilled' ? result.value : [])));
      setErrors(rejectedClusters(clusters, results));
    });

  useEffect(() => {
    load();
  }, [clustersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (name: string, cluster: string) => {
    try {
      await remove(`${RULE_BINDING_API}/${name}`, { cluster });
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
        <PermittedIconButton
          check={{ group: 'kubescape.io', resource: 'runtimerulealertbindings', verb: 'create' }}
          title="Add rule binding"
          onClick={() => history.push(createRouteURL(RoutingName.RuleBindingNew))}
        >
          <Icon icon="mdi:add-circle" />
        </PermittedIconButton>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <ClusterErrors errors={errors} what="the rule bindings" />
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
                activeCluster={row.original.cluster}
                params={{ name: row.original.metadata.name }}
              >
                {cell.getValue()}
              </HeadlampLink>
            ),
            gridTemplate: 'auto',
          },
          ...clusterColumns<any>(clusters, item => item.cluster),
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
            Cell: ({ cell, row }: any) => (
              <PermittedIconButton
                check={{
                  group: 'kubescape.io',
                  resource: 'runtimerulealertbindings',
                  verb: 'delete',
                  name: cell.getValue(),
                }}
                cluster={row.original.cluster}
                title="Delete"
                ariaLabel={`Delete ${cell.getValue()}`}
                onClick={() => handleDelete(cell.getValue(), row.original.cluster)}
              >
                <Icon icon="mdi:delete-outline" />
              </PermittedIconButton>
            ),
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{ sorting: [{ id: 'name', desc: false }] }}
      />
    </>
  );
}
