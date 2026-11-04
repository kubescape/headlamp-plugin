import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { QueryTask } from '../query';

// Re-exported so that tests of components using it can mock this module, as the
// Headlamp module path only resolves in a plugin build.
export { getAllowedNamespaces };

export function isAllowedNamespaceUpdated(queryTask: QueryTask) {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((element, index) => element === b[index]);

  return !arraysEqual(queryTask.allowedNamespaces, getAllowedNamespaces(queryTask.cluster));
}
