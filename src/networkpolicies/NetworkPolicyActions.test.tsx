import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { NetworkPolicyActions } from './NetworkPolicyActions';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  enqueueSnackbar: vi.fn(),
  writeText: vi.fn(),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  request: mocks.request,
  post: mocks.post,
  put: mocks.put,
}));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'cluster-a' }));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));

const generated = {
  metadata: { name: 'deployment-web', namespace: 'shop', labels: {}, annotations: {} },
  spec: {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'deployment-web', namespace: 'shop' },
    spec: { podSelector: { matchLabels: { app: 'web' } }, policyTypes: ['Ingress'] },
  },
  policyRef: [],
} as unknown as GeneratedNetworkPolicy;

beforeEach(() => {
  mocks.request.mockReset().mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
  mocks.post.mockReset().mockResolvedValue({ status: { allowed: true } });
  mocks.enqueueSnackbar.mockReset();
  mocks.writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
});

const execCommand = document.execCommand;
afterEach(() => {
  cleanup();
  document.execCommand = execCommand;
});

it('copies the suggested NetworkPolicy from the create dialog', async () => {
  render(<NetworkPolicyActions generatedNetworkPolicy={generated} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create NetworkPolicy' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Copy YAML' }));

  await waitFor(() => expect(mocks.writeText).toHaveBeenCalledTimes(1));
  const copied = mocks.writeText.mock.calls[0][0];
  expect(copied).toBe(screen.getByText(/kind: NetworkPolicy/).textContent);
  expect(copied).toContain('app: web');
  expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('NetworkPolicy YAML copied to the clipboard', {
    variant: 'success',
  });
  // copying neither creates the policy nor closes the dialog
  expect(mocks.post.mock.calls.every(([url]) => url.includes('selfsubjectaccessreviews'))).toBe(
    true
  );
  expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
});

it('says so when the clipboard cannot be used', async () => {
  mocks.writeText.mockRejectedValue(new Error('denied'));
  document.execCommand = vi.fn(() => false);
  render(<NetworkPolicyActions generatedNetworkPolicy={generated} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create NetworkPolicy' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Copy YAML' }));

  await waitFor(() =>
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(
      'Unable to copy the YAML: The clipboard is not available.',
      { variant: 'error' }
    )
  );
});
