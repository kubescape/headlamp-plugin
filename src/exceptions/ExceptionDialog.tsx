import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { ErrorContainer } from '../common/ErrorContainer';
import { ExceptionPolicy, PosturePolicy, ResourceDesignator } from './ExceptionPolicy';

/**
 * EditPosturePolicyExceptionDialog renders
 * a dialog for editing a posture policy exception.
 *
 * Props:
 * - exception: The initial PostureExceptionPolicy object to be edited.
 * - onUpdate: A callback function invoked when the exception is updated,
 *   receiving the original name and the updated PostureExceptionPolicy object.
 *
 * The component provides input fields for editing the exception's name and reason,
 * and includes subcomponents for editing resource and policy matchers.
 * It validates the input data before invoking the onUpdate function.
 */
export function EditPosturePolicyExceptionDialog(
  props: Readonly<{
    exception: ExceptionPolicy;
    onUpdate: (name: string, updatedException: ExceptionPolicy) => void;
  }>
) {
  const { exception, onUpdate } = props;
  const [open, setOpen] = useState(false);
  const [editedException, setEditedException] = useState<ExceptionPolicy>(exception);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = () => {
    if (editedException.resources?.some(r => Object.keys(r.attributes).length === 0)) {
      return setErrorMessage('Resource matcher must not be empty');
    }
    if (editedException.posturePolicies?.some(pp => Object.values(pp).length === 0)) {
      return setErrorMessage('Policy matcher must not be empty');
    }
    if (!editedException.name) {
      return setErrorMessage('Name must not be empty');
    }
    if (!editedException.resources || editedException.resources.length === 0) {
      return setErrorMessage('Resource matchers must not be empty');
    }

    onUpdate(exception.name, editedException);
    handleClose();
    setErrorMessage('');
  };

  return (
    <>
      <IconButton onClick={handleClickOpen} title="Edit policy exception">
        <Icon icon="mdi:edit" />
      </IconButton>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle>Policy Exception</DialogTitle>
        <DialogContent>
          {errorMessage && <ErrorContainer> {errorMessage} </ErrorContainer>}
          <Stack direction="row" sx={{ alignItems: 'center', spacing: 2 }}>
            <InputLabel htmlFor="name" sx={{ width: 80, marginRight: 4 }}>
              Name
            </InputLabel>

            <TextField
              key="name"
              id="name"
              fullWidth
              variant="outlined"
              value={editedException.name}
              onChange={event =>
                setEditedException({ ...editedException, name: event.target.value })
              }
            />
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center', spacing: 2, marginTop: 2 }}>
            <InputLabel htmlFor="reason" sx={{ width: 80, marginRight: 4 }}>
              Reason
            </InputLabel>

            <TextField
              key="reason"
              id="reason"
              fullWidth
              multiline
              variant="outlined"
              value={editedException.reason}
              onChange={event =>
                setEditedException({ ...editedException, reason: event.target.value })
              }
            />
          </Stack>

          <EditResourceMatchers
            editedException={editedException}
            setEditedException={setEditedException}
          ></EditResourceMatchers>
          <EditPolicyMatchers
            editedException={editedException}
            setEditedException={setEditedException}
          ></EditPolicyMatchers>
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" onClick={handleSubmit}>
            Save
          </Button>
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function EditResourceMatchers(
  props: Readonly<{ editedException: ExceptionPolicy; setEditedException: Function }>
) {
  const { editedException, setEditedException } = props;

  const fields = ['namespace', 'name', 'kind'];

  const handleAddRow = () => {
    const newResources = editedException.resources ? [...editedException.resources] : [];
    newResources.push({ attributes: {} } as ResourceDesignator);
    const exception = { ...editedException, resources: newResources };
    setEditedException(exception);
  };

  const handleDelete = (index: number) => {
    if (editedException.resources) {
      const newResources = [...editedException.resources];
      newResources.splice(index, 1);
      const exception = { ...editedException, resources: newResources };
      setEditedException(exception);
    }
  };

  const updateResourceDesignator = (index: number, key: string, value: string) => {
    if (editedException.resources) {
      const newResources = [...editedException.resources];
      if (value) {
        newResources[index].attributes[key] = value;
      } else {
        delete newResources[index].attributes[key];
      }
      const exception = { ...editedException, resources: newResources };
      setEditedException(exception);
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ marginTop: 4, marginBottom: 2 }}>
        <Typography variant="h6" sx={{ width: 200, marginRight: 4 }}>
          Resource Matchers
        </Typography>
        <IconButton onClick={() => handleAddRow()}>
          <Icon icon="mdi:add-circle" />
        </IconButton>
      </Stack>
      {!editedException.resources && (
        <Typography component="p" sx={{ fontSize: 12 }}>
          No resource matchers defined
        </Typography>
      )}
      {editedException.resources && (
        <Table>
          <TableHead>
            <TableRow key="header">
              <HeaderCell title="Namespace" />
              <HeaderCell title="Name" />
              <HeaderCell title="Kind" />
            </TableRow>
          </TableHead>
          <TableBody>
            {editedException.resources.map((entry, index) => (
              <TableRow key={`${index}`}>
                {fields.map((field, fieldindex) => (
                  <EditCell
                    object={entry.attributes}
                    key={`${index}-${fieldindex}`}
                    index={index}
                    attribute={field}
                    updateFunction={updateResourceDesignator}
                  />
                ))}
                <TableCell key={'delete'} sx={{ padding: '0 4px', verticalAlign: 'middle' }}>
                  <IconButton onClick={() => handleDelete(index)}>
                    <Icon icon="mdi:close-box" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function EditPolicyMatchers(
  props: Readonly<{ editedException: ExceptionPolicy; setEditedException: Function }>
) {
  const { editedException, setEditedException } = props;
  const fields = ['controlID', 'frameworkName'];

  const handleAddRow = () => {
    const newPosturePolicies = editedException.posturePolicies
      ? [...editedException.posturePolicies]
      : [];
    newPosturePolicies.push({} as PosturePolicy);
    const exception = { ...editedException, posturePolicies: newPosturePolicies };
    setEditedException(exception);
  };

  const handleDelete = (index: number) => {
    if (editedException.posturePolicies) {
      const posturePolicies = [...editedException.posturePolicies];
      posturePolicies.splice(index, 1);
      const exception = { ...editedException, posturePolicies: posturePolicies };
      setEditedException(exception);
    }
  };

  const updatePolicy = (index: number, key: string, value: string) => {
    if (editedException.posturePolicies) {
      const posturePolicies = [...editedException.posturePolicies];
      posturePolicies[index][key] = value;
      const exception = { ...editedException, posturePolicies: posturePolicies };
      setEditedException(exception);
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ marginTop: 4, marginBottom: 2 }}>
        <Typography variant="h6" sx={{ width: 200, marginRight: 4 }}>
          Policy Matchers
        </Typography>
        <IconButton onClick={() => handleAddRow()}>
          <Icon icon="mdi:add-circle" />
        </IconButton>
      </Stack>
      {!editedException.posturePolicies && (
        <Typography component="p" sx={{ fontSize: 12 }}>
          No policy matchers defined
        </Typography>
      )}
      {editedException.posturePolicies && (
        <Table>
          <TableHead>
            <TableRow key="header">
              <HeaderCell title="Control ID" />
              <HeaderCell title="Framework" />
            </TableRow>
          </TableHead>
          <TableBody>
            {editedException.posturePolicies.map((posturePolicy, index) => (
              <TableRow key={`${index}`}>
                {fields.map((field, fieldindex) => (
                  <EditCell
                    object={posturePolicy}
                    key={`${index}-${fieldindex}`}
                    index={index}
                    attribute={field}
                    updateFunction={updatePolicy}
                  />
                ))}
                <TableCell key={'delete'} sx={{ padding: '0 4px', verticalAlign: 'middle' }}>
                  <IconButton onClick={() => handleDelete(index)}>
                    <Icon icon="mdi:close-box" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function HeaderCell(props: Readonly<{ title: string }>) {
  const { title } = props;
  const theme = useTheme();

  return (
    <TableCell
      sx={{
        padding: '0 4px',
        verticalAlign: 'middle',
        backgroundColor: theme.palette.metadataBgColor,
        color: 'white',
      }}
    >
      {title}
    </TableCell>
  );
}

function EditCell(
  props: Readonly<{
    object: any;
    index: number;
    attribute: string;
    updateFunction: Function;
  }>
) {
  const { object, index, attribute, updateFunction } = props;
  const [textFieldValue, setTextFieldValue] = useState(object[attribute] ?? '');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTextFieldValue(event.target.value);
    updateFunction(index, attribute, event.target.value);
  };

  return (
    <TableCell key={attribute} sx={{ padding: '0 4px', verticalAlign: 'middle' }}>
      <TextField
        key={attribute}
        value={textFieldValue}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            border: 'none',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        }}
        onChange={event => handleChange(event)}
      />
    </TableCell>
  );
}
