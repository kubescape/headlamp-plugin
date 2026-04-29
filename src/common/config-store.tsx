// @ts-ignore
import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

export const PLUGIN_NAME = 'kubescape-plugin';

export type KubescapeConfig = {
  framework: string;
  exceptionGroupName: string;
  activeFrameworks: string[];
  pageSize: number;
  alertmanagerUrl: string;
};

export const kubescapeConfigStore = new ConfigStore<KubescapeConfig>(PLUGIN_NAME);

// Initialize or migrate existing config
const currentConfig = kubescapeConfigStore.get();
const DEFAULT_ALERTMANAGER_URL =
  '/api/v1/namespaces/observability/services/kube-prometheus-stack-alertmanager:9093/proxy';

if (!currentConfig) {
  kubescapeConfigStore.set({
    framework: '',
    exceptionGroupName: '',
    activeFrameworks: [],
    pageSize: 50,
    alertmanagerUrl: DEFAULT_ALERTMANAGER_URL,
  });
} else {
  const updates: Partial<KubescapeConfig> = {};
  if (currentConfig.pageSize === undefined) updates.pageSize = 50;
  if (currentConfig.alertmanagerUrl === undefined)
    updates.alertmanagerUrl = DEFAULT_ALERTMANAGER_URL;
  if (Object.keys(updates).length) kubescapeConfigStore.set({ ...currentConfig, ...updates });
}

export function getAlertmanagerUrl(): string {
  return kubescapeConfigStore.get()?.alertmanagerUrl ?? DEFAULT_ALERTMANAGER_URL;
}

// Helper function to get page size from config
export function getPageSize(): number {
  const config = kubescapeConfigStore.get();
  return config?.pageSize || 50;
}
