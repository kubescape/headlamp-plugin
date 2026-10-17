import { vi } from 'vitest';
import { paginatedListQuery } from './query';
import { T1, T2 } from './vulnerabilities/testFixtures';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

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
      metadata: { continue: 'next-page' },
    }));
    const objectClass = {
      apiEndpoint: {
        apiInfo: [{ group: 'spdx.softwarecomposition.kubescape.io', version: 'v1beta1' }],
      },
      pluralName: 'vulnerabilitymanifests',
    } as unknown as Parameters<typeof paginatedListQuery>[1];
    for (const cluster of ['cluster-a', 'cluster-b']) {
      const result = await paginatedListQuery(cluster, objectClass, 0, 50, namespaces);
      expect(result.items).toHaveLength(namespaces.length || 1);
      for (const item of result.items) {
        expect(item.metadata.cluster).toBe(cluster);
        expect(item.spec.metadata.report.createdAt).toBe(cluster === 'cluster-a' ? T1 : T2);
      }
    }
    expect(request).toHaveBeenCalledTimes(2 * (namespaces.length || 1));
    expect(
      request.mock.calls.every(([url]) =>
        url.endsWith('?resourceVersion=fullSpec&continue=0&limit=50')
      )
    ).toBe(true);
    expect(request.mock.calls.map(([, options]) => options.cluster)).toEqual(
      ['cluster-a', 'cluster-b'].flatMap(cluster => Array(namespaces.length || 1).fill(cluster))
    );
  }
);
