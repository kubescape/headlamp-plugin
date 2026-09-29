import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export type QueryTask = {
  cluster: string;
  allowedNamespaces: string[];
  pageSize: number;
  continuation: number | undefined;
  objectClass: KubeObjectClass;
  handleData: (queryTask: QueryTask, items: any[]) => void;
};

/**
 * Handles paginated list queries for a set of query tasks. This function continues
 * fetching data for each task until the `continuation` token is undefined or
 * `continueReading` is set to false. It sets the loading state during the process.
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

    for (const task of queryTasks) {
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
  }
  setLoading(false);
}

/**
 * Queries a paginated list of objects of the given class.
 *
 * @param cluster - The name of the cluster to query.
 * @param objectClass - The class of objects to query.
 * @param continuation - An optional continuation token to fetch the next page of data.
 * @param pageSize - An optional page size to limit the number of items fetched.
 * @param allowedNamespaces - An optional list of namespaces to query.
 * @returns A promise that resolves with an object containing the list of items and the continuation token.
 */
export async function paginatedListQuery(
  cluster: string,
  objectClass: KubeObjectClass,
  continuation: number,
  pageSize: number | undefined,
  allowedNamespaces: string[] = []
): Promise<any> {
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;
  const pluralName = objectClass.pluralName;

  function queryFragmentFor(offset: number) {
    let fragment = `${pluralName}?resourceVersion=fullSpec&continue=${offset}`;
    if (pageSize !== undefined) {
      fragment += `&limit=${pageSize}`;
    }
    return fragment;
  }

  const queryFragment = queryFragmentFor(continuation);
  if (allowedNamespaces.length > 0) {
    // The apiserver pages each namespace separately, and this function returns a
    // single continuation token, which cannot express one offset per namespace.
    // So each namespace is drained here instead of reporting a token the caller
    // could not act on; returning undefined while a namespace still had pages is
    // what silently truncated the results.
    const listOfLists: any[][] = await Promise.all(
      allowedNamespaces.map(async namespace => {
        const items: any[] = [];
        let offset: number | undefined = continuation;

        while (offset !== undefined) {
          const list = await request(
            `/apis/${group}/${version}/namespaces/${namespace}/${queryFragmentFor(offset)}`
          );
          items.push(...list.items);
          offset = list.metadata?.continue || undefined;
        }

        return items;
      })
    );

    listOfLists.forEach(items => {
      items.forEach((item: any) => {
        item.metadata.cluster = cluster;
      });
    });
    return { items: listOfLists.flat(), continuation: undefined };
  } else {
    // await new Promise(resolve => setTimeout(resolve, 2000));
    const overviewList = await request(`/apis/${group}/${version}/${queryFragment}`, {
      cluster: cluster,
    });
    overviewList.items.forEach((item: any) => {
      item.metadata.cluster = cluster;
    });
    return { items: overviewList.items, continuation: overviewList.metadata.continue };
  }
}
