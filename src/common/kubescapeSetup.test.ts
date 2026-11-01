import { vi } from 'vitest';
import {
  clearClusterSetups,
  parseCapabilities,
  readClusterSetup,
  scannersApplyExceptions,
  setupIssues,
} from './kubescapeSetup';

const mocks = vi.hoisted(() => ({ request: vi.fn(), getKubescapeNamespace: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../custom-objects/api-queries', () => ({
  getKubescapeNamespace: mocks.getKubescapeNamespace,
}));

const allResources = new Set([
  'workloadconfigurationscansummaries',
  'vulnerabilitymanifestsummaries',
  'generatednetworkpolicies',
  'containerprofiles',
]);
const enabled = {
  configurationScan: 'enable',
  continuousScan: 'enable',
  vulnerabilityScan: 'enable',
  relevancy: 'enable',
  networkPolicyService: 'enable',
  runtimeObservability: 'enable',
  runtimeDetection: 'enable',
  seccompProfileService: 'enable',
  riskAcceptance: 'enable',
};

beforeEach(() => {
  mocks.request.mockReset();
  mocks.getKubescapeNamespace.mockReset();
  clearClusterSetups();
});

it('reports nothing for a complete installation', () => {
  for (const feature of [
    'compliance',
    'vulnerabilities',
    'networkPolicies',
    'runtime',
    'exceptions',
  ] as const) {
    expect(setupIssues(feature, { servedResources: allResources, capabilities: enabled })).toEqual(
      []
    );
  }
});

it('warns that scans ignore exceptions while risk acceptance is disabled', () => {
  const setup = {
    servedResources: allResources,
    operatorNamespace: 'kubescape',
    capabilities: { ...enabled, riskAcceptance: 'disable' },
  };
  expect(setupIssues('exceptions', setup)).toEqual([
    {
      severity: 'warning',
      message: expect.stringContaining('scan results ignore them'),
      fix: 'helm upgrade kubescape kubescape/kubescape-operator -n kubescape --reuse-values --set capabilities.riskAcceptance=enable',
    },
  ]);
  expect(scannersApplyExceptions(setup)).toBe(false);
  expect(scannersApplyExceptions({ capabilities: enabled })).toBe(true);
  expect(scannersApplyExceptions({})).toBe(false);
});

it('reports a missing storage API as the only issue', () => {
  const issues = setupIssues('compliance', { storageError: 'the server could not find it' });
  expect(issues).toHaveLength(1);
  expect(issues[0].severity).toBe('error');
  expect(issues[0].message).toContain('(the server could not find it)');
});

it('reports disabled capabilities with the command that enables them', () => {
  const issues = setupIssues('compliance', {
    servedResources: allResources,
    operatorNamespace: 'security',
    capabilities: { ...enabled, continuousScan: 'disable' },
  });
  expect(issues).toEqual([
    {
      severity: 'warning',
      message: expect.stringContaining('continuousScan'),
      fix: 'helm upgrade kubescape kubescape/kubescape-operator -n security --reuse-values --set capabilities.continuousScan=enable',
    },
  ]);

  const [missing] = setupIssues('networkPolicies', {
    servedResources: allResources,
    capabilities: { ...enabled, networkPolicyService: 'disable' },
  });
  expect(missing.severity).toBe('error');
  expect(missing.message).toContain('networkPolicyService');
});

it('accepts the legacy profile resources of older storage releases', () => {
  expect(
    setupIssues('runtime', {
      servedResources: new Set(['applicationprofiles']),
      capabilities: enabled,
    })
  ).toEqual([]);
  expect(setupIssues('runtime', { servedResources: new Set(), capabilities: enabled })).toEqual([
    expect.objectContaining({ severity: 'error' }),
  ]);
});

it('does not warn about capabilities it could not read', () => {
  expect(setupIssues('vulnerabilities', { servedResources: allResources })).toEqual([]);
});

it('prefers the effective capabilities and ignores unreadable ones', () => {
  expect(
    parseCapabilities(
      JSON.stringify({
        capabilities: { relevancy: 'enable' },
        effectiveCapabilities: { relevancy: 'disable' },
      })
    )
  ).toEqual({ relevancy: 'disable' });
  // effectiveCapabilities only lists some capabilities, as the operator chart writes it
  expect(
    parseCapabilities(
      JSON.stringify({
        capabilities: {
          continuousScan: 'enable',
          runtimeObservability: 'enable',
          networkEventsStreaming: 'enable',
          riskAcceptance: 'disable',
        },
        effectiveCapabilities: { configurationScan: 'enable', networkEventsStreaming: 'disable' },
      })
    )
  ).toEqual({
    continuousScan: 'enable',
    runtimeObservability: 'enable',
    networkEventsStreaming: 'disable',
    riskAcceptance: 'disable',
    configurationScan: 'enable',
  });
  expect(parseCapabilities(JSON.stringify({ components: {} }))).toBeUndefined();
  expect(parseCapabilities(JSON.stringify({ capabilities: { relevancy: 'enable' } }))).toEqual({
    relevancy: 'enable',
  });
  expect(parseCapabilities('not json')).toBeUndefined();
  expect(parseCapabilities(undefined)).toBeUndefined();
});

it('reads the setup of a cluster', async () => {
  mocks.getKubescapeNamespace.mockResolvedValue({ kubeScapeNamespace: 'kubescape', error: null });
  mocks.request.mockImplementation(async (url: string) => {
    if (url === '/apis/spdx.softwarecomposition.kubescape.io/v1beta1') {
      return { resources: [{ name: 'vulnerabilitymanifestsummaries' }] };
    }
    if (url === '/api/v1/namespaces/kubescape/configmaps/ks-capabilities') {
      return { data: { capabilities: JSON.stringify({ capabilities: { relevancy: 'enable' } }) } };
    }
    throw new Error(`unexpected ${url}`);
  });

  expect(await readClusterSetup('cluster-a')).toEqual({
    servedResources: new Set(['vulnerabilitymanifestsummaries']),
    operatorNamespace: 'kubescape',
    capabilities: { relevancy: 'enable' },
  });
  expect(mocks.getKubescapeNamespace).toHaveBeenCalledWith('cluster-a');
  expect(mocks.request.mock.calls.every(([, options]) => options.cluster === 'cluster-a')).toBe(
    true
  );
});

it('reads what it can when the storage API and operator are missing', async () => {
  mocks.getKubescapeNamespace.mockResolvedValue({
    kubeScapeNamespace: undefined,
    error: 'Kubescape operator namespace not found.',
  });
  mocks.request.mockRejectedValue(new Error('the server could not find the requested resource'));

  expect(await readClusterSetup('cluster-a')).toEqual({
    storageError: 'the server could not find the requested resource',
    operatorNamespace: undefined,
  });
});

it('reuses the setup it read for half a minute', async () => {
  mocks.getKubescapeNamespace.mockResolvedValue({ kubeScapeNamespace: undefined, error: null });
  mocks.request.mockResolvedValue({ resources: [] });

  await readClusterSetup('cluster-a', 0);
  await readClusterSetup('cluster-a', 29_000);
  expect(mocks.getKubescapeNamespace).toHaveBeenCalledTimes(1);

  await readClusterSetup('cluster-b', 29_000);
  await readClusterSetup('cluster-a', 31_000);
  expect(mocks.getKubescapeNamespace).toHaveBeenCalledTimes(3);
});
