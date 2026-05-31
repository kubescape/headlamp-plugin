import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { SecurityExceptionForm } from './SecurityExceptionForm';

// stub canvas getContext (xterm may call this during transforms)
(HTMLCanvasElement.prototype as any).getContext = () => ({ /* stub */ });

// Use vitest's vi.mock to ensure mocks are applied correctly
declare const vi: any;
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ post: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getCluster: () => 'test-cluster' }));

interface CreatedResource {
  metadata: {
    name: string;
    namespace?: string;
  };
  kind: 'SecurityException' | 'ClusterSecurityException';
}

const postMock = post as any;

const theme = createTheme();
(theme.palette as any).tables = { head: { borderColor: '#ccc' } };
function renderWithProviders(ui: any) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function fillScope() {
  fireEvent.change(screen.getByLabelText('Namespace'), { target: { value: 'default' } });
  fireEvent.change(screen.getByLabelText('Workload kind'), { target: { value: 'Deployment' } });
  fireEvent.change(screen.getByLabelText('Workload name'), { target: { value: 'nginx' } });
}

function selectOption(label: string, option: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function enablePosture() {
  fireEvent.click(screen.getByLabelText('Posture exception'));
  fireEvent.change(screen.getByLabelText('Control ID'), { target: { value: 'C-0034' } });
  selectOption('Action', 'alert_only');
}

function enableVulnerability() {
  fireEvent.click(screen.getByLabelText('Vulnerability exception'));
  fireEvent.change(screen.getByLabelText('CVE ID'), { target: { value: 'CVE-2021-44228' } });
  selectOption('Status', 'not_affected');
}

function goNext() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('SecurityExceptionForm', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('renders and navigates all steps', () => {
    renderWithProviders(<SecurityExceptionForm />);
    expect(screen.getByText('Scope')).toBeInTheDocument();
    fillScope();
    goNext();
    enablePosture();
    goNext();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Accepted risk' } });
    goNext();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('prefills fields from props', () => {
    renderWithProviders(
      <SecurityExceptionForm
        prefillControlID="C-0034"
        prefillWorkloadKind="Deployment"
        prefillWorkloadName="nginx"
        prefillNamespace="default"
      />
    );
    expect(screen.getByLabelText('Namespace')).toHaveValue('default');
    expect(screen.getByLabelText('Workload kind')).toHaveValue('Deployment');
    expect(screen.getByLabelText('Workload name')).toHaveValue('nginx');
    goNext();
    expect(screen.getByLabelText('Control ID')).toHaveValue('C-0034');
  });

  it('disables Next until scope fields are valid', () => {
    renderWithProviders(<SecurityExceptionForm />);
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    fillScope();
    expect(next).toBeEnabled();
  });

  it('blocks submit when reason is empty', () => {
    renderWithProviders(<SecurityExceptionForm />);
    fillScope();
    goNext();
    enablePosture();
    goNext();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
  });

  it('blocks submit when expiresAt is in the past', () => {
    renderWithProviders(<SecurityExceptionForm />);
    fillScope();
    goNext();
    enablePosture();
    goNext();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Accepted risk' } });
    fireEvent.change(screen.getByLabelText('Expires at'), { target: { value: '2000-01-01' } });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
  });

  it('blocks step 2 when no exception type is selected', () => {
    renderWithProviders(<SecurityExceptionForm />);
    fillScope();
    goNext();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
  });

  it('requires justification when status is not_affected', () => {
    renderWithProviders(<SecurityExceptionForm />);
    fillScope();
    goNext();
    enableVulnerability();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
  });

  it('submits a namespaced SecurityException and renders success state', async () => {
    const created: CreatedResource = {
      metadata: { name: 'se-test', namespace: 'default' },
      kind: 'SecurityException',
    };
    postMock.mockResolvedValue(created);

    render(<SecurityExceptionForm />);
    fillScope();
    goNext();
    enablePosture();
    goNext();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Accepted risk' } });
    goNext();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and Create' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Created SecurityException: se-test')).toBeInTheDocument();
    expect(screen.getByText('View details')).toBeInTheDocument();

    const [path, manifest] = postMock.mock.calls[0] as [string, { metadata: { namespace?: string } }];
    expect(path).toContain('/apis/kubescape.io/v1/namespaces/default/securityexceptions');
    expect(manifest.metadata.namespace).toBe('default');
  });

  it('submits a ClusterSecurityException without namespace in metadata', async () => {
    const created: CreatedResource = {
      metadata: { name: 'cse-test' },
      kind: 'ClusterSecurityException',
    };
    postMock.mockResolvedValue(created);

    render(<SecurityExceptionForm />);
    fireEvent.click(screen.getByLabelText('ClusterSecurityException (cluster-scoped)'));
    fireEvent.change(screen.getByLabelText('Workload kind'), { target: { value: 'Deployment' } });
    fireEvent.change(screen.getByLabelText('Workload name'), { target: { value: 'nginx' } });
    goNext();
    enablePosture();
    goNext();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Accepted risk' } });
    goNext();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and Create' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    const [, manifest] = postMock.mock.calls[0] as [string, { metadata: { namespace?: string } }];
    expect(manifest.metadata.namespace).toBeUndefined();
  });
});
