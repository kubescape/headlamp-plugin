import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getAlertmanagerUrl, isValidAlertmanagerAddress } from '../common/config-store';

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
