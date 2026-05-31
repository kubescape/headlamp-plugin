import { Button, Dialog, DialogContent, DialogTitle, IconButton, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';
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
  /** when provided, hide type chooser and preselect posture or vulnerability */
  defaultType?: 'posture' | 'vulnerability';
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
      <Tooltip title={buttonLabel ?? 'Create Security Exception'}>
        <span>
          <IconButton
            size="small"
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-label={buttonLabel ?? 'Create Security Exception'}
          >
            <Icon icon="mdi:shield-plus-outline" />
          </IconButton>
        </span>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Security Exception</DialogTitle>
        <DialogContent className="pt-4">
          <SecurityExceptionForm
            prefillControlID={prefillControlID}
            prefillCVEID={prefillCVEID}
            prefillWorkloadKind={prefillWorkloadKind}
            prefillWorkloadName={prefillWorkloadName}
            prefillNamespace={prefillNamespace}
            defaultType={props.defaultType}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
