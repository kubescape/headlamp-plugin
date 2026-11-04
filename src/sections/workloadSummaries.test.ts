import { vi } from 'vitest';
import {
  cachedWorkloadSummaries,
  clearWorkloadSummaries,
  findWorkloadSummary,
  loadWorkloadSummaries,
  scannedWorkloadCandidates,
  summarizeWorkloads,
} from './workloadSummaries';

const mocks = vi.hoisted(() => ({ paginatedListQuery: vi.fn() }));
vi.mock('../query', () => ({ paginatedListQuery: mocks.paginatedListQuery }));
vi.mock('../model', () => ({
  vulnerabilityManifestSummaryClass: { pluralName: 'vulnerabilitymanifestsummaries' },
  workloadConfigurationScanSummaryClass: { pluralName: 'workloadconfigurationscansummaries' },
}));

function labels(kind: string, name: string, container?: string) {
  return {
    'kubescape.io/workload-kind': kind,
    'kubescape.io/workload-name': name,
    'kubescape.io/workload-namespace': 'shop',
    ...(container ? { 'kubescape.io/workload-container-name': container } : {}),
  };
}

function vulnerabilitySummary(container: string, critical: number, high: number) {
  return {
    metadata: {
      name: `deployment-web-${container}`,
      namespace: 'shop',
      labels: labels('Deployment', 'web', container),
    },
    spec: {
      severities: {
        critical: { all: critical },
        high: { all: high },
        medium: { all: 1 },
        low: { all: 0 },
      },
    },
  };
}

const configurationSummary = {
  metadata: { name: 'deployment-web', namespace: 'shop', labels: labels('Deployment', 'web') },
  spec: { severities: { critical: 0, high: 3, medium: 5, low: 2 } },
};

beforeEach(() => {
  mocks.paginatedListQuery.mockReset();
  clearWorkloadSummaries();
});

it('totals the CVEs of the containers of a workload', () => {
  const summaries = summarizeWorkloads(
    [vulnerabilitySummary('web', 2, 10), vulnerabilitySummary('sidecar', 1, 4)],
    [configurationSummary]
  );

  const web = summaries.vulnerabilities.get('shop/deployment/web')!;
  expect([web.critical, web.high, web.medium]).toEqual([3, 14, 2]);
  expect(web.containers.map(container => container.container)).toEqual(['web', 'sidecar']);
  expect(summaries.controls.get('shop/deployment/web')).toEqual({
    name: 'deployment-web',
    critical: 0,
    high: 3,
    medium: 5,
    low: 2,
  });
});

it('skips summaries without workload labels', () => {
  const summaries = summarizeWorkloads([{ metadata: { name: 'x', namespace: 'shop' } }], []);
  expect(summaries.vulnerabilities.size).toBe(0);
});

it('guesses the workload that runs a pod from its controller', () => {
  const pod = (controller?: { kind: string; name: string }, hash?: string) => ({
    kind: 'Pod',
    metadata: {
      name: 'web-6d4cf56db6-abcde',
      labels: (hash ? { 'pod-template-hash': hash } : {}) as Record<string, string>,
      ownerReferences: controller ? [{ ...controller, controller: true }] : [],
    },
  });

  expect(
    scannedWorkloadCandidates(pod({ kind: 'ReplicaSet', name: 'web-6d4cf56db6' }, '6d4cf56db6'))
  ).toEqual([
    { kind: 'Deployment', name: 'web' },
    { kind: 'ReplicaSet', name: 'web-6d4cf56db6' },
  ]);
  expect(scannedWorkloadCandidates(pod({ kind: 'Job', name: 'backup-29123456' }))).toEqual([
    { kind: 'CronJob', name: 'backup' },
    { kind: 'Job', name: 'backup-29123456' },
  ]);
  expect(scannedWorkloadCandidates(pod({ kind: 'StatefulSet', name: 'db' }))).toEqual([
    { kind: 'StatefulSet', name: 'db' },
  ]);
  expect(scannedWorkloadCandidates(pod())).toEqual([{ kind: 'Pod', name: 'web-6d4cf56db6-abcde' }]);
  expect(scannedWorkloadCandidates({ kind: 'Deployment', metadata: { name: 'web' } })).toEqual([
    { kind: 'Deployment', name: 'web' },
  ]);
});

it('finds the summary of the first scanned candidate', () => {
  const summaries = new Map([['shop/job/once', 'job summary']]);
  expect(
    findWorkloadSummary(summaries, 'shop', [
      { kind: 'CronJob', name: 'once' },
      { kind: 'Job', name: 'once' },
    ])
  ).toBe('job summary');
});

it('reads the summaries of a namespace, with their spec, once in a while', async () => {
  mocks.paginatedListQuery.mockImplementation(async (_cluster, resourceClass) => ({
    items:
      resourceClass.pluralName === 'vulnerabilitymanifestsummaries'
        ? [vulnerabilitySummary('web', 1, 0)]
        : [configurationSummary],
  }));

  loadWorkloadSummaries('cluster-a', 'shop', 0);
  loadWorkloadSummaries('cluster-a', 'shop', 0);
  await vi.waitFor(() => expect(cachedWorkloadSummaries('cluster-a', 'shop')).toBeDefined());

  expect(mocks.paginatedListQuery).toHaveBeenCalledTimes(2);
  // a namespace, all its pages; paginatedListQuery asks for the full spec
  expect(
    mocks.paginatedListQuery.mock.calls.map(([cluster, , , , namespaces]) => [cluster, namespaces])
  ).toEqual([
    ['cluster-a', ['shop']],
    ['cluster-a', ['shop']],
  ]);
  expect(cachedWorkloadSummaries('cluster-a', 'shop')!.controls.size).toBe(1);
  expect(cachedWorkloadSummaries('cluster-a', 'blog')).toBeUndefined();

  // read again after five minutes
  loadWorkloadSummaries('cluster-a', 'shop', Date.now() + 1000);
  expect(mocks.paginatedListQuery).toHaveBeenCalledTimes(2);
  loadWorkloadSummaries('cluster-a', 'shop', Date.now() + 6 * 60 * 1000);
  expect(mocks.paginatedListQuery).toHaveBeenCalledTimes(4);
});

it('reads a few namespaces at a time', async () => {
  const pending: Array<() => void> = [];
  mocks.paginatedListQuery.mockImplementation(
    () => new Promise(resolve => pending.push(() => resolve({ items: [] })))
  );

  for (let index = 0; index < 10; index++) loadWorkloadSummaries('cluster-a', `ns-${index}`);
  expect(mocks.paginatedListQuery).toHaveBeenCalledTimes(4 * 2);

  pending.splice(0, 2).forEach(resolve => resolve());
  await vi.waitFor(() => expect(mocks.paginatedListQuery).toHaveBeenCalledTimes(5 * 2));

  // let the rest finish, so the next test starts with no reads running
  while (pending.length > 0) {
    pending.splice(0).forEach(resolve => resolve());
    await vi.waitFor(() => expect(cachedWorkloadSummaries('cluster-a', 'ns-0')).toBeDefined());
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  await vi.waitFor(() => expect(cachedWorkloadSummaries('cluster-a', 'ns-9')).toBeDefined());
});

it('gives a namespace without Kubescape results empty summaries', async () => {
  mocks.paginatedListQuery.mockRejectedValue(new Error('404 page not found'));

  loadWorkloadSummaries('cluster-b', 'shop');
  await vi.waitFor(() => expect(cachedWorkloadSummaries('cluster-b', 'shop')).toBeDefined());

  expect(cachedWorkloadSummaries('cluster-b', 'shop')!.vulnerabilities.size).toBe(0);
});
