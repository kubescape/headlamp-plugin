import { vi } from 'vitest';
import {
  alertmanagerAddresses,
  AlertmanagerAlert,
  alertmanagerProxyCheck,
  detectAlertmanager,
  expireSilence,
  fetchKubescapeAlerts,
  fetchKubescapeSilences,
  silenceAlert,
  silenceMatchers,
  silenceScopes,
} from './alertmanager';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  post: vi.fn(),
  remove: vi.fn(),
  alertmanagerUrl: undefined as string | undefined,
  address: undefined as string | undefined,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  post: mocks.post,
  remove: mocks.remove,
}));
vi.mock('../common/config-store', () => ({
  getAlertmanagerUrl: () => mocks.alertmanagerUrl,
  kubescapeConfigStore: { get: () => ({ alertmanagerUrl: mocks.address }) },
  isValidAlertmanagerAddress: (address: string) => /^[a-z0-9-]+\/[a-z0-9-]+:[0-9]+$/.test(address),
}));

function service(
  namespace: string,
  name: string,
  ports: Array<{ name?: string; port: number }>,
  extra: { labels?: Record<string, string>; clusterIP?: string } = {}
) {
  return {
    metadata: { name, namespace, labels: extra.labels },
    spec: { clusterIP: extra.clusterIP ?? '10.0.0.1', ports },
  };
}

const proxy = '/api/v1/namespaces/monitoring/services/alertmanager:9093/proxy';

beforeEach(() => {
  mocks.request.mockReset();
  mocks.post.mockReset();
  mocks.remove.mockReset();
  mocks.alertmanagerUrl = undefined;
  mocks.address = undefined;
});

it('finds Alertmanager services, headless ones last', () => {
  expect(
    alertmanagerAddresses([
      service('monitoring', 'alertmanager-operated', [{ name: 'web', port: 9093 }], {
        clusterIP: 'None',
      }),
      service('monitoring', 'kube-prometheus-stack-alertmanager', [
        { name: 'reloader-web', port: 8080 },
        { name: 'http-web', port: 9093 },
      ]),
      service('monitoring', 'prometheus', [{ port: 9090 }]),
      service('observability', 'am', [{ name: 'http', port: 80 }], {
        labels: { 'app.kubernetes.io/name': 'alertmanager' },
      }),
    ])
  ).toEqual([
    'monitoring/kube-prometheus-stack-alertmanager:9093',
    'observability/am:80',
    'monitoring/alertmanager-operated:9093',
  ]);
});

it('skips services without ports', () => {
  expect(alertmanagerAddresses([service('monitoring', 'alertmanager', [])])).toEqual([]);
});

it('detects Alertmanager in the given cluster', async () => {
  mocks.request.mockResolvedValue({
    items: [service('monitoring', 'alertmanager', [{ port: 9093 }])],
  });
  expect(await detectAlertmanager('cluster-a')).toEqual(['monitoring/alertmanager:9093']);
  expect(mocks.request).toHaveBeenCalledWith('/api/v1/services', { cluster: 'cluster-a' });
});

it('returns the alerts of a cluster newest first, tagged with the cluster', async () => {
  mocks.alertmanagerUrl = '/api/v1/namespaces/monitoring/services/alertmanager:9093/proxy';
  mocks.request.mockResolvedValue([
    { labels: { rule_name: 'old' }, startsAt: '2026-10-01T10:00:00Z' },
    { labels: { rule_name: 'new' }, startsAt: '2026-10-02T10:00:00Z' },
  ]);

  const alerts = await fetchKubescapeAlerts('cluster-b');

  expect(alerts.map(alert => [alert.labels.rule_name, alert.cluster])).toEqual([
    ['new', 'cluster-b'],
    ['old', 'cluster-b'],
  ]);
  expect(mocks.request.mock.calls[0][0]).toMatch(
    /^\/api\/v1\/namespaces\/monitoring\/services\/alertmanager:9093\/proxy\/api\/v2\/alerts\?/
  );
});

it('returns no alerts without an Alertmanager address', async () => {
  expect(await fetchKubescapeAlerts('cluster-a')).toEqual([]);
  expect(mocks.request).not.toHaveBeenCalled();
});

const alert: AlertmanagerAlert = {
  labels: {
    alertname: 'KubescapeRuleViolated',
    rule_name: 'Unexpected process launched',
    rule_id: 'R0001',
    namespace: 'shop',
    workload_name: 'web',
    workload_kind: 'Deployment',
    container_name: 'web',
    pid: '4242',
    process_name: 'sh',
  },
  annotations: {},
  startsAt: '2026-10-30T10:00:00Z',
  endsAt: '2026-10-30T11:00:00Z',
  status: { state: 'active' },
  fingerprint: 'abc',
  cluster: 'cluster-b',
};

it('silences the rule for the workload, not only this occurrence', () => {
  expect(silenceMatchers(alert, 'workload').map(matcher => matcher.name)).toEqual([
    'alertname',
    'rule_name',
    'rule_id',
    'namespace',
    'workload_kind',
    'workload_name',
  ]);
  expect(silenceMatchers(alert, 'workload')[1]).toEqual({
    name: 'rule_name',
    value: 'Unexpected process launched',
    isRegex: false,
    isEqual: true,
  });
});

// the node-agent names the workload only by its uid
const nodeAgentAlert: AlertmanagerAlert = {
  ...alert,
  labels: {
    alertname: 'KubescapeRuleViolated',
    rule_name: 'DNS Anomalies in container',
    rule_id: 'R0005',
    namespace: 'certificates',
    pod_name: 'cert-watch-b576bb668-5f2s6',
    container_name: 'watcher',
    workload_uid: '8df60cff-750c-4dfd-9e9b-4dd8476ed8a7',
    pid: '9635',
  },
};

it('silences the pods of a workload by their names, also those of later rollouts', () => {
  expect(silenceScopes(nodeAgentAlert)).toEqual(['pod', 'workload', 'namespace', 'cluster']);
  const matchers = silenceMatchers(nodeAgentAlert, 'workload');
  const pods = matchers[matchers.length - 1];
  expect(pods).toMatchObject({ name: 'pod_name', isRegex: true });
  const matches = (pod: string) => new RegExp(`^(?:${pods.value})$`).test(pod);
  expect(matches('cert-watch-b576bb668-5f2s6')).toBe(true);
  expect(matches('cert-watch-7d9f8c6b54-x2x9z')).toBe(true);
  expect(matches('cert-watch-api-7d9f8c6b54-x2x9z')).toBe(false);
  expect(matches('other-b576bb668-5f2s6')).toBe(false);
});

it('silences the rule for one pod, a namespace or the whole cluster', () => {
  const names = (scope: 'pod' | 'namespace' | 'cluster') =>
    silenceMatchers(nodeAgentAlert, scope).map(matcher => `${matcher.name}=${matcher.value}`);
  expect(names('pod')).toEqual([
    'alertname=KubescapeRuleViolated',
    'rule_name=DNS Anomalies in container',
    'rule_id=R0005',
    'namespace=certificates',
    'pod_name=cert-watch-b576bb668-5f2s6',
  ]);
  expect(names('namespace')).toHaveLength(4);
  expect(names('cluster')).toEqual([
    'alertname=KubescapeRuleViolated',
    'rule_name=DNS Anomalies in container',
    'rule_id=R0005',
  ]);
});

it('offers no workload for a pod whose name Kubernetes did not generate', () => {
  const bare = { ...nodeAgentAlert, labels: { ...nodeAgentAlert.labels, pod_name: 'debug-shell' } };
  expect(silenceScopes(bare)).toEqual(['pod', 'namespace', 'cluster']);
});

it('matches all labels of alerts without the usual labels', () => {
  const other = { ...alert, labels: { alertname: 'KubescapeRuleViolated', id: '7' } };
  expect(silenceScopes(other)).toEqual(['pod']);
  expect(silenceMatchers(other, 'pod').map(matcher => matcher.name)).toEqual(['alertname', 'id']);
});

it('creates a silence in the cluster of the alert, recording the user and the reason', async () => {
  mocks.alertmanagerUrl = proxy;
  mocks.post.mockResolvedValue({ silenceID: 'silence-1' });

  const id = await silenceAlert(
    alert,
    { scope: 'workload', hours: 24, comment: ' Known behaviour of the build ' },
    'jane@example.com',
    new Date('2026-10-30T12:00:00Z')
  );

  expect(id).toBe('silence-1');
  const [url, silence, , options] = mocks.post.mock.calls[0];
  expect(url).toBe(`${proxy}/api/v2/silences`);
  expect(options).toEqual({ cluster: 'cluster-b' });
  expect(silence).toMatchObject({
    startsAt: '2026-10-30T12:00:00.000Z',
    endsAt: '2026-10-31T12:00:00.000Z',
    createdBy: 'jane@example.com',
    comment: 'Known behaviour of the build',
  });
});

it('does not silence without an Alertmanager address', async () => {
  await expect(
    silenceAlert(alert, { scope: 'pod', hours: 1, comment: 'test' }, 'jane')
  ).rejects.toThrow('not configured');
  expect(mocks.post).not.toHaveBeenCalled();
});

it('lists the silences that have not ended, soonest to end first', async () => {
  mocks.alertmanagerUrl = proxy;
  mocks.request.mockResolvedValue([
    { id: 'later', status: { state: 'active' }, endsAt: '2026-10-31T12:00:00Z' },
    { id: 'ended', status: { state: 'expired' }, endsAt: '2026-10-29T12:00:00Z' },
    { id: 'sooner', status: { state: 'active' }, endsAt: '2026-10-30T13:00:00Z' },
  ]);

  const silences = await fetchKubescapeSilences('cluster-b');

  expect(silences.map(silence => [silence.id, silence.cluster])).toEqual([
    ['sooner', 'cluster-b'],
    ['later', 'cluster-b'],
  ]);
  expect(decodeURIComponent(mocks.request.mock.calls[0][0])).toBe(
    `${proxy}/api/v2/silences?filter=alertname="KubescapeRuleViolated"`
  );
});

it('ends a silence in its cluster', async () => {
  mocks.alertmanagerUrl = proxy;
  await expireSilence({ id: 'silence-1', cluster: 'cluster-b' } as any);
  expect(mocks.remove).toHaveBeenCalledWith(`${proxy}/api/v2/silence/silence-1`, {
    cluster: 'cluster-b',
  });
});

it('asks for permission to proxy to the Alertmanager service', () => {
  expect(alertmanagerProxyCheck()).toBeNull();
  mocks.address = 'monitoring/alertmanager:9093';
  expect(alertmanagerProxyCheck('delete')).toEqual({
    group: '',
    resource: 'services',
    subresource: 'proxy',
    verb: 'delete',
    namespace: 'monitoring',
  });
});
