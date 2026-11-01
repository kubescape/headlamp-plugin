import { vi } from 'vitest';
import { alertmanagerAddresses, detectAlertmanager, fetchKubescapeAlerts } from './alertmanager';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  alertmanagerUrl: undefined as string | undefined,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
}));
vi.mock('../common/config-store', () => ({
  getAlertmanagerUrl: () => mocks.alertmanagerUrl,
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

beforeEach(() => {
  mocks.request.mockReset();
  mocks.alertmanagerUrl = undefined;
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
