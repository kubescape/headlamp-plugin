import { TableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useEffect, useState } from 'react';
import { useHLSelectedClusters } from '../index';
import type { ClusterError } from '../model';

/**
 * Reads items from each selected cluster, again when the selection changes. A cluster that
 * cannot be read does not stop the others; its error is returned instead.
 *
 * @param read - Reads the items of one cluster.
 * @param key - Changes when read reads something else.
 */
export function useItemsInClusters<T>(read: (cluster: string) => Promise<T[]>, key: string = '') {
  const clusters = useHLSelectedClusters();
  const [items, setItems] = useState<T[]>([]);
  const [errors, setErrors] = useState<ClusterError[]>([]);
  const [loading, setLoading] = useState(true);
  const clustersKey = clusters.join(',');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled(clusters.map(read)).then(results => {
      if (!active) return;
      setItems(results.flatMap(result => (result.status === 'fulfilled' ? result.value : [])));
      setErrors(rejectedClusters(clusters, results));
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // clustersKey covers clusters, which is a new array on every render, and key covers read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustersKey, key]);

  return { items, errors, loading, clusters };
}

/** The clusters of the results that were rejected, with the reason. */
export function rejectedClusters(
  clusters: string[],
  results: PromiseSettledResult<unknown>[]
): ClusterError[] {
  return results.flatMap((result, i) =>
    result.status === 'rejected'
      ? [{ cluster: clusters[i], message: result.reason?.message ?? String(result.reason) }]
      : []
  );
}

/** A Cluster column when more than one cluster is selected, to spread into the columns. */
export function clusterColumns<T extends Record<string, any>>(
  clusters: string[],
  clusterOf: (item: T) => string | undefined
): TableColumn<T>[] {
  return clusters.length > 1
    ? [{ header: 'Cluster', accessorFn: (item: T) => clusterOf(item), gridTemplate: 'auto' }]
    : [];
}
