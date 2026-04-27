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
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { ContextBadge, MetadataFields, sanitizeName } from './shared';

export interface GuidedClusterComplianceExceptionFormProps {
  controlID: string;
  onClose: () => void;
}

export function GuidedClusterComplianceExceptionForm(
  props: Readonly<GuidedClusterComplianceExceptionFormProps>
) {
  const { controlID, onClose } = props;
  const { enqueueSnackbar } = useSnackbar();

  const [action, setAction] = useState<'ignore' | 'alert_only'>('ignore');
  const [name, setName] = useState(sanitizeName(`${controlID}-cluster`));
  const [reason, setReason] = useState('');
  const [expiresDate, setExpiresDate] = useState('');

  const handleSubmit = async () => {
    if (!name) {
      enqueueSnackbar('Name is required', { variant: 'error' });
      return;
    }

    const spec = {
      ...(reason && { reason }),
      ...(expiresDate && { expiresAt: `${expiresDate}T00:00:00Z` }),
      match: {},
      posture: [{ controlID, action }],
    };

    try {
      await post('/apis/kubescape.io/v1beta1/clustersecurityexceptions', {
        apiVersion: 'kubescape.io/v1beta1',
        kind: 'ClusterSecurityException',
        metadata: { name },
        spec,
      });
      enqueueSnackbar('Security exception created', { variant: 'success' });
      onClose();
    } catch (err: any) {
      enqueueSnackbar(`Failed to create: ${err?.message ?? err}`, { variant: 'error' });
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Exclude Control Cluster-wide</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <MetadataFields
            name={name}
            onNameChange={setName}
            reason={reason}
            onReasonChange={setReason}
            expiresDate={expiresDate}
            onExpiresDateChange={setExpiresDate}
          />

          <ContextBadge label="Control" value={controlID} />
          <ContextBadge label="Scope" value="All namespaces — cluster-wide" />

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
