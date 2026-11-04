import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { SecurityException } from '../softwarecomposition/SecurityException';
import { SecurityExceptionForm } from './SecurityExceptionForm';

const mocks = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), enqueueSnackbar: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ post: mocks.post, put: mocks.put }));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));
vi.mock('../common/currentUser', () => ({ useCurrentUser: () => undefined }));
vi.mock('./history', () => ({
  recordChangeByCurrentUser: async (exception: any) => exception,
}));

beforeEach(() => {
  mocks.put.mockReset().mockResolvedValue({});
  mocks.enqueueSnackbar.mockReset();
});
afterEach(cleanup);

it('keeps the accepted risk and the fields it does not show when an exception is edited', async () => {
  const existing: SecurityException = {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'SecurityException',
    metadata: { name: 'accept-web', namespace: 'shop' },
    spec: {
      match: { resources: [{ kind: 'Deployment', name: 'web' }] },
      vulnerabilities: [
        {
          vulnerability: { id: 'CVE-1', aliases: ['GHSA-1'] },
          status: 'affected',
          response: ['can_not_fix'],
          actionStatement: 'No fix upstream',
          expiresAt: '2027-01-01T00:00:00Z',
          expiredOnFix: true,
        },
      ],
    },
  };
  render(<SecurityExceptionForm existing={existing} onClose={() => {}} />);
  expect((screen.getByLabelText(/Action statement/) as HTMLInputElement).value).toBe(
    'No fix upstream'
  );

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(mocks.put).toHaveBeenCalled());
  expect(mocks.put.mock.calls[0][1].spec.vulnerabilities).toEqual(existing.spec.vulnerabilities);
});
