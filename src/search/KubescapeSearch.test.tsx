import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { forwardRef, ReactNode } from 'react';
import { vi } from 'vitest';
import { KubescapeSearchButton, KubescapeSearchDialog } from './KubescapeSearch';

const mocks = vi.hoisted(() => ({
  clusters: ['cluster-a'] as string[],
  readVulnerabilityScans: vi.fn(),
  fetchRegoData: vi.fn(),
}));

vi.mock('../index', () => ({
  RoutingName: {
    KubescapeCVEResults: 'cve',
    ImageVulnerabilityDetails: 'image',
    KubescapeVulnerabilityDetails: 'workload',
    KubescapeControlResults: 'control',
  },
  useHLSelectedClusters: () => mocks.clusters,
}));
vi.mock('../common/config-store', () => ({
  kubescapeConfigStore: { get: () => ({ pageSize: 50 }) },
}));
vi.mock('../vulnerabilities/Vulnerabilities', () => ({
  readVulnerabilityScans: mocks.readVulnerabilityScans,
}));
vi.mock('../rego/RegoDataProvider', () => ({ fetchRegoData: mocks.fetchRegoData }));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: forwardRef(
    (
      { routeName, params, activeCluster, children, ...rest }: any,
      ref: React.Ref<HTMLAnchorElement>
    ) => (
      // like Headlamp's link, the address it builds wins over an href of the caller
      <a
        ref={ref}
        {...rest}
        href={`/${activeCluster ?? 'current'}/${routeName}/${Object.values(params).join('/')}`}
      >
        {children as ReactNode}
      </a>
    )
  ),
}));

const nginx = {
  manifestName: 'docker.io-library-nginx-1.31.3-0c1752',
  namespace: 'kubescape',
  cluster: 'cluster-a',
  imageName: 'docker.io/library/nginx:1.31.3',
  creationTimestamp: '2026-11-01T00:00:00Z',
  matches: [
    {
      vulnerability: { id: 'CVE-2024-3094', severity: 'Critical' },
      artifact: { name: 'xz-utils', version: '5.6.0' },
    },
  ],
};
const scans = [
  {
    manifestName: 'deployment-web-nginx',
    name: 'web',
    kind: 'Deployment',
    container: 'nginx',
    namespace: 'web',
    cluster: 'cluster-a',
    imageScan: nginx,
  },
];

beforeEach(() => {
  mocks.clusters = ['cluster-a'];
  mocks.readVulnerabilityScans.mockReset();
  mocks.fetchRegoData.mockReset();
  mocks.fetchRegoData.mockResolvedValue({
    controls: [
      {
        controlID: 'C-0017',
        name: 'Immutable container filesystem',
        description: 'Mutable container filesystem can be abused.',
      },
    ],
  });
});
afterEach(cleanup);

function type(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Search Kubescape' }), {
    target: { value: text },
  });
}

it('opens from the top bar with the search field focused', async () => {
  mocks.readVulnerabilityScans.mockResolvedValue(scans);
  render(<KubescapeSearchButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Search Kubescape' }));
  expect(await screen.findByRole('dialog', { name: 'Search Kubescape' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search Kubescape' }));
});

it('searches the controls while the vulnerability reports are read, then the CVEs', async () => {
  let finish: (value: unknown) => void = () => {};
  mocks.readVulnerabilityScans.mockImplementation(
    (_clusters, _config, _continueReading, setLoading, setProgress) => {
      setLoading(true);
      setProgress('cluster-a: Reading 120 Images...');
      return new Promise(resolve => {
        finish = value => {
          setLoading(false);
          resolve(value);
        };
      });
    }
  );
  const onClose = vi.fn();
  render(<KubescapeSearchDialog onClose={onClose} />);
  expect(mocks.readVulnerabilityScans.mock.calls[0][0]).toEqual(['cluster-a']);
  expect(await screen.findByText(/cluster-a: Reading 120 Images/)).toBeTruthy();

  type('C-0017');
  const control = await screen.findByText('C-0017 Immutable container filesystem');
  expect(control.closest('a')?.getAttribute('href')).toBe('/current/control/C-0017');

  type('cve-2024');
  expect(screen.getByText(/Nothing found for “cve-2024” yet/)).toBeTruthy();
  await act(async () => finish(scans));

  const cve = screen.getByText('CVE-2024-3094');
  expect(cve.closest('a')?.getAttribute('href')).toBe('/current/cve/CVE-2024-3094');
  expect(screen.getByText('xz-utils · 1 image · 1 workload')).toBeTruthy();
  expect(screen.getByText('Critical')).toBeTruthy();

  // Enter opens the first result and closes the search
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search Kubescape' }), { key: 'Enter' });
  expect(onClose).toHaveBeenCalled();
});

it('links images and workloads to their pages in their cluster', async () => {
  mocks.readVulnerabilityScans.mockResolvedValue(scans);
  render(<KubescapeSearchDialog onClose={() => {}} />);
  type('nginx');
  const images = await screen.findByText('Images (1)');
  const list = images.closest('ul')!;
  expect(
    within(list).getByText('docker.io/library/nginx:1.31.3').closest('a')?.getAttribute('href')
  ).toBe('/cluster-a/image/kubescape/docker.io-library-nginx-1.31.3-0c1752');
  expect(within(list).getByText('web / nginx').closest('a')?.getAttribute('href')).toBe(
    '/cluster-a/workload/web/deployment-web-nginx'
  );
});

it('asks for a cluster outside of one', () => {
  mocks.clusters = [];
  render(<KubescapeSearchDialog onClose={() => {}} />);
  expect(screen.getByText('Open a cluster to search its Kubescape data.')).toBeTruthy();
  expect(mocks.readVulnerabilityScans).not.toHaveBeenCalled();
});
