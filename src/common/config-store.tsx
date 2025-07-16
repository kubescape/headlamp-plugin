// @ts-ignore
import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

export const PLUGIN_NAME = 'kubescape-plugin';

export type KubescapeConfig = {
  framework: string;
  exceptionGroupName: string;
  activeFrameworks: string[];
  pageSize: number;
};

export const kubescapeConfigStore = new ConfigStore<KubescapeConfig>(PLUGIN_NAME);

// Initialize or migrate existing config
const currentConfig = kubescapeConfigStore.get();
if (!currentConfig) {
  console.log('initialize kubescape settings');
  kubescapeConfigStore.set({
    framework: '',
    exceptionGroupName: '',
    activeFrameworks: [],
    pageSize: 50,
  });
} else if (currentConfig.pageSize === undefined) {
  console.log('migrate kubescape settings to include pageSize');
  kubescapeConfigStore.set({ ...currentConfig, pageSize: 50 });
}

// Helper function to get page size from config
export function getPageSize(): number {
  const config = kubescapeConfigStore.get();
  return config?.pageSize || 50;
}
