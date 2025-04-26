import { Icon } from '@iconify/react';
import {
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import * as YAML from 'yaml';
import { KubescapeSettings, useLocalStorage } from '../common/webStorage';
import { useConfirm } from './ConfirmDialog';
import { EditPosturePolicyExceptionDialog } from './PostureExceptionDialog';
import {
  PostureExceptionPolicy,
  PosturePolicy,
  ResourceDesignator,
} from './PostureExceptionPolicy';

declare global {
  interface Window {
    showSaveFilePicker: any;
    showOpenFilePicker: any;
  }
}

export default function KubescapePostureExceptionPolicies() {
  const [exceptions, setExceptions] = useLocalStorage(
    KubescapeSettings.Exceptions,
    YAML.stringify(defaultPostureExceptionPolicies)
  );

  const [ConfirmationDialog, confirm] = useConfirm(
    'Reset Policies',
    'Are you sure you want to reset policies to default?'
  );

  const postureExceptionPolicies: PostureExceptionPolicy[] = YAML.parse(exceptions);
  const { enqueueSnackbar } = useSnackbar();

  const handleAddRow = () => {
    const defaultPolicyName = 'new-policy';
    const newPostureExceptionPolicies = postureExceptionPolicies ?? [];
    let maxNum = 0;
    newPostureExceptionPolicies.forEach(policy => {
      if (policy.name.startsWith(defaultPolicyName)) {
        const num = parseInt(policy.name.replace(defaultPolicyName + '-', ''));
        if (!num) maxNum++;
        maxNum = num > maxNum ? num : maxNum;
      }
    });

    const policyName = maxNum > 0 ? `${defaultPolicyName}-${maxNum + 1}` : defaultPolicyName;
    newPostureExceptionPolicies.push({
      name: policyName,
      creationTime: new Date(),
    } as PostureExceptionPolicy);
    setExceptions(YAML.stringify(newPostureExceptionPolicies));
  };

  const handleDelete = (policy: PostureExceptionPolicy) => {
    postureExceptionPolicies.splice(postureExceptionPolicies.indexOf(policy), 1);
    setExceptions(YAML.stringify(postureExceptionPolicies));
  };

  const handleSave = () => {
    postureExceptionPolicies.forEach(policy => {
      policy.policyType = 'postureExceptionPolicy';
      policy.actions = ['alertOnly'];
    });
    saveToFile(JSON.stringify(postureExceptionPolicies, null, 2), enqueueSnackbar);
  };

  const handleImport = async () => {
    const pickerOpts = {
      types: [
        {
          description: 'Kubescape exceptions file',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    };
    const fileHandle = await window.showOpenFilePicker(pickerOpts);

    if (fileHandle) {
      const fileData = await fileHandle[0].getFile();
      const text = await fileData.text();
      const policies = JSON.parse(text);
      setExceptions(YAML.stringify(policies));
      enqueueSnackbar(`${fileData.name} imported successfully`, { variant: 'success' });
    }
  };

  const handleReset = async () => {
    const ok = await confirm();
    if (ok) {
      const policies = defaultPostureExceptionPolicies.map((policy: PostureExceptionPolicy) => {
        return { ...policy, creationTime: new Date() };
      });
      setExceptions(YAML.stringify(policies));
    }
  };

  return (
    <Box>
      {(ConfirmationDialog as () => React.ReactNode)()}
      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Posture Exception Policies
        </Typography>
        <Tooltip title="Add a new policy">
          <IconButton onClick={() => handleAddRow()}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Save policy to file">
          <IconButton onClick={() => handleSave()}>
            <Icon icon="mdi:content-save" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Load an existing policy from file">
          <IconButton onClick={() => handleImport()}>
            <Icon icon="mdi:import" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset policy to default">
          <IconButton onClick={() => handleReset()}>
            <Icon icon="mdi:restart" />
          </IconButton>
        </Tooltip>
      </Stack>
      <HeadlampTable
        data={postureExceptionPolicies}
        columns={[
          {
            header: 'Name',
            accessorKey: 'name',
            gridTemplate: 'auto',
          },
          {
            header: 'Reason',
            accessorKey: 'reason',
            gridTemplate: '300px',
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
          },
          {
            header: 'Resource matchers',
            accessorFn: (policy: PostureExceptionPolicy) => displayMatchers(policy.resources),
            gridTemplate: 'auto',
          },
          {
            header: 'Policy matchers',
            accessorFn: (policy: PostureExceptionPolicy) => displayMatchers(policy.posturePolicies),
            gridTemplate: 'auto',
          },
          {
            header: 'Date Created',
            accessorKey: 'creationTime',
            Cell: ({ cell }: any) => {
              const dateString = cell.getValue();
              if (dateString) {
                const date = new Date(dateString);
                return date.toISOString().split('T')[0];
              }
            },
            gridTemplate: 'min-content',
          },
          {
            header: 'Actions',
            accessorFn: (policy: PostureExceptionPolicy) => (
              <>
                <EditPosturePolicyExceptionDialog
                  exception={policy}
                  onUpdate={(name, updatedException) => {
                    const updatedExceptions = postureExceptionPolicies.map(exception =>
                      exception.name === name ? updatedException : exception
                    );
                    setExceptions(YAML.stringify(updatedExceptions));
                  }}
                />
                <IconButton onClick={() => handleDelete(policy)}>
                  <Icon icon="mdi:delete" />
                </IconButton>
              </>
            ),
            gridTemplate: 'min-content',
          },
        ]}
      />
    </Box>
  );
}

function displayMatchers(matchers: PosturePolicy[] | ResourceDesignator[] | undefined) {
  if (!matchers) {
    return <></>;
  }

  function getObject(obj: PosturePolicy | ResourceDesignator): any {
    return obj.attributes ?? obj;
  }

  return (
    <Stack direction={'column'} sx={{ verticalAlign: 'top' }}>
      {matchers.map((m, indx) => (
        <Stack key={indx} direction={'column'}>
          {indx > 0 && <Box>OR</Box>}
          {Object.entries(getObject(m))
            .sort(([k1], [k2]) => k1.localeCompare(k2))
            .map(([k, v]) => `${k} = ${v}`)
            .join(' AND ')}
        </Stack>
      ))}
    </Stack>
  );
}

const saveToFile = async (content: string, enqueueSnackbar: Function) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const defaultFileName = 'kubescape-exceptions.json';

  const createSaveFilePicker = async (): Promise<FileSystemFileHandle> => {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: defaultFileName,
    });

    return fileHandle;
  };

  let fileName = defaultFileName;
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await createSaveFilePicker();
      fileName = fileHandle.name;
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      console.error('Error selecting a file:', error);
      return null;
    }
  } else {
    // For browsers that don't support window.showSaveFilePicker
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = defaultFileName;

    // Trigger the download
    a.click();

    // Clean up
    window.URL.revokeObjectURL(a.href);
  }

  enqueueSnackbar(`${fileName} saved successfully`, { variant: 'success' });
};

const defaultPostureExceptionPolicies: PostureExceptionPolicy[] = [
  {
    name: 'ignore-system-namespaces',
    policyType: 'postureExceptionPolicy',
    actions: ['alertOnly'],
    resources: [
      {
        designatorType: 'Attributes',
        attributes: {
          namespace: 'kubescape|kube-system|kube-public|kube-node-lease|kubeconfig',
        },
      },
    ],
  },
];
