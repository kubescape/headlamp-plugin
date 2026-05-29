import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { SecurityExceptionForm } from './SecurityExceptionForm';

interface CreateExceptionButtonProps {
  prefillControlID?: string;
  prefillCVEID?: string;
  prefillWorkloadKind?: string;
  prefillWorkloadName?: string;
  prefillNamespace?: string;
  buttonLabel?: string;
  disabled?: boolean;
}

export function CreateExceptionButton(props: Readonly<CreateExceptionButtonProps>) {
  const {
    prefillControlID,
    prefillCVEID,
    prefillWorkloadKind,
    prefillWorkloadName,
    prefillNamespace,
    buttonLabel,
    disabled,
  } = props;
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <Button
        variant="contained"
        size="small"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="whitespace-nowrap"
      >
        {buttonLabel ?? 'Create Exception'}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create SecurityException</DialogTitle>
        <DialogContent className="pt-4">
          <SecurityExceptionForm
            prefillControlID={prefillControlID}
            prefillCVEID={prefillCVEID}
            prefillWorkloadKind={prefillWorkloadKind}
            prefillWorkloadName={prefillWorkloadName}
            prefillNamespace={prefillNamespace}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
