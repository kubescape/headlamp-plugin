import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useState } from 'react';

interface ConfirmPromise {
  resolve: (value: boolean) => void;
}

/**
 * Provides a confirmation dialog. The dialog is rendered when the returned
 * confirm function is called. The confirm function returns a promise that
 * resolves to true or false, depending on whether the user confirmed or
 * canceled.
 *
 * @param title the title of the dialog
 * @param message the message of the dialog
 * @returns a tuple of two values: the first is a function that renders the
 * dialog, the second is the confirm function
 */
export const useConfirm = (title: string, message: string) => {
  const [promise, setPromise] = useState<ConfirmPromise | null>(null);

  const confirm = () =>
    new Promise(resolve => {
      setPromise({ resolve });
    });

  const handleClose = () => {
    setPromise(null);
  };

  const handleConfirm = () => {
    promise?.resolve(true);
    handleClose();
  };

  const handleCancel = () => {
    promise?.resolve(false);
    handleClose();
  };

  const ConfirmationDialog = () => (
    <Dialog open={promise !== null} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleConfirm}>Yes</Button>
        <Button onClick={handleCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );

  return [ConfirmationDialog, confirm];
};
