import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ApplicationProfileDetail } from './ApplicationProfileDetail';

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
vi.mock('../index', () => ({ RoutingName: { ApplicationProfiles: 'Application Profile' } }));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Router: { createRouteURL: (route: string) => `/${route}` },
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
  // like Headlamp's tabs, every tab is mounted
  Tabs: ({ tabs, onTabChanged }: any) => (
    <div>
      {tabs.map((tab: any, index: number) => (
        <button key={tab.label} role="tab" onClick={() => onTabChanged?.(index)}>
          {tab.label}
        </button>
      ))}
      {tabs.map((tab: any) => (
        <section key={tab.label} aria-label={tab.label}>
          {tab.component}
        </section>
      ))}
    </div>
  ),
}));
vi.mock('../networkpolicies/Diagram', () => ({
  WorkloadNetworkGraph: ({ kind, name, namespace }: any) => (
    <div data-testid="network-graph">{`${kind} ${namespace}/${name}`}</div>
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

beforeEach(() => {
  mocks.discoverProfileResource.mockReset();
  mocks.discoverProfileResource.mockResolvedValue({ plural: 'containerprofiles', modern: true });
  mocks.containerProfileGet.mockReset();
  mocks.applicationProfileGet.mockReset();
  mocks.networkNeighborhoodGet.mockReset();
});
afterEach(cleanup);

function tabYaml(label: string) {
  return (
    within(screen.getByRole('region', { name: label })).getByTestId('profile-yaml').textContent ??
    ''
  );
}

async function renderProfile(profile: typeof learnedProfile | typeof authoredProfile) {
  render(<ApplicationProfileDetail />);
  await waitFor(() => expect(mocks.discoverProfileResource).toHaveBeenCalledWith('behavior'));
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
}

it('shows the behaviour of a learned ContainerProfile without its network peers', async () => {
  await renderProfile(learnedProfile);

  expect(screen.getByRole('heading', { name: 'Application Profile' })).toBeTruthy();
  expect(screen.getByText('web-app')).toBeTruthy();
  const yaml = tabYaml('Behaviour');
  expect(yaml).toContain('/bin/learned-web');
  expect(yaml).toContain('/etc/learned.conf');
  expect(yaml).toContain('amd64');
  expect(yaml).toContain('learned-seccomp');
  expect(yaml).toContain('learned-call');
  expect(yaml).not.toContain('client.example.test');
  expect(yaml).not.toContain('server.example.test');
});

it('includes authored container and init container behavior without network fields', async () => {
  await renderProfile(authoredProfile);

  const yaml = tabYaml('Behaviour');
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

it('shows the network peers of a learned ContainerProfile on a tab of their own', async () => {
  await renderProfile(learnedProfile);

  const yaml = tabYaml('Network');
  expect(yaml).toContain('client.example.test');
  expect(yaml).toContain('server.example.test');
  expect(yaml).not.toContain('/bin/learned-web');
  expect(yaml).not.toContain('/etc/learned.conf');
  expect(yaml).not.toContain('learned-seccomp');
  expect(yaml).not.toContain('learned-call');
  expect(tabYaml('Full YAML')).toContain('kind: ContainerProfile');
});

it('includes authored container and init container network peers without behavior fields', async () => {
  await renderProfile(authoredProfile);

  const yaml = tabYaml('Network');
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

it('draws the network graph of the workload only when its tab is open', async () => {
  await renderProfile(learnedProfile);

  // a graph laid out on a hidden tab would have no size
  expect(screen.queryByTestId('network-graph')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Network graph' }));
  expect(screen.getByTestId('network-graph').textContent).toBe('Deployment workloads/web-app');
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
  const yaml = tabYaml('Behaviour');
  expect(yaml).toContain('kind: ApplicationProfile');
  expect(yaml).toContain('/bin/legacy-web');
  expect(yaml).toContain('/etc/legacy.conf');
  // an ApplicationProfile has no network peers, but the workload still has a graph
  expect(screen.queryByRole('tab', { name: 'Network' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Network graph' })).toBeTruthy();
});

it('shows a discovery failure instead of guessing a detail API', async () => {
  mocks.discoverProfileResource.mockRejectedValue(new Error('Discovery forbidden'));

  render(<ApplicationProfileDetail />);

  expect((await screen.findByRole('alert')).textContent).toContain('Discovery forbidden');
  expect(mocks.containerProfileGet).not.toHaveBeenCalled();
  expect(mocks.applicationProfileGet).not.toHaveBeenCalled();
  expect(screen.queryByTestId('profile-yaml')).toBeNull();
});
