import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';

export function isNewClusterContext(currentCluster: string, allowedNamespaces: string[]) {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((element, index) => element === b[index]);

  return (
    currentCluster !== getCluster() || // check if user switched to another cluster
    !arraysEqual(getAllowedNamespaces(), allowedNamespaces) // check if user changed namespace selection
  );
}
