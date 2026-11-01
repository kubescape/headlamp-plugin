import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { clearClusterSetups } from '../common/kubescapeSetup';
import ComplianceView, { configurationScanContext } from './Compliance';

// Values returned by hooks are created once, so that the effects depending on them only run once
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  config: { framework: '', activeFrameworks: [], pageSize: 1, alertmanagerUrl: undefined },
  regoData: {
    controls: [],
    frameworks: [],
    fullRegolibraryFramework: { name: 'Full Regolibrary', controls: [] },
    loading: false,
  },
  clusters: ['cluster-a'],
}));
// The setup check has its own tests
vi.mock('../common/SetupCheck', () => ({ SetupCheck: () => null }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../common/clusterContext', () => ({
  getAllowedNamespaces: () => [],
  isAllowedNamespaceUpdated: () => false,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: () => null,
  SectionBox: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Table: () => null,
  Tabs: () => null,
}));
vi.mock('../index', () => ({ RoutingName: {}, useHLSelectedClusters: () => mocks.clusters }));
vi.mock('../common/config-store', () => ({
  kubescapeConfigStore: { useConfig: () => () => mocks.config },
}));
vi.mock('../rego', () => ({ useRegoData: () => mocks.regoData }));
vi.mock('../model', () => ({
  customObjectLabel: 'kubescape.io/custom-object',
  workloadConfigurationScanSummaryClass: {
    apiEndpoint: {
      apiInfo: [{ group: 'spdx.softwarecomposition.kubescape.io', version: 'v1beta1' }],
    },
    pluralName: 'workloadconfigurationscansummaries',
  },
}));
vi.mock('./ClusterView', () => ({ default: () => null }));
vi.mock('./FrameworkButtons', () => ({ FrameworkButtons: () => null }));
vi.mock('./NamespaceView', () => ({ default: () => null }));
vi.mock('./ResourceList', () => ({ default: () => null }));
vi.mock('../exceptions/GuidedClusterComplianceExceptionForm', () => ({
  GuidedClusterComplianceExceptionForm: () => null,
}));

function scan(namespace: string, name: string) {
  return {
    metadata: {
      name: `deployment-${name}`,
      namespace,
      labels: {
        'kubescape.io/workload-kind': 'Deployment',
        'kubescape.io/workload-name': name,
        'kubescape.io/workload-namespace': namespace,
      },
    },
    spec: {
      controls: {
        'C-0001': {
          controlID: 'C-0001',
          severity: { scoreFactor: 7, severity: 'High' },
          status: { status: 'failed' },
        },
      },
      severities: {},
    },
  };
}

afterEach(cleanup);
// each test installs Kubescape with other capabilities
beforeEach(clearClusterSetups);

it('shows and applies exceptions to the scans read with "More scans"', async () => {
  let resolveFirstPage: (page: unknown) => void = () => {};
  mocks.request.mockImplementation(async (url: string) => {
    if (url.includes('/workloadconfigurationscansummaries?')) {
      if (url.includes('continue=page-2')) {
        return { items: [scan('billing', 'api')], metadata: {} };
      }
      return new Promise(resolve => (resolveFirstPage = resolve));
    }
    if (url === '/apis/kubescape.io/v1beta1/securityexceptions') {
      const resourceLevelException = {
        kind: 'SecurityException',
        metadata: { name: 'exempt-billing', namespace: 'billing' },
        spec: {},
      };
      return { items: [resourceLevelException] };
    }
    return { items: [] };
  });

  render(<ComplianceView />);

  // Cancel reading while the first page is loading, which leaves the second page unread
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }, { timeout: 2000 }));
  await act(async () => {
    resolveFirstPage({ items: [scan('shop', 'web')], metadata: { continue: 'page-2' } });
  });
  expect(await screen.findByText(/1 total checks, .* excluding 0 resources/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'More scans' }));

  expect(await screen.findByText(/2 total checks, .* excluding 1 resources/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'More scans' })).toBeNull();
});

it('uses the exceptions that the scanner applied when risk acceptance is enabled', async () => {
  configurationScanContext.queryTasks = [];
  configurationScanContext.workloadScans = [];
  const excepted = scan('billing', 'api');
  excepted.spec.controls['C-0001'].status = { status: 'passed', subStatus: 'w/exceptions' } as any;
  mocks.request.mockReset().mockImplementation(async (url: string) => {
    if (url.includes('/workloadconfigurationscansummaries?')) {
      return { items: [scan('shop', 'web'), excepted], metadata: {} };
    }
    if (url === '/apis/spdx.softwarecomposition.kubescape.io/v1beta1') {
      return { resources: [{ name: 'workloadconfigurationscansummaries' }] };
    }
    if (url.startsWith('api/v1/pods?')) {
      return { items: [{ metadata: { namespace: 'kubescape' } }] };
    }
    if (url === '/api/v1/namespaces/kubescape/configmaps/ks-capabilities') {
      return {
        data: { capabilities: JSON.stringify({ capabilities: { riskAcceptance: 'enable' } }) },
      };
    }
    return { items: [] };
  });

  render(<ComplianceView />);

  expect(await screen.findByText(/2 total checks, .* excluding 1 resources/)).toBeTruthy();
  expect(mocks.request.mock.calls.map(([url]) => url)).not.toContain(
    '/apis/kubescape.io/v1beta1/securityexceptions'
  );
});
