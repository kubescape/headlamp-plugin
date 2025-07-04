// @ts-ignore
import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

export const PLUGIN_NAME = 'kubescape-plugin';

export type KubescapeConfig = {
  framework: string;
  exceptionGroupName: string;
  activeFrameworks: string[];
};

export const kubescapeConfigStore = new ConfigStore<KubescapeConfig>(PLUGIN_NAME);

if (!kubescapeConfigStore.get()) {
  console.log('initialize kubescape settings');
  kubescapeConfigStore.set({ framework: '', exceptionGroupName: '', activeFrameworks: [] });
}
