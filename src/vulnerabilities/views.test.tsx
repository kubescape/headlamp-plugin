import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ImageDetails from './ImageDetails';
import ImageList from './ImageList';
import ResourceList from './ResourceList';
import SBOMDetail from './SBOMDetail';
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
  sbomGet: vi.fn(),
  sbomFilteredGet: vi.fn(),
  severity: null as string | null,
  cluster: 'cluster-a',
  name: 'workload-123',
  saveToFile: vi.fn(),
}));
vi.mock('../common/filedialog', () => ({ saveToFile: mocks.saveToFile }));
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
  sbomSyftClass: { useApiGet: mocks.sbomGet },
  sbomSyftFilteredClass: { useApiGet: mocks.sbomFilteredGet },
}));
vi.mock('../common/url', () => ({
  getURLSegments: () => [mocks.name, 'workloads'],
  useURLSearchParam: (name: string) => [name === 'severity' ? mocks.severity : null, () => {}],
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => mocks.cluster }));
vi.mock('../exceptions/GuidedVulnerabilityExceptionForm', () => ({
  GuidedVulnerabilityExceptionForm: ({ cveIds, acceptRisk }: any) => (
    <div>
      {acceptRisk ? 'Accept risk of' : 'Exception for'} {cveIds.join(', ')}
    </div>
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
  Link: ({ children, activeCluster, routeName, params, search = '', ...rest }: any) => (
    <a
      {...rest}
      href={`/${activeCluster}/${routeName}/${params.namespace}/${params.name}${search}`}
    >
      {children}
    </a>
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
  // like Headlamp's table: the toolbar with the filters and export of a view, and only a
  // message without the toolbar when there are no rows
  Table: ({ data = [], columns, renderTopToolbarCustomActions, emptyMessage }: any) =>
    data.length === 0 ? (
      <div>{emptyMessage ?? 'No data to be shown.'}</div>
    ) : (
      <>
        {renderTopToolbarCustomActions?.({ table: {} })}
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
      </>
    ),
}));

beforeEach(() => {
  mocks.saveToFile.mockReset();
  mocks.request.mockReset();
  mocks.imageGet.mockReset();
  mocks.sbomGet.mockReset();
  mocks.sbomFilteredGet.mockReset();
  mocks.cluster = 'cluster-a';
  mocks.name = 'workload-123';
  mocks.severity = null;
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

it('reads a report from the operator namespace when it is not where the summary refers to', async () => {
  window.sessionStorage.clear();
  const s = summary();
  s.spec.vulnerabilitiesRef.all = {
    kind: 'vulnerabilitymanifests',
    name: 'image-123',
    namespace: 'workloads',
  };
  s.spec.vulnerabilitiesRef.relevant = undefined;
  mocks.request.mockImplementation(async (url: string) => {
    if (url.includes('summaries/')) return s;
    if (url.startsWith('api/v1/pods?'))
      return { items: [{ metadata: { namespace: 'kubescape' } }] };
    if (url.includes('/namespaces/kubescape/vulnerabilitymanifests/image-123')) return manifest(T2);
    throw Object.assign(new Error('not found'), { status: 404 });
  });

  const [, all] = await fetchVulnerabilityManifest('workload-123', 'workloads', 'cluster-a');

  expect(all?.metadata.name).toBe('image-123');
  expect(mocks.request.mock.calls.map(([url]) => url.split('?')[0])).toContain(
    '/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/workloads/vulnerabilitymanifests/image-123'
  );
});

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
  all.spec.payload.matches!.push(match('CVE-2'));
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Create Vulnerability Exception' })[0]);
  expect(screen.getByText('Exception for CVE-1')).toBeTruthy();
});

it('exports the findings that are shown as CSV', async () => {
  const all = manifest();
  all.spec.payload.matches!.push(match('CVE-2'));
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? all : manifest(T2)
  );
  render(<WorkloadDetails />);
  await waitFor(() => expect(screen.getByText('CVE-1')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  // the relevant findings, as the Relevant CVE switch is on
  const [content, fileName] = mocks.saveToFile.mock.calls[0];
  expect(fileName).toBe('kubescape-workloads-workload-cves.csv');
  expect(content.split('\r\n')).toEqual([
    'Severity,CVE,CVSS,Artifact,Version,Relevant,Fix,Fix in version,Exception,Description',
    'High,CVE-1,8,package,1.0,Yes,fixed,2.0,,test finding',
    '',
  ]);
});

// A SecurityException that accepts the risk of CVEs of the workload of the summary fixture
function acceptance(entries: { id: string; expiredOnFix?: boolean }[]) {
  return {
    kind: 'SecurityException',
    metadata: { name: 'accept-it', namespace: 'workloads' },
    spec: {
      author: 'alice',
      match: { resources: [{ kind: 'Deployment', name: 'workload' }] },
      vulnerabilities: entries.map(({ id, expiredOnFix }) => ({
        vulnerability: { id },
        status: 'affected',
        response: ['can_not_fix'],
        actionStatement: 'No fix upstream',
        expiredOnFix,
      })),
    },
  };
}

it('marks the findings that exceptions cover and lists those that kubevuln hid', async () => {
  const all = manifest();
  all.spec.payload.matches!.push(match('CVE-2'));
  all.spec.payload.ignoredMatches = [
    {
      ...match('CVE-3'),
      appliedIgnoreRules: [
        {
          vulnerability: 'CVE-3',
          'fix-state': 'not_affected',
          sourceKind: 'ClusterSecurityException',
          sourceName: 'clustersecurityexception//old',
        },
      ],
    },
  ];
  mocks.request.mockImplementation(async (url: string) => {
    if (url.endsWith('/clustersecurityexceptions') || url === '/api/v1/namespaces') {
      return { items: [] };
    }
    if (url.endsWith('/securityexceptions')) {
      // CVE-1 has a fix, which ends its exception
      return { items: [acceptance([{ id: 'CVE-1', expiredOnFix: true }, { id: 'CVE-2' }])] };
    }
    return url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? all : manifest(T2);
  });
  render(<WorkloadDetails />);
  await waitFor(() => expect(screen.getByText('CVE-1')).toBeTruthy());
  // all findings, also those that are not relevant
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByText('Accepted')).toBeTruthy());
  expect(screen.getByText('Not affected')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(mocks.saveToFile.mock.calls[0][0].split('\r\n').slice(1, 4)).toEqual([
    'High,CVE-1,8,package,1.0,Yes,fixed,2.0,,test finding',
    'High,CVE-2,8,package,1.0,No,fixed,2.0,Accepted: accept-it,test finding',
    'High,CVE-3,8,package,1.0,No,fixed,2.0,Not affected: old,test finding',
  ]);
});

it('counts the accepted CVEs of a resource and accepts the risk of the others', async () => {
  mocks.request.mockImplementation(async (url: string, options: { cluster?: string }) =>
    url.endsWith('/securityexceptions') && options.cluster === 'cluster-a'
      ? { items: [acceptance([{ id: 'CVE-2' }])] }
      : { items: [] }
  );
  const image = toImageScan(manifest());
  image.matches = [match('CVE-1'), match('CVE-2')];
  render(
    <ResourceList
      workloadScans={[toWorkloadScan(summary(), new Map([[getImageScanKey(image), image]]))]}
    />
  );
  expect(await screen.findByText('1 accepted')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Accept the risk of the open CVE' }));
  expect(screen.getByText('Accept risk of CVE-1')).toBeTruthy();
});

it('accepts the risk of the open CVEs of a workload from its page', async () => {
  const all = manifest();
  all.spec.payload.matches!.push(match('CVE-2'), match('CVE-3'));
  mocks.request.mockImplementation(async (url: string) => {
    if (url.endsWith('/clustersecurityexceptions') || url === '/api/v1/namespaces') {
      return { items: [] };
    }
    if (url.endsWith('/securityexceptions')) return { items: [acceptance([{ id: 'CVE-2' }])] };
    return url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? all : manifest(T2);
  });
  render(<WorkloadDetails />);

  fireEvent.click(
    await screen.findByRole('button', { name: 'Accept the risk of the 2 open CVEs' })
  );
  expect(screen.getByText('Accept risk of CVE-1, CVE-3')).toBeTruthy();
});

it('accepts the risk of the open CVEs of an image in the whole cluster from its page', async () => {
  let receive: (item: any) => void = () => {};
  mocks.imageGet.mockImplementation((callback: typeof receive) => {
    receive = callback;
  });
  const imageException = (name: string, match: object) => ({
    kind: 'ClusterSecurityException',
    metadata: { name },
    spec: {
      match,
      vulnerabilities: [
        {
          vulnerability: { id: 'CVE-2' },
          status: 'affected',
          response: ['will_not_fix'],
          actionStatement: 'Replaced next quarter',
        },
      ],
    },
  });
  mocks.request.mockImplementation(async (url: string) =>
    url.endsWith('/clustersecurityexceptions')
      ? {
          items: [
            imageException('example-everywhere', { images: ['example:*'] }),
            // limited to a workload, so not for the image wherever it runs
            imageException('example-in-one-workload', {
              images: ['example:latest'],
              resources: [{ kind: 'Deployment', name: 'workload' }],
            }),
          ],
        }
      : { items: [] }
  );
  render(<ImageDetails />);
  const report = manifest();
  report.spec.payload.matches = [match('CVE-1'), match('CVE-2')];
  await act(async () => receive({ metadata: report.metadata, jsonData: report }));

  expect(await screen.findByText('Accepted')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Accept the risk of the open CVE' }));
  expect(screen.getByText('Accept risk of CVE-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(mocks.saveToFile.mock.calls[0][0].split('\r\n').slice(0, 3)).toEqual([
    'Image,Severity,CVE,CVSS,Artifact,Version,Fix,Fix in version,Exception,Description',
    'example:latest,High,CVE-1,8,package,1.0,fixed,2.0,,test finding',
    'example:latest,High,CVE-2,8,package,1.0,fixed,2.0,Accepted: example-everywhere,test finding',
  ]);
});

it('shows no relevant findings when the relevant manifest has no matches', async () => {
  const relevant = manifest(T2);
  relevant.spec.payload.matches = null;
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? manifest() : relevant
  );
  render(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Relevant findings last evaluated').textContent).toBe(T2));
  expect(screen.queryByText('CVE-1')).toBeNull();
  expect(screen.getByText(/None of the 1 findings is relevant/)).toBeTruthy();
  // the switch stays, although the table without rows shows no toolbar
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('CVE-1')).toBeTruthy();
});

it.each([
  { search: '?filtered', filtered: true },
  { search: '', filtered: false },
])(
  'reads the SBOM choice from the router location, which may differ from window.location ($search)',
  ({ search, filtered }) => {
    render(
      <MemoryRouter initialEntries={[`/sbom/relevant-reports/relevant-123${search}`]}>
        <SBOMDetail />
      </MemoryRouter>
    );
    expect(window.location.search).toBe('');
    expect(mocks.sbomFilteredGet).toHaveBeenCalledTimes(filtered ? 1 : 0);
    expect(mocks.sbomGet).toHaveBeenCalledTimes(filtered ? 0 : 1);
  }
);

it('shows an SBOM without artifacts', async () => {
  let receive: (item: any) => void = () => {};
  mocks.sbomFilteredGet.mockImplementation((callback: typeof receive) => {
    receive = callback;
  });
  render(
    <MemoryRouter initialEntries={['/sbom/relevant-reports/relevant-123?filtered']}>
      <SBOMDetail />
    </MemoryRouter>
  );
  const noPackagesInUse = {
    metadata: { annotations: { 'kubescape.io/image-tag': 'example:latest' } },
    spec: {
      metadata: { report: { createdAt: T1 } },
      syft: { distro: { name: 'debian' }, artifacts: null },
    },
  };
  await act(async () => receive({ jsonData: noPackagesInUse }));
  expect(screen.getByText('Showing in use artifacts only')).toBeTruthy();
  expect(valueFor('Components').textContent).toBe('0');
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
  const scanCalls = mocks.request.mock.calls.filter(call =>
    call[0].includes('softwarecomposition')
  );
  expect(scanCalls.slice(3).every(call => call[1].cluster === 'cluster-b')).toBe(true);
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

it('shows when kubevuln scanned, where its reports have no evaluation time', async () => {
  const s = summary();
  s.metadata.annotations = { ...s.metadata.annotations, 'kubescape.io/timestamp': '1793384272' };
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? s : manifest(null)
  );
  render(<WorkloadDetails />);

  await waitFor(() =>
    expect(valueFor('Last scanned').textContent).toBe('2026-10-30T18:17:52.000Z')
  );
  expect(screen.queryByText('Image last evaluated')).toBeNull();
  expect(screen.queryByText('Relevant findings last evaluated')).toBeNull();
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
    '/cluster-b/sbom/relevant-reports/relevant-123?filtered'
  );
  expect(screen.getByLabelText('1 High findings').getAttribute('href')).toBe(
    '/cluster-b/workload/workloads/workload-123?severity=High'
  );
});

it('links image severity counts to the findings of that severity', () => {
  const image = toImageScan(manifest());
  image.matches = [match('CVE-1'), match('CVE-2')];
  image.matches[1].vulnerability.severity = 'Critical';
  const s = summary();
  render(
    <ImageList workloadScans={[toWorkloadScan(s, new Map([[getImageScanKey(image), image]]))]} />
  );
  expect(screen.getByLabelText('1 High findings').getAttribute('href')).toBe(
    '/cluster-a/image/reports/image-123?severity=High'
  );
  expect(screen.getByLabelText('0 Low findings').getAttribute('href')).toBe(
    '/cluster-a/image/reports/image-123?severity=Low'
  );
});

it('shows only findings of the linked severity, including irrelevant ones', async () => {
  const all = manifest();
  all.spec.payload.matches = [match('CVE-1'), match('CVE-2')];
  all.spec.payload.matches[1].vulnerability.severity = 'Low';
  mocks.severity = 'Low';
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : url.endsWith('/image-123') ? all : manifest(T2)
  );
  render(<WorkloadDetails />);
  // CVE-2 is not in the relevant manifest, so the Relevant CVE switch must start off
  await waitFor(() => expect(screen.getByText('CVE-2')).toBeTruthy());
  expect(screen.queryByText('CVE-1')).toBeNull();
  expect(screen.getByText('Only Low findings')).toBeTruthy();
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});

it('filters image findings by the linked severity', async () => {
  let receive: (item: any) => void = () => {};
  mocks.imageGet.mockImplementation((callback: typeof receive) => {
    receive = callback;
  });
  mocks.severity = 'Critical';
  render(<ImageDetails />);
  const report = manifest();
  report.spec.payload.matches = [match('CVE-1'), match('CVE-2')];
  report.spec.payload.matches[1].vulnerability.severity = 'Critical';
  await act(async () => receive({ metadata: report.metadata, jsonData: report }));
  expect(screen.getByText('CVE-2')).toBeTruthy();
  expect(screen.queryByText('CVE-1')).toBeNull();
});

it('offers a rescan only for workloads whose scan names the workload', async () => {
  const withWlid = summary();
  withWlid.metadata.annotations['kubescape.io/wlid'] =
    'wlid://cluster-prod/namespace-workloads/deployment-workload';
  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? withWlid : manifest()
  );
  const view = render(<WorkloadDetails />);
  expect(await screen.findByRole('button', { name: 'Rescan' })).toBeTruthy();
  view.unmount();

  mocks.request.mockImplementation(async (url: string) =>
    url.includes('summaries/') ? summary() : manifest()
  );
  render(<WorkloadDetails />);
  await waitFor(() => expect(valueFor('Image last evaluated').textContent).toBe(T1));
  expect(screen.queryByRole('button', { name: 'Rescan' })).toBeNull();
});
