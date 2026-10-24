import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ApplicationProfileDetail } from './ApplicationProfileDetail';
import { NetworkNeighborhoodDetail } from './NetworkNeighborhoodDetail';

const mocks = vi.hoisted(() => ({
  containerProfileGet: vi.fn(),
  applicationProfileGet: vi.fn(),
  networkNeighborhoodGet: vi.fn(),
  discoverProfileResource: vi.fn(),
  name: 'deployment-web-app',
  namespace: 'workloads',
}));

vi.mock('../model', () => ({
  containerProfileClass: { useApiGet: mocks.containerProfileGet },
  applicationProfileClass: { useApiGet: mocks.applicationProfileGet },
  networkNeighborhoodsClass: { useApiGet: mocks.networkNeighborhoodGet },
}));
vi.mock('../softwarecomposition/profileApi', () => ({
  discoverProfileResource: mocks.discoverProfileResource,
}));
vi.mock('../common/url', () => ({
  getURLSegments: () => [mocks.name, mocks.namespace],
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
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
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <pre data-testid="profile-yaml">{value}</pre>,
}));

const metadata = {
  name: 'deployment-web-app',
  namespace: 'workloads',
  labels: {
    'kubescape.io/workload-name': 'web-app',
    'kubescape.io/workload-kind': 'Deployment',
  },
};

const learnedProfile = {
  apiVersion: 'spdx.softwarecomposition.kubescape.io/v1beta1',
  kind: 'ContainerProfile',
  metadata,
  spec: {
    architectures: ['amd64'],
    execs: [{ path: '/bin/learned-web', args: [] }],
    opens: [{ path: '/etc/learned.conf', flags: ['read'] }],
    seccompProfile: { name: 'learned-seccomp', spec: { defaultAction: 'SCMP_ACT_ERRNO' } },
    identifiedCallStacks: [
      { callID: 'learned-call', callStack: { root: { frame: { fileID: 'learned.so' } } } },
    ],
    ingress: [{ dns: 'client.example.test' }],
    egress: [{ dns: 'server.example.test' }],
  },
};

const authoredProfile = {
  ...learnedProfile,
  spec: {
    containers: [
      {
        name: 'web',
        execs: [{ path: '/bin/authored-web', args: [] }],
        seccompProfile: { name: 'authored-seccomp' },
        identifiedCallStacks: [{ callID: 'authored-call' }],
        egress: [{ dns: 'authored.example.test' }],
      },
    ],
    initContainers: [
      {
        name: 'setup',
        opens: [{ path: '/etc/authored.conf', flags: ['read'] }],
        ingress: [{ dns: 'init.example.test' }],
      },
    ],
    ephemeralContainers: [
      {
        name: 'debug',
        execs: [{ path: '/bin/authored-debug', args: [] }],
        egress: [{ dns: 'debug.example.test' }],
      },
    ],
  },
};

const legacyApplicationProfile = {
  kind: 'ApplicationProfile',
  metadata,
  spec: {
    containers: [{ name: 'web', execs: [{ path: '/bin/legacy-web' }] }],
    initContainers: [{ name: 'setup', opens: [{ path: '/etc/legacy.conf' }] }],
  },
};

const legacyNetworkNeighborhood = {
  kind: 'NetworkNeighborhood',
  metadata,
  spec: {
    containers: [{ name: 'web', egress: [{ dns: 'legacy.example.test' }] }],
    initContainers: [{ name: 'setup', ingress: [{ dns: 'legacy-init.example.test' }] }],
  },
};

beforeEach(() => {
  mocks.discoverProfileResource.mockReset();
  mocks.discoverProfileResource.mockResolvedValue({ plural: 'containerprofiles', modern: true });
  mocks.containerProfileGet.mockReset();
  mocks.applicationProfileGet.mockReset();
  mocks.networkNeighborhoodGet.mockReset();
});
afterEach(cleanup);

async function renderProfile(
  Component: typeof ApplicationProfileDetail,
  profile: typeof learnedProfile | typeof authoredProfile,
  view: 'behavior' | 'network'
) {
  render(<Component />);
  await waitFor(() => expect(mocks.discoverProfileResource).toHaveBeenCalledWith(view));
  await waitFor(() =>
    expect(mocks.containerProfileGet).toHaveBeenCalledWith(
      expect.any(Function),
      'deployment-web-app',
      'workloads',
      expect.any(Function)
    )
  );
  expect(mocks.applicationProfileGet).not.toHaveBeenCalled();
  expect(mocks.networkNeighborhoodGet).not.toHaveBeenCalled();
  const receive = mocks.containerProfileGet.mock.calls[0][0];
  act(() => receive({ jsonData: profile, metadata: profile.metadata }));
  return screen.getAllByTestId('profile-yaml')[0].textContent ?? '';
}

it('reads a learned ContainerProfile through the existing application profile URL and shows only behavior', async () => {
  const yaml = await renderProfile(ApplicationProfileDetail, learnedProfile, 'behavior');

  expect(screen.getByRole('heading', { name: 'Application Profile' })).toBeTruthy();
  expect(screen.getByText('web-app')).toBeTruthy();
  expect(yaml).toContain('/bin/learned-web');
  expect(yaml).toContain('/etc/learned.conf');
  expect(yaml).toContain('amd64');
  expect(yaml).toContain('learned-seccomp');
  expect(yaml).toContain('learned-call');
  expect(yaml).not.toContain('client.example.test');
  expect(yaml).not.toContain('server.example.test');
});

it('includes authored container and init container behavior without network fields', async () => {
  const yaml = await renderProfile(ApplicationProfileDetail, authoredProfile, 'behavior');

  expect(yaml).toContain('web');
  expect(yaml).toContain('/bin/authored-web');
  expect(yaml).toContain('authored-seccomp');
  expect(yaml).toContain('authored-call');
  expect(yaml).toContain('setup');
  expect(yaml).toContain('/etc/authored.conf');
  expect(yaml).toContain('debug');
  expect(yaml).toContain('/bin/authored-debug');
  expect(yaml).not.toContain('authored.example.test');
  expect(yaml).not.toContain('init.example.test');
  expect(yaml).not.toContain('debug.example.test');
});

it('reads a learned ContainerProfile through the existing network URL and shows only network peers', async () => {
  const yaml = await renderProfile(NetworkNeighborhoodDetail, learnedProfile, 'network');

  expect(screen.getByRole('heading', { name: 'Network Neighborhood' })).toBeTruthy();
  expect(screen.getByText('web-app')).toBeTruthy();
  expect(yaml).toContain('client.example.test');
  expect(yaml).toContain('server.example.test');
  expect(yaml).not.toContain('/bin/learned-web');
  expect(yaml).not.toContain('/etc/learned.conf');
  expect(yaml).not.toContain('learned-seccomp');
  expect(yaml).not.toContain('learned-call');
});

it('includes authored container and init container network peers without behavior fields', async () => {
  const yaml = await renderProfile(NetworkNeighborhoodDetail, authoredProfile, 'network');

  expect(yaml).toContain('web');
  expect(yaml).toContain('authored.example.test');
  expect(yaml).toContain('setup');
  expect(yaml).toContain('init.example.test');
  expect(yaml).toContain('debug');
  expect(yaml).toContain('debug.example.test');
  expect(yaml).not.toContain('/bin/authored-web');
  expect(yaml).not.toContain('authored-seccomp');
  expect(yaml).not.toContain('authored-call');
  expect(yaml).not.toContain('/etc/authored.conf');
  expect(yaml).not.toContain('/bin/authored-debug');
});

it('reports a failed ContainerProfile GET at an existing detail URL', async () => {
  render(<ApplicationProfileDetail />);

  await waitFor(() =>
    expect(mocks.containerProfileGet).toHaveBeenCalledWith(
      expect.any(Function),
      'deployment-web-app',
      'workloads',
      expect.any(Function)
    )
  );
  const onError = mocks.containerProfileGet.mock.calls[0][3];
  act(() => onError(new Error('ContainerProfile not found')));

  expect(screen.getByRole('alert').textContent).toContain('ContainerProfile not found');
  expect(screen.queryByTestId('profile-yaml')).toBeNull();
});

it('keeps the behavior detail usable against an older ApplicationProfile API', async () => {
  mocks.discoverProfileResource.mockResolvedValue({ plural: 'applicationprofiles', modern: false });

  render(<ApplicationProfileDetail />);

  await waitFor(() => expect(mocks.discoverProfileResource).toHaveBeenCalledWith('behavior'));
  await waitFor(() =>
    expect(mocks.applicationProfileGet).toHaveBeenCalledWith(
      expect.any(Function),
      'deployment-web-app',
      'workloads',
      expect.any(Function)
    )
  );
  expect(mocks.containerProfileGet).not.toHaveBeenCalled();
  const receive = mocks.applicationProfileGet.mock.calls[0][0];
  act(() => receive({ jsonData: legacyApplicationProfile, metadata }));

  expect(screen.getByRole('heading', { name: 'Application Profile' })).toBeTruthy();
  const yaml = screen.getAllByTestId('profile-yaml')[0].textContent ?? '';
  expect(yaml).toContain('kind: ApplicationProfile');
  expect(yaml).toContain('/bin/legacy-web');
  expect(yaml).toContain('/etc/legacy.conf');
});

it('keeps the network detail usable against an older NetworkNeighborhood API', async () => {
  mocks.discoverProfileResource.mockResolvedValue({
    plural: 'networkneighborhoods',
    modern: false,
  });

  render(<NetworkNeighborhoodDetail />);

  await waitFor(() => expect(mocks.discoverProfileResource).toHaveBeenCalledWith('network'));
  await waitFor(() =>
    expect(mocks.networkNeighborhoodGet).toHaveBeenCalledWith(
      expect.any(Function),
      'deployment-web-app',
      'workloads',
      expect.any(Function)
    )
  );
  expect(mocks.containerProfileGet).not.toHaveBeenCalled();
  const receive = mocks.networkNeighborhoodGet.mock.calls[0][0];
  act(() => receive({ jsonData: legacyNetworkNeighborhood, metadata }));

  expect(screen.getByRole('heading', { name: 'Network Neighborhood' })).toBeTruthy();
  const yaml = screen.getAllByTestId('profile-yaml')[0].textContent ?? '';
  expect(yaml).toContain('kind: NetworkNeighborhood');
  expect(yaml).toContain('legacy.example.test');
  expect(yaml).toContain('legacy-init.example.test');
});

it('shows a discovery failure instead of guessing a detail API', async () => {
  mocks.discoverProfileResource.mockRejectedValue(new Error('Discovery forbidden'));

  render(<NetworkNeighborhoodDetail />);

  expect((await screen.findByRole('alert')).textContent).toContain('Discovery forbidden');
  expect(mocks.containerProfileGet).not.toHaveBeenCalled();
  expect(mocks.networkNeighborhoodGet).not.toHaveBeenCalled();
  expect(screen.queryByTestId('profile-yaml')).toBeNull();
});
