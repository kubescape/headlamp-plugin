/*
  Trends of failed controls and CVEs over time, from the metrics of the Kubescape Prometheus
  exporter, read from Prometheus through the API server's service proxy.
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getPrometheusUrl, isValidAlertmanagerAddress } from '../common/config-store';

// The cluster totals of the exporter, by the key of their column in a trend row
export const trendMetrics = {
  controlsCritical: 'kubescape_controls_total_cluster_critical',
  controlsHigh: 'kubescape_controls_total_cluster_high',
  cvesCritical: 'kubescape_vulnerabilities_total_cluster_critical',
  cvesHigh: 'kubescape_vulnerabilities_total_cluster_high',
} as const;

export type TrendKey = keyof typeof trendMetrics;

export type TrendRow = { time: number } & Partial<Record<TrendKey, number>>;

interface Service {
  metadata: { name: string; namespace: string; labels?: Record<string, string> };
  spec?: { clusterIP?: string; ports?: Array<{ name?: string; port: number }> };
}

// Services of the Prometheus stack that are not the Prometheus server
const notTheServer =
  /alertmanager|operator|exporter|kube-state-metrics|grafana|pushgateway|adapter/;

function isPrometheus(service: Service) {
  const labels = service.metadata.labels ?? {};
  const name = service.metadata.name;
  return (
    !notTheServer.test(name) &&
    (name.includes('prometheus') ||
      labels['app.kubernetes.io/name'] === 'prometheus' ||
      labels.app === 'prometheus')
  );
}

/**
 * The addresses (namespace/service:port) of the Prometheus servers, the most likely first:
 * services with a cluster IP before headless ones such as prometheus-operated.
 */
export function prometheusAddresses(services: Service[]): string[] {
  return services
    .filter(isPrometheus)
    .sort(
      (a, b) =>
        Number(a.spec?.clusterIP === 'None') - Number(b.spec?.clusterIP === 'None') ||
        a.metadata.name.length - b.metadata.name.length
    )
    .map(service => {
      const ports = service.spec?.ports ?? [];
      const port =
        ports.find(p => p.port === 9090) ??
        ports.find(p => ['web', 'http-web', 'http'].includes(p.name ?? '')) ??
        ports[0];
      return port && `${service.metadata.namespace}/${service.metadata.name}:${port.port}`;
    })
    .filter((address): address is string => !!address && isValidAlertmanagerAddress(address));
}

/** Looks for Prometheus services in the cluster. */
export async function detectPrometheus(cluster?: string): Promise<string[]> {
  const list = await request('/api/v1/services', cluster ? { cluster } : {});
  return prometheusAddresses(list.items ?? []);
}

/** About 150 points over the range, at least an hour apart. */
export function trendStep(days: number) {
  return Math.max(3600, Math.round((days * 24 * 3600) / 150));
}

/**
 * Reads the trends of the last days, one row per sampled time. A row lacks the metrics that
 * had no value at that time; rows are empty when Prometheus has no Kubescape metrics.
 */
export async function fetchTrends(
  cluster: string,
  days: number,
  now: Date = new Date()
): Promise<TrendRow[]> {
  const prometheusUrl = getPrometheusUrl();
  if (!prometheusUrl) return [];

  const end = Math.floor(now.getTime() / 1000);
  const step = trendStep(days);
  const start = end - days * 24 * 3600;
  const rows = new Map<number, TrendRow>();

  await Promise.all(
    (Object.keys(trendMetrics) as TrendKey[]).map(async key => {
      const params = new URLSearchParams({
        // more than one exporter, or a restart, may report the same total
        query: `max(${trendMetrics[key]})`,
        start: String(start),
        end: String(end),
        step: String(step),
      });
      const response = await request(`${prometheusUrl}/api/v1/query_range?${params.toString()}`, {
        cluster,
      });
      for (const series of response?.data?.result ?? []) {
        for (const [time, value] of series.values ?? []) {
          const at = Number(time) * 1000;
          const row = rows.get(at) ?? { time: at };
          row[key] = Number(value);
          rows.set(at, row);
        }
      }
    })
  );

  return [...rows.values()].sort((a, b) => a.time - b.time);
}

/** The last row of each day, for the table view. */
export function dailyRows(rows: TrendRow[]): TrendRow[] {
  const days = new Map<string, TrendRow>();
  for (const row of rows) days.set(new Date(row.time).toDateString(), row);
  return [...days.values()];
}
