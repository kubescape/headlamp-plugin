/*
  Asking before an object is deleted from a cluster, naming the object, its namespace and its
  cluster, so that a click on a delete button in a list does not delete anything by itself.
*/
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { ReactNode, useState } from 'react';

export interface DeleteTarget {
  // what the object is, such as "Rules object"
  kind: string;
  name: string;
  namespace?: string;
  cluster?: string;
}

/** Deletes the object once the user confirms; an error is shown in the dialog. */
export function ConfirmDeleteDialog(
  props: Readonly<{
    target: DeleteTarget;
    // what deleting it changes
    consequence: ReactNode;
    onDelete: () => Promise<unknown>;
    onClose: () => void;
  }>
) {
  const { target, consequence, onDelete, onClose } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="confirm-delete-title"
    >
      <DialogTitle id="confirm-delete-title">Delete {target.kind}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Deletes the {target.kind} <b>{target.name}</b>
          {target.namespace && (
            <>
              {' '}
              in namespace <b>{target.namespace}</b>
            </>
          )}
          {target.cluster && (
            <>
              {' '}
              of cluster <b>{target.cluster}</b>
            </>
          )}
          . {consequence}
        </DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={busy}>
          {busy ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
