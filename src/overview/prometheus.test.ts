import { vi } from 'vitest';
import { dailyRows, fetchTrends, prometheusAddresses, trendStep } from './prometheus';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  prometheusUrl: undefined as string | undefined,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../common/config-store', () => ({
  getPrometheusUrl: () => mocks.prometheusUrl,
  isValidAlertmanagerAddress: (address: string) => /^[a-z0-9-]+\/[a-z0-9-]+:[0-9]+$/.test(address),
}));

const proxy = '/api/v1/namespaces/monitoring/services/prometheus:9090/proxy';

function service(
  name: string,
  ports: Array<{ name?: string; port: number }>,
  clusterIP = '10.0.0.1'
) {
  return { metadata: { name, namespace: 'monitoring' }, spec: { clusterIP, ports } };
}

beforeEach(() => {
  mocks.request.mockReset();
  mocks.prometheusUrl = proxy;
});

it('finds the Prometheus servers, not the rest of the stack', () => {
  expect(
    prometheusAddresses([
      service('prometheus-operated', [{ name: 'web', port: 9090 }], 'None'),
      service('kube-prometheus-stack-prometheus', [
        { name: 'http-web', port: 9090 },
        { name: 'reloader-web', port: 8080 },
      ]),
      service('kube-prometheus-stack-alertmanager', [{ port: 9093 }]),
      service('kube-prometheus-stack-operator', [{ port: 443 }]),
      service('prometheus-node-exporter', [{ port: 9100 }]),
      service('kube-prometheus-stack-grafana', [{ port: 80 }]),
    ])
  ).toEqual([
    'monitoring/kube-prometheus-stack-prometheus:9090',
    'monitoring/prometheus-operated:9090',
  ]);
});

it('samples about 150 points, at most one an hour', () => {
  expect(trendStep(7)).toBe(4032);
  expect(trendStep(1)).toBe(3600);
});

it('reads the cluster totals into one row per time', async () => {
  mocks.request.mockImplementation(async (url: string) => {
    const query = new URLSearchParams(url.split('?')[1]).get('query')!;
    if (query.includes('controls_total_cluster_critical')) {
      return {
        data: {
          result: [
            {
              values: [
                [1000, '3'],
                [2000, '2'],
              ],
            },
          ],
        },
      };
    }
    if (query.includes('vulnerabilities_total_cluster_high')) {
      return { data: { result: [{ values: [[2000, '40']] }] } };
    }
    return { data: { result: [] } };
  });

  const rows = await fetchTrends('cluster-a', 30, new Date(30 * 24 * 3600 * 1000));

  expect(rows).toEqual([
    { time: 1000 * 1000, controlsCritical: 3 },
    { time: 2000 * 1000, controlsCritical: 2, cvesHigh: 40 },
  ]);
  const [url, options] = mocks.request.mock.calls[0];
  const params = new URLSearchParams(url.split('?')[1]);
  expect(url.startsWith(`${proxy}/api/v1/query_range?`)).toBe(true);
  expect(params.get('query')).toBe('max(kubescape_controls_total_cluster_critical)');
  expect([params.get('start'), params.get('end'), params.get('step')]).toEqual([
    '0',
    String(30 * 24 * 3600),
    String(trendStep(30)),
  ]);
  expect(options).toEqual({ cluster: 'cluster-a' });
});

it('reads nothing without a Prometheus address', async () => {
  mocks.prometheusUrl = undefined;
  expect(await fetchTrends('cluster-a', 7)).toEqual([]);
  expect(mocks.request).not.toHaveBeenCalled();
});

it('keeps the last sample of each day for the table', () => {
  const day = (date: string) => new Date(date).getTime();
  expect(
    dailyRows([
      { time: day('2026-10-28T08:00:00'), cvesHigh: 1 },
      { time: day('2026-10-28T20:00:00'), cvesHigh: 2 },
      { time: day('2026-10-29T08:00:00'), cvesHigh: 3 },
    ]).map(row => row.cvesHigh)
  ).toEqual([2, 3]);
});
