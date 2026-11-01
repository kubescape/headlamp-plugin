import { post, remove, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  getAlertmanagerUrl,
  isValidAlertmanagerAddress,
  kubescapeConfigStore,
} from '../common/config-store';
import type { AccessCheck } from '../common/permissions';
import { podsOfWorkloadPattern } from './alertFields';

export interface AlertmanagerAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  status: { state: string };
  fingerprint: string;
  // set by the plugin for multi cluster support
  cluster?: string;
}

/**
 * Returns the active Kubescape rule alerts from the configured Alertmanager, newest first.
 * The Alertmanager address is the same in every cluster.
 */
export async function fetchKubescapeAlerts(cluster?: string): Promise<AlertmanagerAlert[]> {
  const alertmanagerUrl = getAlertmanagerUrl();
  if (!alertmanagerUrl) return [];

  const url = `${alertmanagerUrl}/api/v2/alerts?filter=alertname%3D%22KubescapeRuleViolated%22&active=true&silenced=false&inhibited=false`;
  const data = await request(url, cluster ? { cluster } : {});
  const alerts: AlertmanagerAlert[] = Array.isArray(data) ? data : [];
  return alerts
    .map(alert => ({ ...alert, cluster }))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

interface Service {
  metadata: { name: string; namespace: string; labels?: Record<string, string> };
  spec?: { clusterIP?: string; ports?: Array<{ name?: string; port: number }> };
}

function isAlertmanager(service: Service) {
  const labels = service.metadata.labels ?? {};
  return (
    service.metadata.name.includes('alertmanager') ||
    labels['app.kubernetes.io/name'] === 'alertmanager' ||
    (labels.app ?? '').includes('alertmanager')
  );
}

// Headless services, such as alertmanager-operated of the Prometheus operator, are the last resort
function isHeadless(service: Service) {
  return service.spec?.clusterIP === 'None';
}

/**
 * Returns the addresses (namespace/service:port) of the Alertmanager services, the most
 * likely first: services with a cluster IP before headless ones.
 */
export function alertmanagerAddresses(services: Service[]): string[] {
  return services
    .filter(isAlertmanager)
    .sort((a, b) => Number(isHeadless(a)) - Number(isHeadless(b)))
    .map(service => {
      const ports = service.spec?.ports ?? [];
      const port =
        ports.find(p => p.port === 9093) ??
        ports.find(p => ['web', 'http-web', 'http'].includes(p.name ?? '')) ??
        ports[0];
      return port && `${service.metadata.namespace}/${service.metadata.name}:${port.port}`;
    })
    .filter((address): address is string => !!address && isValidAlertmanagerAddress(address));
}

/** Looks for Alertmanager services in the cluster. */
export async function detectAlertmanager(cluster?: string): Promise<string[]> {
  const list = await request('/api/v1/services', cluster ? { cluster } : {});
  return alertmanagerAddresses(list.items ?? []);
}

export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex: boolean;
  isEqual?: boolean;
}

export interface Silence {
  id: string;
  status: { state: string };
  matchers: SilenceMatcher[];
  startsAt: string;
  endsAt: string;
  createdBy: string;
  comment: string;
  // set by the plugin for multi cluster support
  cluster?: string;
}

/** Where a silence applies: one pod, all pods of its workload, a namespace or the cluster. */
export type SilenceScope = 'pod' | 'workload' | 'namespace' | 'cluster';

// Labels that tell which rule fired where. Other labels, such as the process, differ between
// occurrences, so a silence that matched them would not silence the next one.
const ruleLabels = ['alertname', 'rule_name', 'rule_id'];
const namespaceLabels = ['namespace', 'workload_namespace'];
const workloadLabels = ['workload_kind', 'workload_name', 'workload'];
const podLabels = ['pod', 'pod_name'];

function hasLabel(alert: AlertmanagerAlert, names: string[]) {
  return names.some(name => alert.labels[name] !== undefined);
}

function equalTo(alert: AlertmanagerAlert, names: string[]): SilenceMatcher[] {
  return names
    .filter(name => alert.labels[name] !== undefined)
    .map(name => ({ name, value: alert.labels[name], isRegex: false, isEqual: true }));
}

// the node-agent names the workload of an alert only by its uid, so a silence of the workload
// matches the names of its pods
function podsOfWorkload(alert: AlertmanagerAlert): SilenceMatcher | undefined {
  const label = podLabels.find(name => alert.labels[name] !== undefined);
  const pattern = label && podsOfWorkloadPattern(alert.labels[label]);
  return label && pattern
    ? { name: label, value: pattern, isRegex: true, isEqual: true }
    : undefined;
}

/** The scopes in which the rule of an alert can be silenced, the narrowest first. */
export function silenceScopes(alert: AlertmanagerAlert): SilenceScope[] {
  if (!hasLabel(alert, ['rule_name', 'rule_id'])) return ['pod'];
  const scopes: SilenceScope[] = [];
  if (hasLabel(alert, podLabels)) scopes.push('pod');
  if (hasLabel(alert, workloadLabels) || podsOfWorkload(alert)) scopes.push('workload');
  if (hasLabel(alert, namespaceLabels)) scopes.push('namespace');
  scopes.push('cluster');
  return scopes;
}

/**
 * Matchers that silence the rule of the alert in a scope, and not only this occurrence. Alerts
 * without the labels of a rule are matched on all their labels.
 */
export function silenceMatchers(alert: AlertmanagerAlert, scope: SilenceScope): SilenceMatcher[] {
  if (!hasLabel(alert, ['rule_name', 'rule_id'])) return equalTo(alert, Object.keys(alert.labels));
  const rule = equalTo(alert, ruleLabels);
  if (scope === 'cluster') return rule;
  const namespace = equalTo(alert, namespaceLabels);
  if (scope === 'namespace') return [...rule, ...namespace];
  if (scope === 'workload') {
    if (hasLabel(alert, workloadLabels)) {
      return [...rule, ...namespace, ...equalTo(alert, workloadLabels)];
    }
    const pods = podsOfWorkload(alert);
    if (pods) return [...rule, ...namespace, pods];
  }
  return [...rule, ...namespace, ...equalTo(alert, podLabels)];
}

export interface SilenceRequest {
  scope: SilenceScope;
  hours: number;
  // why the alerts are silenced
  comment: string;
}

function requireAlertmanagerUrl(): string {
  const alertmanagerUrl = getAlertmanagerUrl();
  if (!alertmanagerUrl) throw new Error('Alertmanager is not configured.');
  return alertmanagerUrl;
}

/**
 * Silences the rule of the alert in the requested scope and for the requested time, as the
 * given user, and returns the id of the silence.
 */
export async function silenceAlert(
  alert: AlertmanagerAlert,
  request: SilenceRequest,
  user: string | undefined,
  now: Date = new Date()
): Promise<string> {
  const silence = {
    matchers: silenceMatchers(alert, request.scope),
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + request.hours * 60 * 60 * 1000).toISOString(),
    createdBy: user ?? 'unknown Headlamp user',
    comment: request.comment.trim() || 'Silenced in Headlamp',
  };
  const result = await post(
    `${requireAlertmanagerUrl()}/api/v2/silences`,
    silence,
    false,
    alert.cluster ? { cluster: alert.cluster } : undefined
  );
  return result?.silenceID;
}

/** The silences of Kubescape alerts that are in effect or will be, soonest to end first. */
export async function fetchKubescapeSilences(cluster?: string): Promise<Silence[]> {
  const alertmanagerUrl = getAlertmanagerUrl();
  if (!alertmanagerUrl) return [];

  const filter = new URLSearchParams({ filter: 'alertname="KubescapeRuleViolated"' });
  const data = await request(
    `${alertmanagerUrl}/api/v2/silences?${filter.toString()}`,
    cluster ? { cluster } : {}
  );
  const silences: Silence[] = Array.isArray(data) ? data : [];
  return silences
    .filter(silence => silence.status?.state !== 'expired')
    .map(silence => ({ ...silence, cluster }))
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
}

/** Ends the silence, so its alerts show again. */
export async function expireSilence(silence: Silence): Promise<void> {
  await remove(
    `${requireAlertmanagerUrl()}/api/v2/silence/${silence.id}`,
    silence.cluster ? { cluster: silence.cluster } : undefined
  );
}

/**
 * Proxying requests to the Alertmanager service: create for creating silences, delete for
 * ending them.
 */
export function alertmanagerProxyCheck(verb: 'create' | 'delete' = 'create'): AccessCheck | null {
  const address = kubescapeConfigStore.get()?.alertmanagerUrl;
  if (!address || !isValidAlertmanagerAddress(address)) return null;
  return {
    group: '',
    resource: 'services',
    subresource: 'proxy',
    verb,
    namespace: address.split('/')[0],
  };
}
