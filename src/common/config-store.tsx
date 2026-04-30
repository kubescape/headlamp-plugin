// @ts-ignore
import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

export const PLUGIN_NAME = 'kubescape-plugin';

export type KubescapeConfig = {
  framework: string;
  exceptionGroupName: string;
  activeFrameworks: string[];
  pageSize: number;
  alertmanagerUrl: string | undefined;
};

export const kubescapeConfigStore = new ConfigStore<KubescapeConfig>(PLUGIN_NAME);

// Initialize or migrate existing config
const currentConfig = kubescapeConfigStore.get();

if (!currentConfig) {
  kubescapeConfigStore.set({
    framework: '',
    exceptionGroupName: '',
    activeFrameworks: [],
    pageSize: 50,
    alertmanagerUrl: undefined,
  });
} else {
  const updates: Partial<KubescapeConfig> = {};
  if (currentConfig.pageSize === undefined) updates.pageSize = 50;
  if (Object.keys(updates).length) kubescapeConfigStore.set({ ...currentConfig, ...updates });
}

export function isValidAlertmanagerAddress(address: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+:[0-9]+$/.test(address);
}

export function getAlertmanagerUrl(): string | undefined {
  const address = kubescapeConfigStore.get()?.alertmanagerUrl;
  if (!address || !isValidAlertmanagerAddress(address)) return undefined;
  const [namespace, serviceAndPort] = address.split('/');
  return `/api/v1/namespaces/${namespace}/services/${serviceAndPort}/proxy`;
}

// Helper function to get page size from config
export function getPageSize(): number {
  const config = kubescapeConfigStore.get();
  return config?.pageSize || 50;
}
