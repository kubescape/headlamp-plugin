import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { ApiError, post, put } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  NameValueTable,
  SectionBox,
  StatusLabel,
  StatusLabelProps,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { ErrorContainer } from '../common/ErrorContainer';
import { ErrorMessage } from '../common/ErrorMessage';
import { saveToFile } from '../common/filedialog';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { getItemFromSessionStorage, KubescapeSettings } from '../common/sessionStorage';
import { getURLSegments } from '../common/url';
import { complianceSeverity } from '../compliance/Compliance';
import { checkUniqueness } from '../custom-objects/api-queries';
import { customObjectLabel } from '../model';
import { Control, controls, defaultFrameworkNames, FrameWork, frameworks, Rule } from '../rego';

declare global {
  interface Window {
    showSaveFilePicker: any;
    showOpenFilePicker: any;
  }
}

export function FrameworkNew() {
  const kubeScapeNamespace = getItemFromSessionStorage<string>(
    KubescapeSettings.KubescapeNamespace
  );
  if (!kubeScapeNamespace)
    return <ErrorMessage error={new ApiError('Kubescape namespace not found')} />;

  return (
    <FrameworkEditor
      framework={{ name: '', controls: [] }}
      kubeScapeNamespace={kubeScapeNamespace}
    />
  );
}

export function FrameworkEdit() {
  const [configMapName] = getURLSegments(-1);
  const kubeScapeNamespace = getItemFromSessionStorage<string>(
    KubescapeSettings.KubescapeNamespace
  );
  if (!kubeScapeNamespace)
    return <ErrorMessage error={new ApiError('Kubescape namespace not found')} />;

  const [configMap] = K8s.ResourceClasses.ConfigMap.useGet(configMapName, kubeScapeNamespace);

  if (configMap) {
    const controlsIDs: string[] = JSON.parse(configMap.jsonData.data.controlsIDs);

    const framework = {
      name: configMap?.jsonData.data.name,
      description: configMap?.jsonData.data.description,
      controls: controls.filter(c => controlsIDs?.some(controlID => controlID === c.controlID)),
    };
    return (
      <FrameworkEditor
        framework={framework}
        configMap={configMap?.jsonData}
        kubeScapeNamespace={kubeScapeNamespace}
      />
    );
  }

  return <></>;
}

function FrameworkEditor(
  props: Readonly<{ framework: FrameWork; configMap?: KubeConfigMap; kubeScapeNamespace: string }>
) {
  const { kubeScapeNamespace } = props;
  const [configMap, setConfigMap] = useState<KubeConfigMap | undefined>(props.configMap);
  const [framework, setFramework] = useState<FrameWork>(props.framework);
  const [frameworkControls, setFrameworkControls] = useState<Control[]>(props.framework.controls);
  const { enqueueSnackbar } = useSnackbar();
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSave = async () => {
    if (!framework.name) {
      return setErrorMessage('Name must not be empty');
    }
    if (!/^[a-z0-9]([-a-z0-9 ]*[a-z0-9])?$/.test(framework.name.toLocaleLowerCase())) {
      return setErrorMessage(
        'Only lettters, numbers, spaces and dashes are allowed in the name (e.g. "Dev Framework")'
      );
    }
    if (!frameworkControls || frameworkControls.length === 0) {
      return setErrorMessage('Select one or more controls');
    }
    if (!(await checkUniqueness(framework.name, configMap?.metadata.uid, 'framework'))) {
      return setErrorMessage('Please provide a unique name for the framework.');
    }

    function updateConfigMapData(configMap: KubeConfigMap) {
      configMap.data = {
        name: framework.name,
        description: framework.description ?? '',
        controlsIDs: JSON.stringify(frameworkControls.map(c => c.controlID)),
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
          name: `${framework.name.replace(' ', '')?.toLocaleLowerCase()}-framework-${randomSuffix}`,
          namespace: kubeScapeNamespace,
          labels: {
            [customObjectLabel]: 'framework',
            'app.kubernetes.io/name': framework.name,
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
      const configMapUpdated = await put(
        `/api/v1/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`,
        configMap
      );
      setConfigMap(configMapUpdated);
    }
    enqueueSnackbar(`${framework.name} saved successfully`, { variant: 'success' });
    setErrorMessage('');
  };

  const handleDownload = () => {
    const frameworkForDownload = {
      ...framework,
      controlsIDs: frameworkControls.map(c => c.controlID),
    } as FrameWork;

    const regoRulesUrl = getKubescapePluginUrl() + '/rego-rules.json';
    fetch(regoRulesUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP status: ${response.status}`);
        }
        return response.text();
      })
      .then(json => {
        const rules = JSON.parse(json) as Rule[];
        frameworkForDownload.controls.forEach(c => {
          c.rules = rules.filter(r => c.rulesNames?.some(ruleName => ruleName === r.name));
        });
        saveToFile(
          JSON.stringify(frameworkForDownload, null, 2),
          `${framework.name}.json`,
          enqueueSnackbar
        );
      })
      .catch(error => {
        console.error('Error fetching rego rules:', error);
        enqueueSnackbar(`Error fetching rego rules: ${error.message}`, { variant: 'error' });
      });
  };

  return (
    <SectionBox backLink>
      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Custom Framework
        </Typography>
        <Tooltip title="Save policy as a Configmap in k8s cluster">
          <IconButton onClick={() => handleSave()}>
            <Icon icon="mdi:database" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Download custom framework file">
          <IconButton onClick={() => handleDownload()}>
            <Icon icon="mdi:file-download" />
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
                placeholder="Enter Framework Name"
                id="name"
                variant="outlined"
                value={framework.name}
                onChange={event => setFramework({ ...framework, name: event.target.value })}
              />
            ),
          },
          {
            name: 'Description',
            value: (
              <TextField
                placeholder="Enter Framework Description"
                id="description"
                fullWidth
                variant="outlined"
                value={framework?.description ?? ''}
                onChange={event => {
                  setFramework({ ...framework, description: event.target.value });
                }}
              />
            ),
          },
          {
            name: 'Management Cluster',
            value: getCluster(),
          },
        ]}
      />
      <Controls frameworkControls={frameworkControls} setFrameworkControls={setFrameworkControls} />
    </SectionBox>
  );
}

function Controls(
  props: Readonly<{ frameworkControls: Control[]; setFrameworkControls: Function }>
) {
  const { frameworkControls, setFrameworkControls } = props;
  const [showSelectedControls, setShowSelectedControls] = useState(false);
  const [selectedFrameworkNames, setSelectedFrameworkNames] = useState(defaultFrameworkNames);
  const [sorting, setSorting] = useState({ column: 'controlID', direction: 'asc' });

  const theme = useTheme();

  const filteredControls = filterControls(
    frameworkControls,
    showSelectedControls,
    selectedFrameworkNames,
    sorting
  );

  /**
   * Handles the selection or deselection of all controls.
   * @param event - The change event from the checkbox input.
   */
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setFrameworkControls(filteredControls);
    } else {
      setFrameworkControls([]);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>, control: Control) => {
    if (event.target.checked) {
      setFrameworkControls([...frameworkControls, control]);
    } else {
      setFrameworkControls(frameworkControls.filter(c => c.controlID !== control.controlID));
    }
  };

  const handleFrameworkChange = (event: SelectChangeEvent<typeof selectedFrameworkNames>) => {
    const {
      target: { value },
    } = event;

    const values = typeof value === 'string' ? value.split(',') : value;

    if (values.includes('all')) {
      if (values.length >= frameworks.length) {
        setSelectedFrameworkNames([]);
      } else {
        setSelectedFrameworkNames(frameworks.map(f => f.name));
      }
    } else {
      setSelectedFrameworkNames(values);
    }
  };

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSorting({ column: field, direction });
  };

  return (
    <SectionBox title="Controls">
      <Stack direction="row" spacing={6} sx={{ marginBottom: '20px' }}>
        <FormControlLabel
          sx={{ minWidth: 160, marginRight: '120px' }}
          checked={showSelectedControls}
          control={<Switch color="primary" />}
          label={'Selected controls'}
          onChange={(event: any, checked: boolean) => {
            setShowSelectedControls(checked);
          }}
        />
        <FormControl variant="filled" sx={{ minWidth: 160 }} size="small">
          <InputLabel id="select-label">Frameworks</InputLabel>
          <Select
            labelId="select-label"
            id="simple-select"
            label="Frameworks"
            value={selectedFrameworkNames}
            multiple
            onChange={handleFrameworkChange}
            renderValue={() => ''}
            input={<OutlinedInput label="Frameworks" />}
          >
            <MenuItem key="all" value="all">
              <Checkbox checked={selectedFrameworkNames.length === frameworks.length} />
            </MenuItem>
            {frameworks.map(f => (
              <MenuItem key={f.name} value={f.name}>
                <Checkbox checked={selectedFrameworkNames.includes(f.name)} />
                <ListItemText primary={f.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHead>
          <TableRow key="header">
            <TableCell
              height={10}
              sx={{
                width: `5%`,
                verticalAlign: 'middle',
                backgroundColor: theme.palette.background.default,
              }}
            >
              <Checkbox
                checked={filteredControls.length === frameworkControls.length}
                onChange={event => handleSelectAll(event)}
              />
            </TableCell>
            <HeaderCell title="ID" width="10%" field="controlID" onSort={handleSort} />
            <HeaderCell title="Control Name" field="name" onSort={handleSort} width="20%" />
            <HeaderCell title="Category" field="" width="15%" />
            <HeaderCell title="Frameworks" field="" width="20%" />
            <HeaderCell title="Severity" field="baseScore" onSort={handleSort} width="10%" />
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredControls.map(control => (
            <TableRow key={control.controlID}>
              <TableCell>
                <Checkbox
                  checked={frameworkControls.some(c => c.controlID === control.controlID)}
                  onChange={event => handleCheckboxChange(event, control)}
                />
              </TableCell>
              <TableCell>
                <Link
                  target="_blank"
                  href={`https://hub.armosec.io/docs/${control.controlID.toLowerCase()}`}
                >
                  {control.controlID}
                </Link>
              </TableCell>
              <TableCell>{control.name}</TableCell>
              <TableCell>{control.category?.subCategory?.name ?? control.category?.name}</TableCell>
              <TableCell>
                {frameworks
                  .filter(f => f.controls.some((c: Control) => c.controlID === control.controlID))
                  .map(f => f.name)
                  .sort((a, b) => a.localeCompare(b))
                  .join(', ')}
              </TableCell>
              <TableCell>{severityLabel(control.baseScore)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionBox>
  );
}

function HeaderCell(
  props: Readonly<{
    title: string;
    width: string;
    field: string;
    onSort?: (field: string, direction: 'asc' | 'desc') => void;
  }>
) {
  const { title, width, field, onSort } = props;
  const theme = useTheme();

  return (
    <TableCell
      sx={{
        width: `${width}`,
        verticalAlign: 'middle',
        backgroundColor: theme.palette.background.default,
        color: 'white',
        cursor: 'pointer',
      }}
    >
      {title}

      <IconButton
        sx={{ padding: 0 }}
        onClick={() => {
          onSort && onSort(field, 'desc');
        }}
      >
        {onSort && (
          <Box sx={{ fontSize: 16 }}>
            <Icon icon="mdi:arrow-down" />
          </Box>
        )}
      </IconButton>

      <IconButton
        sx={{ padding: 0, margin: '-4px' }}
        onClick={() => {
          onSort && onSort(field, 'asc');
        }}
      >
        {onSort && (
          <Box sx={{ fontSize: 16 }}>
            <Icon icon="mdi:arrow-up" />
          </Box>
        )}
      </IconButton>
    </TableCell>
  );
}

function filterControls(
  frameworkControls: Control[],
  showSelectedControls: boolean,
  selectedFrameworkNames: string[],
  sorting: { column: string; direction: string }
) {
  controls.sort((a, b) => a.controlID.localeCompare(b.controlID));
  let filteredControls = showSelectedControls ? frameworkControls : controls;

  filteredControls = filteredControls.filter(control =>
    frameworks.some(
      f =>
        selectedFrameworkNames?.includes(f.name) &&
        f.controls.some(c2 => c2.controlID === control.controlID)
    )
  );
  return filteredControls.sort((a, b) => {
    const aValue = (a as any)[sorting.column];
    const bValue = (b as any)[sorting.column];
    if (sorting.direction === 'asc') {
      return typeof aValue === 'string' ? aValue?.localeCompare(bValue) : aValue - bValue;
    } else {
      return typeof bValue === 'string' ? bValue?.localeCompare(aValue) : bValue - aValue;
    }
  });
}

function severityLabel(baseScore: number) {
  const severity = complianceSeverity(baseScore);
  let status: StatusLabelProps['status'] = '';

  if (severity === 'High' || severity === 'Critical') {
    status = 'error';
  }

  return <StatusLabel status={status}>{severity}</StatusLabel>;
}
