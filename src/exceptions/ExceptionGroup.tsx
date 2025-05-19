import { Icon } from '@iconify/react';
import { patch, post, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { ErrorContainer } from '../common/ErrorContainer';
import { saveToFile } from '../common/filedialog';
import { getItemFromSessionStorage, KubescapeSettings } from '../common/sessionStorage';
import { getURLSegments } from '../common/url';
import { checkUniqueness } from '../custom-objects/api-queries';
import { customObjectLabel } from '../model';
import { useConfirm } from './ConfirmDialog';
import { EditPosturePolicyExceptionDialog } from './ExceptionDialog';
import {
  ExceptionPolicy,
  ExceptionPolicyGroup,
  PosturePolicy,
  ResourceDesignator,
} from './ExceptionPolicy';

declare global {
  interface Window {
    showOpenFilePicker: any;
  }
}

export function ExceptionGroupNew() {
  return <ExceptionGroup group={{ name: '', exceptionPolicies: [] }} />;
}

export function ExceptionGroupEdit() {
  const [configMapName] = getURLSegments(-1);
  const [configMap, setConfigMap] = useState<KubeConfigMap>();

  useEffect(() => {
    const kubeScapeNamespace = getItemFromSessionStorage<string>(
      KubescapeSettings.KubescapeNamespace
    );

    if (kubeScapeNamespace) {
      request(`/api/v1/namespaces/${kubeScapeNamespace}/configmaps/${configMapName}`).then(
        response => setConfigMap(response)
      );
    }
  }, []);

  if (configMap) {
    const group = {
      name: configMap?.data.name,
      description: configMap?.data.description,
      exceptionPolicies: JSON.parse(configMap.data.exceptionPolicies ?? '[]'),
    } as ExceptionPolicyGroup;
    return <ExceptionGroup group={group} configMap={configMap} />;
  }

  return <></>;
}

function ExceptionGroup(
  props: Readonly<{
    group: ExceptionPolicyGroup;
    configMap?: KubeConfigMap;
  }>
) {
  const [configMap, setConfigMap] = useState<KubeConfigMap | undefined>(props.configMap);
  const [exceptionGroup, setExceptionGroup] = useState<ExceptionPolicyGroup>(props.group);
  const [exceptionPolicies, setExceptionPolicies] = useState<ExceptionPolicy[]>(
    props.group.exceptionPolicies
  );
  const { enqueueSnackbar } = useSnackbar();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const kubeScapeNamespace =
    getItemFromSessionStorage<string>(KubescapeSettings.KubescapeNamespace) ?? 'kubescape';

  const handleSave = async () => {
    if (!exceptionGroup.name) {
      return setErrorMessage('Name must not be empty');
    }
    if (!/^[a-z0-9]([-a-z0-9 ]*[a-z0-9])?$/.test(exceptionGroup.name.toLocaleLowerCase())) {
      return setErrorMessage(
        'Only lettters, numbers, spaces and dashes are allowed in the name (e.g. "Dev Framework")'
      );
    }

    if (!(await checkUniqueness(exceptionGroup.name, configMap?.metadata.uid, 'exceptions'))) {
      return setErrorMessage('Please provide a unique name for the exception group.');
    }

    exceptionPolicies.forEach(policy => {
      policy.policyType = 'postureExceptionPolicy';
      policy.actions = ['alertOnly'];
    });

    function updateConfigMapData(configMap: KubeConfigMap) {
      configMap.data = {
        name: exceptionGroup.name,
        description: exceptionGroup.description ?? '',
        exceptionPolicies: JSON.stringify(exceptionPolicies),
      };
    }

    if (!configMap?.metadata.uid) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);

      const configMapNew: KubeConfigMap = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          creationTimestamp: new Date().toISOString(),
          uid: '',
          name: `${exceptionGroup.name
            .replace(' ', '')
            ?.toLocaleLowerCase()}-exceptions-${randomSuffix}`,
          namespace: kubeScapeNamespace,
          labels: {
            [customObjectLabel]: 'exceptions',
            'app.kubernetes.io/name': exceptionGroup.name,
            'app.kubernetes.io/managed-by': 'headlamp',
          },
        },
        data: {},
      };
      updateConfigMapData(configMapNew);
      const configMapUpdated = await post(
        `/api/v1/namespaces/${configMapNew.metadata.namespace}/configmaps`,
        configMapNew
      );
      setConfigMap(configMapUpdated);
    } else {
      updateConfigMapData(configMap);
      const configMapUpdated = await patch(
        `/api/v1/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`,
        configMap
      );
      setConfigMap(configMapUpdated);
    }
    enqueueSnackbar(`${exceptionGroup.name} saved successfully`, { variant: 'success' });
    setErrorMessage('');
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
      setExceptionPolicies(policies);
      enqueueSnackbar(`${fileData.name} imported successfully`, { variant: 'success' });
    }
  };

  const handleDownload = () => {
    exceptionPolicies.forEach(policy => {
      policy.policyType = 'postureExceptionPolicy';
      policy.actions = ['alertOnly'];
    });

    saveToFile(
      JSON.stringify(exceptionPolicies, null, 2),
      `${exceptionGroup.name}.json`,
      enqueueSnackbar
    );
  };

  return (
    <SectionBox backLink>
      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Policy Exceptions
        </Typography>
        <Tooltip title="Save policy exceptions as a Configmap in k8s cluster">
          <IconButton onClick={() => handleSave()}>
            <Icon icon="mdi:database" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Save policy exceptions to file">
          <IconButton onClick={() => handleDownload()}>
            <Icon icon="mdi:content-save" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Load existing policy exceptions from file">
          <IconButton onClick={() => handleImport()}>
            <Icon icon="mdi:file-import" />
          </IconButton>
        </Tooltip>
      </Stack>
      {errorMessage && <ErrorContainer> {errorMessage} </ErrorContainer>}
      <NameValueTable
        rows={[
          {
            name: 'Name',
            value: (
              <TextField
                placeholder="Enter Group Name"
                id="name"
                variant="outlined"
                value={exceptionGroup.name}
                onChange={event =>
                  setExceptionGroup({ ...exceptionGroup, name: event.target.value })
                }
              />
            ),
          },
          {
            name: 'Description',
            value: (
              <TextField
                placeholder="Enter Description"
                id="description"
                fullWidth
                variant="outlined"
                value={exceptionGroup?.description ?? ''}
                onChange={event => {
                  setExceptionGroup({ ...exceptionGroup, description: event.target.value });
                }}
              />
            ),
          },
          {
            name: 'Configmap',
            value: configMap?.metadata.name && (
              <HeadlampLink
                routeName="configmap"
                params={{
                  namespace: kubeScapeNamespace,
                  name: configMap?.metadata.name,
                }}
              >
                {configMap?.metadata.name}
              </HeadlampLink>
            ),
          },
          {
            name: 'Management Cluster',
            value: getCluster(),
          },
        ]}
      />

      <ExceptionPolicies
        exceptionPolicies={exceptionPolicies}
        setExceptionPolicies={setExceptionPolicies}
      />
    </SectionBox>
  );
}

function ExceptionPolicies(
  props: Readonly<{
    exceptionPolicies: ExceptionPolicy[];
    setExceptionPolicies: Function;
  }>
) {
  const { exceptionPolicies, setExceptionPolicies } = props;

  const [ConfirmationDialog, confirm] = useConfirm(
    'Reset Policies',
    'Are you sure you want to reset policies to default?'
  );

  const handleAddRow = () => {
    const defaultPolicyName = 'new-policy';
    let maxNum = 0;
    exceptionPolicies.forEach(policy => {
      if (policy.name.startsWith(defaultPolicyName)) {
        const num = parseInt(policy.name.replace(defaultPolicyName + '-', ''));
        if (!num) maxNum++;
        maxNum = num > maxNum ? num : maxNum;
      }
    });

    const policyName = maxNum > 0 ? `${defaultPolicyName}-${maxNum + 1}` : defaultPolicyName;
    exceptionPolicies.push({
      name: policyName,
      creationTime: new Date(),
    } as ExceptionPolicy);
    setExceptionPolicies([...exceptionPolicies]);
  };

  const handleDelete = (policy: ExceptionPolicy) => {
    exceptionPolicies.splice(exceptionPolicies.indexOf(policy), 1);
    setExceptionPolicies([...exceptionPolicies]);
  };

  const handleReset = async () => {
    const ok = await confirm();
    if (ok) {
      const policies = defaultPostureExceptionPolicies.map((policy: ExceptionPolicy) => {
        return { ...policy, creationTime: new Date() };
      });
      setExceptionPolicies(policies);
    }
  };

  return (
    <>
      {(ConfirmationDialog as () => React.ReactNode)()}
      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Exceptions
        </Typography>
        <Tooltip title="Add a new policy exception">
          <IconButton onClick={() => handleAddRow()}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset policy exceptions to default">
          <IconButton onClick={() => handleReset()}>
            <Icon icon="mdi:restart" />
          </IconButton>
        </Tooltip>
      </Stack>
      <HeadlampTable
        data={exceptionPolicies}
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
            accessorFn: (policy: ExceptionPolicy) => displayMatchers(policy.resources),
            gridTemplate: 'auto',
          },
          {
            header: 'Policy matchers',
            accessorFn: (policy: ExceptionPolicy) => displayMatchers(policy.posturePolicies),
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
            accessorFn: (policy: ExceptionPolicy) => (
              <>
                <EditPosturePolicyExceptionDialog
                  exception={policy}
                  onUpdate={(name, updatedException) => {
                    const updatedExceptions = exceptionPolicies.map(exception =>
                      exception.name === name ? updatedException : exception
                    );
                    setExceptionPolicies(updatedExceptions);
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
    </>
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

const defaultPostureExceptionPolicies: ExceptionPolicy[] = [
  {
    name: 'ignore-system-namespaces',
    policyType: 'postureExceptionPolicy',
    actions: ['alertOnly'],
    resources: [
      {
        designatorType: 'Attributes',
        attributes: {
          namespace: '^kubescape$|^kube-system$|^kube-public$|^kube-node-lease$',
        },
      },
    ],
  },
];
