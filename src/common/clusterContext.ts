import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { QueryTask } from '../query';

export function isAllowedNamespaceUpdated(queryTask: QueryTask) {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((element, index) => element === b[index]);

  return !arraysEqual(queryTask.allowedNamespaces, getAllowedNamespaces(queryTask.cluster));
}
