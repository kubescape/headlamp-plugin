import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { ContextBadge, MetadataFields, sanitizeName } from './shared';

export interface GuidedComplianceFormProps {
  controlID: string;
  frameworkName?: string;
  workloadName: string;
  workloadNamespace: string;
  workloadKind: string;
  onClose: () => void;
}

type ComplianceScope = 'workload' | 'namespace' | 'kind-cluster' | 'cluster';

export function GuidedComplianceExceptionForm(props: Readonly<GuidedComplianceFormProps>) {
  const { controlID, workloadName, workloadNamespace, workloadKind, onClose } = props;
  const { enqueueSnackbar } = useSnackbar();

  const [scope, setScope] = useState<ComplianceScope>('workload');
  const [action, setAction] = useState<'ignore' | 'alert_only'>('ignore');
  const [name, setName] = useState(sanitizeName(`${controlID}-${workloadName}`));
  const [reason, setReason] = useState('');
  const [expiresDate, setExpiresDate] = useState('');

  const isCluster = scope === 'kind-cluster' || scope === 'cluster';

  const scopeOptions: { value: ComplianceScope; label: string; description: string }[] = [
    {
      value: 'workload',
      label: 'This workload only',
      description: `${workloadKind}/${workloadName} in namespace "${workloadNamespace}"`,
    },
    {
      value: 'namespace',
      label: 'All workloads in namespace',
      description: `All workloads in namespace "${workloadNamespace}"`,
    },
    {
      value: 'kind-cluster',
      label: `All ${workloadKind} resources cluster-wide`,
      description: `All ${workloadKind} resources across all namespaces`,
    },
    {
      value: 'cluster',
      label: 'All workloads cluster-wide',
      description: 'All workloads across all namespaces',
    },
  ];

  const handleSubmit = async () => {
    if (!name) {
      enqueueSnackbar('Name is required', { variant: 'error' });
      return;
    }

    const match: Record<string, any> = {};
    if (scope === 'workload') {
      match.resources = [{ kind: workloadKind, name: workloadName }];
    } else if (scope === 'kind-cluster') {
      match.resources = [{ kind: workloadKind }];
    }
    // 'namespace' and 'cluster' scopes: empty match — applies to all workloads in scope

    const spec = {
      ...(reason && { reason }),
      ...(expiresDate && { expiresAt: `${expiresDate}T00:00:00Z` }),
      match,
      posture: [{ controlID, action }],
    };

    try {
      if (isCluster) {
        await post('/apis/kubescape.io/v1beta1/clustersecurityexceptions', {
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'ClusterSecurityException',
          metadata: { name },
          spec,
        });
      } else {
        await post(
          `/apis/kubescape.io/v1beta1/namespaces/${workloadNamespace}/securityexceptions`,
          {
            apiVersion: 'kubescape.io/v1beta1',
            kind: 'SecurityException',
            metadata: { name, namespace: workloadNamespace },
            spec,
          }
        );
      }
      enqueueSnackbar('Security exception created', { variant: 'success' });
      onClose();
    } catch (err: any) {
      enqueueSnackbar(`Failed to create: ${err?.message ?? err}`, { variant: 'error' });
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Posture Exception</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <MetadataFields
            name={name}
            onNameChange={setName}
            namespace={isCluster ? undefined : workloadNamespace}
            reason={reason}
            onReasonChange={setReason}
            expiresDate={expiresDate}
            onExpiresDateChange={setExpiresDate}
          />

          <ContextBadge label="Control" value={controlID} />
          <ContextBadge label="Workload" value={`${workloadKind}/${workloadName}`} />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Exception scope
            </Typography>
            <RadioGroup value={scope} onChange={e => setScope(e.target.value as ComplianceScope)}>
              {scopeOptions.map(opt => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2">{opt.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opt.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 0.5 }}
                />
              ))}
            </RadioGroup>
          </Box>

          <FormControl fullWidth>
            <InputLabel>Action</InputLabel>
            <Select
              value={action}
              label="Action"
              onChange={e => setAction(e.target.value as 'ignore' | 'alert_only')}
            >
              <MenuItem value="ignore">
                <Box>
                  <Typography variant="body2">ignore</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Remove from results and scoring entirely
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="alert_only">
                <Box>
                  <Typography variant="body2">alert_only</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Still fails in scoring, but marked as acknowledged
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
