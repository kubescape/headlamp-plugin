import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { vi } from 'vitest';
import ImageDetails from './ImageDetails';
import ImageList from './ImageList';
import ResourceList from './ResourceList';
import {
  getImageScanKey,
  invalidateScanClusters,
  toImageScan,
  toWorkloadScan,
  VulnerabilityContext,
  WorkloadScan,
} from './scanData';
import { manifest, match, summary, T0, T1, T2 } from './testFixtures';
import WorkloadDetails, { fetchVulnerabilityManifest } from './WorkloadScanDetails';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  imageGet: vi.fn(),
  cluster: 'cluster-a',
  name: 'workload-123',
}));
vi.mock('../index', () => ({
  RoutingName: {
    ImageVulnerabilityDetails: 'image',
    KubescapeSBOMDetails: 'sbom',
    KubescapeVulnerabilityDetails: 'workload',
  },
  useHLSelectedClusters: () => ['cluster-a', 'cluster-b'],
}));
vi.mock('../model', () => ({
  vulnerabilityManifestClass: { useApiGet: mocks.imageGet },
  vulnerabilityManifestSummaryClass: {},
}));
vi.mock('../common/url', () => ({ getURLSegments: () => [mocks.name, 'workloads'] }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => mocks.cluster }));
vi.mock('../exceptions/GuidedVulnerabilityExceptionForm', () => ({
  GuidedVulnerabilityExceptionForm: ({ cveId }: { cveId: string }) => (
    <div>Exception for {cveId}</div>
  ),
}));
vi.mock('../exceptions/GuidedClusterVulnerabilityExceptionForm', () => ({
  GuidedClusterVulnerabilityExceptionForm: () => null,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  DateLabel: ({ date }: { date: string }) => <time dateTime={date}>{date}</time>,
  SectionBox: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  ShowHideLabel: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tabs: () => null,
  Link: ({ children, activeCluster, routeName, params }: any) => (
    <a href={`/${activeCluster}/${routeName}/${params.namespace}/${params.name}`}>{children}</a>
  ),
  NameValueTable: ({ rows }: any) => (
    <dl>
      {rows.map((row: any) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
  Table: ({ data = [], columns }: any) => (
    <table>
      <tbody>
        {data.map((item: any, i: number) => (
          <tr key={i}>
            {columns
              .filter((col: any) => col.header !== undefined)
              .map((col: any, j: number) => {
                const value = col.accessorFn
                  ? col.accessorFn(item)
                  : col.accessorKey?.split('.').reduce((v: any, k: string) => v?.[k], item);
                return (
                  <td key={j}>
                    {col.Cell
                      ? col.Cell({
                          cell: { getValue: () => value, row: { original: item } },
                          row: { original: item },
                        })
                      : value}
                  </td>
                );
              })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

beforeEach(() => {
  mocks.request.mockReset();
  mocks.imageGet.mockReset();
  mocks.cluster = 'cluster-a';
  mocks.name = 'workload-123';
});
afterEach(cleanup);

function valueFor(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling!;
}

it('refreshes image evaluation time through the existing hook and preserves record creation', async () => {
  let receive: Dispatch<SetStateAction<any>>;
  mocks.imageGet.mockImplementation((callback: typeof receive) => {
    receive = callback;
  });
  render(<ImageDetails />);
  const first = manifest();
  await act(async () => receive({ metadata: first.metadata, jsonData: first }));
  expect(valueFor('Last evaluated').textContent).toBe(T1);
  expect(valueFor('Scan record created').textContent).toBe(T0);
  const second = manifest(T2);
  await act(async () => receive({ metadata: second.metadata, jsonData: second }));
  expect(valueFor('Last evaluated').querySelector('time')?.dateTime).toBe(T2);
  expect(valueFor('Scan record created').textContent).toBe(T0);
  expect(mocks.imageGet.mock.calls.every(call => call[4].cluster === 'cluster-a')).toBe(true);
  expect(screen.getByText('CVE-1')).toBeTruthy();
});

it('keeps legacy image findings readable beside Unknown evaluation time', async () => {
  let receive: (item: any) => void;
  mocks.imageGet.mockImplementation((callback: typeof receive) => {
    receive = callback;
  });
  render(<ImageDetails />);
  const legacy = manifest();
  delete legacy.spec.metadata;
  await act(async () => receive({ metadata: legacy.metadata, jsonData: legacy }));
  expect(valueFor('Last evaluated').textContent).toBe('Unknown');
  expect(screen.getByText('CVE-1')).toBeTruthy();
});

it.each(['all', 'relevant', 'both', 'neither'] as const)(
  'fetches independently with %s reference missing',
  async missing => {
    const s = summary();
    if (missing === 'all' || missing === 'both') s.spec.vulnerabilitiesRef.all = undefined;
    if (missing === 'relevant' || missing === 'both')
      s.spec.vulnerabilitiesRef.relevant = undefined;
    mocks.request.mockImplementation(async (url: string) =>
      url.includes('summaries/') ? s : manifest()
    );
    const [, all, relevant] = await fetchVulnerabilityManifest(
      'workload-123',
      'workloads',
      'cluster-b'
    );
    expect(Boolean(all)).toBe(missing !== 'all' && missing !== 'both');
    expect(Boolean(relevant)).toBe(missing !== 'relevant' && missing !== 'both');
    expect(mocks.request).toHaveBeenCalledTimes(
      1 + Number(Boolean(all)) + Number(Boolean(relevant))
    );
    for (const [url, options] of mocks.request.mock.calls) {
      expect(options).toEqual({ cluster: 'cluster-b' });
      if (url.includes('/vulnerabilitymanifests/'))
        expect(url).not.toContain('/namespaces/workloads/');
    }
  }
);

it.each(['all', 'relevant'] as const)(
  'renders the available date when the %s reference is absent',
  async missing => {
    const s = summary();
    s.spec.vulnerabilitiesRef[missing] = undefined;
    mocks.request.mockImplementation(async (url: string) =>
      url.includes('summaries/') ? s : manifest(T2)
    );
    render(<WorkloadDetails />);
    await waitFor(() =>
      expect(
        valueFor(missing === 'all' ? 'Relevant findings last evaluated' : 'Image last evaluated')
          .textContent
      ).toBe(T2)
    );
    expect(
      valueFor(missing === 'all' ? 'Image last evaluated' : 'Relevant findings last evaluated')
        .textContent
    ).toBe('Unknown');
  }
);

it('isolates failed reports and uses kubescape only for legacy references without namespaces', async () => {
  const s = summary();
  Reflect.deleteProperty(s.spec.vulnerabilitiesRef.all!, 'namespace');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.request.mockImplementation(async (url: string) => {
    if (url.includes('summaries/')) return s;
    if (url.endsWith('/image-123')) throw new Error('not found');
    return manifest(T2);
  });
  const [, all, relevant] = await fetchVulnerabilityManifest(
    'workload-123',
    'workloads',
    'cluster-a'
  );
  expect(all).toBeNull();
  expect(relevant?.spec.metadata?.report?.createdAt).toBe(T2);
  expect(mocks.request.mock.calls[1][0]).toContain('/namespaces/kubescape/');
  expect(mocks.request.mock.calls[2][0]).toContain('/namespaces/relevant-reports/');
  error.mockRestore();
});

it('shows independent workload dates and preserves relevancy filtering and exception controls', async () => {
  const all = manifest();
  all.spec.payload.matches.push(match('CVE-2'));
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? all : manifest(T2)
  );
  render(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Image last evaluated').textContent).toBe(T1));
  expect(valueFor('Relevant findings last evaluated').textContent).toBe(T2);
  expect(valueFor('Scan record created').textContent).toBe(T0);
  expect(screen.queryByText('CVE-2')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('CVE-2')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button')[0]);
  expect(screen.getByText('Exception for CVE-1')).toBeTruthy();
});

it('updates a mounted workload view on a new fetch and drops previous-cluster results', async () => {
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : manifest(mocks.cluster === 'cluster-a' ? T1 : T2)
  );
  const view = render(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Image last evaluated').textContent).toBe(T1));
  mocks.cluster = 'cluster-b';
  view.rerender(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Image last evaluated').textContent).toBe(T2));
  expect(valueFor('Scan record created').textContent).toBe(T0);
  expect(mocks.request.mock.calls.slice(3).every(call => call[1].cluster === 'cluster-b')).toBe(
    true
  );
});

it('keeps colliding image records separate and associates only their own workloads and links', () => {
  const a = toImageScan(manifest());
  a.imageName = 'image-a';
  const b = { ...a, cluster: 'cluster-b', imageName: 'image-b', reportCreatedAt: T2 };
  const c = { ...a, namespace: 'other-reports', imageName: 'image-c' };
  const workloads = [a, b, c].map(
    (imageScan, i) => ({ imageScan, name: `workload-${i}`, container: 'app' } as WorkloadScan)
  );
  render(<ImageList workloadScans={workloads} />);
  expect(screen.getByText('3 image scans')).toBeTruthy();
  for (const [i, image] of [a, b, c].entries()) {
    const row = screen.getByText(image.imageName).closest('tr')!;
    expect(row.textContent).toContain(`workload-${i}/app`);
    expect(row.textContent).not.toContain(`workload-${(i + 1) % 3}/app`);
    expect(within(row).getByText(image.imageName).getAttribute('href')).toBe(
      `/${image.cluster}/image/${image.namespace}/${image.manifestName}`
    );
  }
});

it('resolves full manifests by cluster and reference namespace', () => {
  const images = new Map();
  const workloads = [];
  for (const cluster of ['cluster-a', 'cluster-b']) {
    const report = manifest(cluster === 'cluster-a' ? T1 : T2);
    report.metadata.cluster = cluster;
    const other = manifest();
    other.metadata = { ...report.metadata, namespace: 'elsewhere' };
    for (const item of [report, other]) {
      const scan = toImageScan(item);
      images.set(getImageScanKey(scan), scan);
    }
    const s = summary();
    s.metadata.cluster = cluster;
    s.spec.vulnerabilitiesRef.relevant = {
      kind: 'VulnerabilityManifest',
      namespace: 'elsewhere',
      name: report.metadata.name,
    };
    workloads.push(toWorkloadScan(s, images));
  }
  expect(images.size).toBe(4);
  expect(workloads.map(w => w.imageScan?.reportCreatedAt)).toEqual([T1, T2]);
  expect(workloads.every(w => w.relevant?.namespace === 'elsewhere')).toBe(true);
});

it.each(['removed', 'namespaces changed'])('invalidates only affected clusters when %s', reason => {
  const context: VulnerabilityContext = {
    imageScans: new Map(),
    workloadScans: [],
    queryTasks: [],
  };
  for (const cluster of ['cluster-a', 'cluster-b', 'cluster-c']) {
    const report = manifest();
    report.metadata.cluster = cluster;
    const image = toImageScan(report);
    context.imageScans.set(getImageScanKey(image), image);
    context.workloadScans.push({ cluster } as WorkloadScan);
    // Each cluster has a manifest query and a summary query.
    for (let i = 0; i < 2; i++)
      context.queryTasks.push({ cluster } as VulnerabilityContext['queryTasks'][number]);
  }
  const keep = context.queryTasks.filter(task => task.cluster === 'cluster-b');
  invalidateScanClusters(
    context,
    reason === 'removed' ? ['cluster-b'] : ['cluster-a', 'cluster-b', 'cluster-c'],
    task => reason === 'namespaces changed' && task.cluster !== 'cluster-b'
  );
  expect([...context.imageScans.values()].map(image => image.cluster)).toEqual(['cluster-b']);
  expect(context.workloadScans.map(w => w.cluster)).toEqual(['cluster-b']);
  expect(context.queryTasks).toEqual(keep);
});

it('retains legacy workload findings and shows Unknown for both evaluation times', async () => {
  const legacy = manifest();
  delete legacy.spec.metadata;
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : legacy
  );
  render(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Image last evaluated').textContent).toBe('Unknown'));
  expect(valueFor('Relevant findings last evaluated').textContent).toBe('Unknown');
  expect(valueFor('Scan record created').textContent).toBe(T0);
  expect(screen.getByText('CVE-1')).toBeTruthy();
});

it('skips empty references and missing reference containers without fetching reports', async () => {
  const s = summary();
  s.spec.vulnerabilitiesRef.all!.name = '';
  s.spec.vulnerabilitiesRef.relevant!.name = '';
  mocks.request.mockResolvedValue(s);
  expect((await fetchVulnerabilityManifest('workload-123', 'workloads')).slice(1)).toEqual([
    null,
    null,
  ]);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  Reflect.deleteProperty(s.spec, 'vulnerabilitiesRef');
  mocks.request.mockClear();
  expect((await fetchVulnerabilityManifest('workload-123', 'workloads')).slice(1)).toEqual([
    null,
    null,
  ]);
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it('keeps workload navigation on the source cluster and uses the relevant SBOM namespace', () => {
  const s = summary();
  s.metadata.cluster = 'cluster-b';
  const image = toImageScan(manifest());
  image.cluster = 'cluster-b';
  const relevant = { ...image, manifestName: 'relevant-123', namespace: 'relevant-reports' };
  const images = new Map([image, relevant].map(scan => [getImageScanKey(scan), scan]));
  render(<ResourceList workloadScans={[toWorkloadScan(s, images)]} />);
  expect(screen.getByText('workload').getAttribute('href')).toBe(
    '/cluster-b/workload/workloads/workload-123'
  );
  expect(screen.getByText('SBOM').getAttribute('href')).toBe(
    '/cluster-b/sbom/relevant-reports/relevant-123'
  );
});
