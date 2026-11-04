import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import KubescapeWorkloadConfigurationScanFixes, { parseFixValue } from './WorkloadScanFixes';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  saveToFile: vi.fn(),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  put: mocks.put,
  post: mocks.post,
}));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: {
    ResourceClasses: {
      Deployment: {
        apiEndpoint: { apiInfo: [{ group: 'apps', version: 'v1' }] },
        pluralName: 'deployments',
      },
      Pod: { apiEndpoint: { apiInfo: [{ group: '', version: 'v1' }] }, pluralName: 'pods' },
    },
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  NameValueTable: () => null,
  SectionBox: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ modified }: { modified: string }) => <pre data-testid="fixed">{modified}</pre>,
}));
vi.mock('../common/url', () => ({
  // control, name, namespace, (unused), cluster
  getURLSegments: () => ['C-0016', 'deployment-web', 'shop', 'cluster-a'],
}));
vi.mock('../common/filedialog', () => ({ saveToFile: mocks.saveToFile }));
vi.mock('../common/ScanNowButton', () => ({ ScanNowButton: () => <button>Scan now</button> }));
vi.mock('../rego', () => ({ useRegoData: () => ({ controls: [] }) }));

let scanKind = 'Deployment';
vi.mock('../model', () => ({
  workloadConfigurationScanClass: {},
  fetchObject: async () => ({
    metadata: {
      name: 'deployment-web',
      labels: {
        'kubescape.io/workload-kind': scanKind,
        'kubescape.io/workload-name': 'web',
        'kubescape.io/workload-namespace': 'shop',
      },
    },
    spec: {
      controls: {
        'C-0016': {
          controlID: 'C-0016',
          rules: [
            {
              paths: [
                {
                  fixPath:
                    'spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation',
                  fixPathValue: 'false',
                  failedPath: '',
                },
              ],
            },
          ],
        },
      },
    },
  }),
}));

const deployment = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { name: 'web', namespace: 'shop', resourceVersion: '42', managedFields: [{}] },
  spec: { template: { spec: { containers: [{ name: 'web', image: 'nginx' }] } } },
  status: { replicas: 1 },
};

beforeEach(() => {
  scanKind = 'Deployment';
  mocks.request.mockReset().mockResolvedValue(structuredClone(deployment));
  mocks.put.mockReset().mockResolvedValue({});
  // the permission check of Apply fix does not get an answer, so it stays enabled
  mocks.post.mockReset();
});
afterEach(cleanup);

it('applies the fixed resource with its resource version, after confirmation', async () => {
  render(<KubescapeWorkloadConfigurationScanFixes />);

  fireEvent.click(await screen.findByRole('button', { name: 'Apply fix' }));
  expect(screen.getByText(/rolls out the change/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
  const [path, applied, , options] = mocks.put.mock.calls[0];
  expect(path).toBe('/apis/apps/v1/namespaces/shop/deployments/web');
  expect(options).toEqual({ cluster: 'cluster-a' });
  expect(applied.metadata.resourceVersion).toBe('42');
  expect(applied.metadata.managedFields).toBeUndefined();
  expect(applied.status).toBeUndefined();
  expect(applied.spec.template.spec.containers[0].securityContext).toEqual({
    allowPrivilegeEscalation: false,
  });
  expect(await screen.findByRole('button', { name: 'Fix applied' })).toHaveProperty(
    'disabled',
    true
  );
});

it('explains that the resource changed when the update conflicts', async () => {
  mocks.put.mockRejectedValue({ status: 409, message: 'conflict' });
  render(<KubescapeWorkloadConfigurationScanFixes />);

  fireEvent.click(await screen.findByRole('button', { name: 'Apply fix' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(await screen.findByText(/changed since this page was opened/)).toBeTruthy();
});

it('downloads the fixed YAML, and does not offer to apply without permission', async () => {
  mocks.post.mockResolvedValue({ status: { allowed: false } });
  render(<KubescapeWorkloadConfigurationScanFixes />);

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply fix' })).toHaveProperty('disabled', true)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download fixed YAML' }));
  expect(mocks.saveToFile.mock.calls[0][1]).toBe('web-fixed.yaml');
  expect(mocks.saveToFile.mock.calls[0][0]).toContain('allowPrivilegeEscalation: false');
});

it('reads core resources from the core API path', async () => {
  scanKind = 'Pod';
  render(<KubescapeWorkloadConfigurationScanFixes />);
  await screen.findByRole('button', { name: 'Apply fix' });
  expect(mocks.request.mock.calls[0][0]).toBe('/api/v1/namespaces/shop/pods/web');
});

it('gives fix values the type of the field', () => {
  expect(parseFixValue('false')).toBe(false);
  expect(parseFixValue('1000')).toBe(1000);
  expect(parseFixValue('RuntimeDefault')).toBe('RuntimeDefault');
  expect(parseFixValue('')).toBe('');
});
