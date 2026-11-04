import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export type QueryTask = {
  cluster: string;
  allowedNamespaces: string[];
  pageSize: number;
  // '' requests the first page, undefined means all pages have been read
  continuation: string | undefined;
  objectClass: KubeObjectClass;
  handleData: (queryTask: QueryTask, items: any[]) => void;
};

/**
 * Handles paginated list queries for a set of query tasks. This function continues
 * fetching data for each task until the `continuation` token is undefined or
 * `continueReading` is set to false. Clusters are read in parallel. The tasks of one
 * cluster are read in the given order, because a task may use the data of the tasks
 * before it (vulnerability summaries refer to manifests). It sets the loading state
 * during the process.
 *
 * @param queryTasks - An array of QueryTasks, each representing a task with details
 *                     for querying a paginated list.
 * @param continueReading - A mutable reference that controls whether to continue
 *                          reading pages of data.
 * @param setLoading - A callback function to set the loading state.
 * @returns A promise that resolves when all tasks have been processed.
 */
export async function handleListPaginationTasks(
  queryTasks: QueryTask[],
  continueReading: React.MutableRefObject<boolean>,
  setLoading: (loading: boolean) => void
): Promise<void> {
  if (queryTasks.some(task => task.continuation !== undefined)) {
    setLoading(true);

    const tasksByCluster = new Map<string, QueryTask[]>();
    for (const task of queryTasks) {
      tasksByCluster.set(task.cluster, [...(tasksByCluster.get(task.cluster) ?? []), task]);
    }

    await Promise.all(
      [...tasksByCluster.values()].map(async clusterTasks => {
        for (const task of clusterTasks) {
          while (continueReading.current && task.continuation !== undefined) {
            await paginatedListQuery(
              task.cluster,
              task.objectClass,
              task.continuation,
              task.pageSize,
              task.allowedNamespaces
            )
              .then(response => {
                task.continuation = response.continuation;
                task.handleData(task, response.items);
              })
              .catch(error => {
                console.error(`Error fetching data in cluster ${task.cluster}:`, error);
                task.continuation = undefined; // Stop further requests on error
              });
          }
        }
      })
    );
  }
  setLoading(false);
}

/**
 * Queries a paginated list of objects of the given class.
 *
 * @param cluster - The name of the cluster to query.
 * @param objectClass - The class of objects to query.
 * @param continuation - The continuation token of the page to fetch, '' for the first page.
 * @param pageSize - An optional page size to limit the number of items fetched.
 * @param allowedNamespaces - An optional list of namespaces to query.
 * @returns A promise that resolves with an object containing the list of items and the
 *          continuation token, which is undefined when there are no more pages.
 */
export async function paginatedListQuery(
  cluster: string,
  objectClass: KubeObjectClass,
  continuation: string,
  pageSize: number | undefined,
  allowedNamespaces: string[] = []
): Promise<any> {
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;
  const pluralName = objectClass.pluralName;

  let queryFragment = `${pluralName}?resourceVersion=fullSpec`;
  if (pageSize !== undefined) {
    queryFragment += `&limit=${pageSize}`;
  }
  if (allowedNamespaces.length > 0) {
    // each namespace is read to its last page, as one page of the task
    const listOfItems: any[][] = await Promise.all(
      allowedNamespaces.map(async namespace => {
        const items: any[] = [];
        let next = '';
        do {
          const fragment = next
            ? `${queryFragment}&continue=${encodeURIComponent(next)}`
            : queryFragment;
          const list = await request(
            `/apis/${group}/${version}/namespaces/${namespace}/${fragment}`,
            { cluster }
          );
          items.push(...(list.items ?? []));
          next = list.metadata?.continue || '';
        } while (next);
        return items;
      })
    );

    const items = listOfItems.flat();
    items.forEach((item: any) => {
      item.metadata.cluster = cluster;
    });
    return { items, continuation: undefined };
  } else {
    const fragment = continuation
      ? `${queryFragment}&continue=${encodeURIComponent(continuation)}`
      : queryFragment;
    const overviewList = await request(`/apis/${group}/${version}/${fragment}`, {
      cluster: cluster,
    });
    overviewList.items.forEach((item: any) => {
      item.metadata.cluster = cluster;
    });
    // The API server signals the last page with an absent or empty continue token
    return {
      items: overviewList.items,
      continuation: overviewList.metadata?.continue || undefined,
    };
  }
}
