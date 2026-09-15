import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import {
  ContextBadge,
  MetadataFields,
  PostureActionSelect,
  sanitizeName,
  toExpiresAt,
} from './shared';

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
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [expiresDate, setExpiresDate] = useState('');

  const handleSubmit = async () => {
    if (!name) {
      enqueueSnackbar('Name is required', { variant: 'error' });
      return;
    }

    const spec = {
      ...(author && { author }),
      ...(reason && { reason }),
      ...(expiresDate && { expiresAt: toExpiresAt(expiresDate) }),
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
            author={author}
            onAuthorChange={setAuthor}
            reason={reason}
            onReasonChange={setReason}
            expiresDate={expiresDate}
            onExpiresDateChange={setExpiresDate}
          />

          <ContextBadge label="Control" value={controlID} />
          <ContextBadge label="Scope" value="All namespaces — cluster-wide" />

          <PostureActionSelect value={action} onChange={setAction} fullWidth />
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
