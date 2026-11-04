import { vi } from 'vitest';
import { handleListPaginationTasks, paginatedListQuery, QueryTask } from './query';
import { T1, T2 } from './vulnerabilities/testFixtures';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

const objectClass = {
  apiEndpoint: {
    apiInfo: [{ group: 'spdx.softwarecomposition.kubescape.io', version: 'v1beta1' }],
  },
  pluralName: 'vulnerabilitymanifests',
} as unknown as Parameters<typeof paginatedListQuery>[1];

it.each([{ namespaces: [] }, { namespaces: ['reports', 'relevant-reports'] }])(
  'queries the originating cluster with namespace restrictions $namespaces',
  async ({ namespaces }) => {
    request.mockReset().mockImplementation(async (_url, { cluster }) => ({
      items: [
        {
          metadata: { name: 'same-image' },
          spec: { metadata: { report: { createdAt: cluster === 'cluster-a' ? T1 : T2 } } },
        },
      ],
      // the last page of a namespace; across all namespaces, a page of many
      metadata: { continue: namespaces.length ? '' : 'next-page' },
    }));
    for (const cluster of ['cluster-a', 'cluster-b']) {
      const result = await paginatedListQuery(cluster, objectClass, '', 50, namespaces);
      expect(result.items).toHaveLength(namespaces.length || 1);
      for (const item of result.items) {
        expect(item.metadata.cluster).toBe(cluster);
        expect(item.spec.metadata.report.createdAt).toBe(cluster === 'cluster-a' ? T1 : T2);
      }
    }
    expect(request).toHaveBeenCalledTimes(2 * (namespaces.length || 1));
    expect(
      request.mock.calls.every(([url]) => url.endsWith('?resourceVersion=fullSpec&limit=50'))
    ).toBe(true);
    expect(request.mock.calls.map(([, options]) => options.cluster)).toEqual(
      ['cluster-a', 'cluster-b'].flatMap(cluster => Array(namespaces.length || 1).fill(cluster))
    );
  }
);

it('encodes the continuation token and treats an empty token as the last page', async () => {
  request.mockReset().mockResolvedValue({ items: [], metadata: { continue: '' } });

  const result = await paginatedListQuery('cluster-a', objectClass, 'a+b/c=', 50);

  expect(request.mock.calls[0][0]).toBe(
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/vulnerabilitymanifests' +
      '?resourceVersion=fullSpec&limit=50&continue=a%2Bb%2Fc%3D'
  );
  expect(result.continuation).toBeUndefined();
});

it('reads every page of each allowed namespace', async () => {
  request.mockReset().mockImplementation(async (url: string) => {
    const namespace = url.split('/')[5];
    const page = url.includes('continue=') ? 2 : 1;
    return {
      items: [{ metadata: { name: `${namespace}-${page}` } }],
      metadata: { continue: page === 1 ? `${namespace}-page-2` : '' },
    };
  });

  const result = await paginatedListQuery('cluster-a', objectClass, '', 50, ['shop', 'blog']);

  expect(result.items.map((item: any) => item.metadata.name)).toEqual([
    'shop-1',
    'shop-2',
    'blog-1',
    'blog-2',
  ]);
  expect(result.continuation).toBeUndefined();
  expect(request.mock.calls.map(([url]) => url.split('?')[1])).toContain(
    'resourceVersion=fullSpec&limit=50&continue=shop-page-2'
  );
});

it('reads clusters in parallel and the tasks of one cluster in order', async () => {
  // Pending requests by "<cluster> <resource>"
  const pending = new Map<string, () => void>();
  request.mockReset().mockImplementation(
    (url: string, { cluster }) =>
      new Promise(resolve => {
        const resource = url.split('?')[0].split('/').pop();
        pending.set(`${cluster} ${resource}`, () =>
          resolve({ items: [{ metadata: {} }], metadata: {} })
        );
      })
  );
  const summaryClass = {
    ...objectClass,
    pluralName: 'vulnerabilitymanifestsummaries',
  } as unknown as typeof objectClass;
  const handled: string[] = [];
  const task = (cluster: string, taskClass: typeof objectClass): QueryTask => ({
    cluster,
    allowedNamespaces: [],
    pageSize: 50,
    continuation: '',
    objectClass: taskClass,
    handleData: queryTask => handled.push(`${cluster} ${queryTask.objectClass.pluralName}`),
  });
  const setLoading = vi.fn();

  const done = handleListPaginationTasks(
    [
      task('cluster-a', objectClass),
      task('cluster-a', summaryClass),
      task('cluster-b', objectClass),
    ],
    { current: true },
    setLoading
  );

  // Both clusters start at once, the summaries of cluster-a wait for its manifests
  await vi.waitFor(() =>
    expect([...pending.keys()]).toEqual([
      'cluster-a vulnerabilitymanifests',
      'cluster-b vulnerabilitymanifests',
    ])
  );
  pending.get('cluster-a vulnerabilitymanifests')!();
  await vi.waitFor(() =>
    expect(pending.has('cluster-a vulnerabilitymanifestsummaries')).toBe(true)
  );
  pending.get('cluster-a vulnerabilitymanifestsummaries')!();
  pending.get('cluster-b vulnerabilitymanifests')!();
  await done;

  expect(handled.sort()).toEqual([
    'cluster-a vulnerabilitymanifests',
    'cluster-a vulnerabilitymanifestsummaries',
    'cluster-b vulnerabilitymanifests',
  ]);
  expect(setLoading.mock.calls).toEqual([[true], [false]]);
});
