import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import {
  Autocomplete,
  FormControl,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import * as yaml from 'js-yaml';
import { useContext, useEffect, useState } from 'react';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { fetchResource, listResources, resourceKinds, ResourceRef } from './clusterResources';
import { CurrentEvalContext } from './ValidatingAdmissionPolicy';

export function ChooseTestResource() {
  const [source, setSource] = useState<'samples' | 'cluster'>('samples');

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <ToggleButtonGroup
        size="small"
        exclusive
        value={source}
        onChange={(_, value) => value && setSource(value)}
        aria-label="Test resource source"
      >
        <ToggleButton value="samples">Samples</ToggleButton>
        <ToggleButton value="cluster">From cluster</ToggleButton>
      </ToggleButtonGroup>
      {source === 'samples' ? <ChooseSampleResource /> : <ChooseClusterResource />}
    </Stack>
  );
}

function ChooseSampleResource() {
  const { setResource } = useContext<any>(CurrentEvalContext);
  const [testFiles, setTestFiles] = useState<unknown[]>([]);
  const [testFileNames, setTestFileNames] = useState<string[]>([]);

  useEffect(() => {
    getKubescapePluginUrl().then(baseUrl => {
      fetch(baseUrl + '/vap-test-files.yaml')
        .then(response => response.text())
        .then(data => setTestFiles(yaml.loadAll(data)));
      fetch(baseUrl + '/vap-test-files-index.yaml')
        .then(response => response.text())
        .then(data => setTestFileNames(data.split(/\r?\n/)));
    });
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedValue(event.target.value);

    const indx = testFileNames.findIndex(testFile => testFile === event.target.value);
    setResource(testFiles[indx]);
  };

  const [selectedValue, setSelectedValue] = useState('');

  return (
    <FormControl variant="outlined" sx={{ width: 480 }}>
      <TextField select value={selectedValue} onChange={handleChange} label="Choose Test Resource">
        {testFileNames.map((fileName, indx) => (
          <MenuItem key={indx} value={fileName}>
            {fileName}
          </MenuItem>
        ))}
      </TextField>
    </FormControl>
  );
}

function refLabel(ref: ResourceRef) {
  return ref.namespace ? `${ref.namespace}/${ref.name}` : ref.name;
}

/** Picks an object of the current cluster as the test resource. */
function ChooseClusterResource() {
  const { setResource } = useContext<any>(CurrentEvalContext);
  const [kind, setKind] = useState('Deployment');
  const [refs, setRefs] = useState<ResourceRef[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ResourceRef | null>(null);

  useEffect(() => {
    let active = true;
    setRefs(null);
    setSelected(null);
    setError('');
    listResources(kind, getAllowedNamespaces())
      .then(found => active && setRefs(found))
      .catch(err => {
        if (!active) return;
        setRefs([]);
        setError(`Unable to list ${resourceKinds[kind].plural}: ${err?.message ?? err}`);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  const choose = (ref: ResourceRef | null) => {
    setSelected(ref);
    if (!ref) return;
    fetchResource(kind, ref)
      .then(object => setResource(object))
      .catch(err => setError(`Unable to read ${refLabel(ref)}: ${err?.message ?? err}`));
  };

  return (
    <>
      <TextField
        select
        label="Kind"
        value={kind}
        onChange={event => setKind(event.target.value)}
        sx={{ width: 170 }}
      >
        {Object.keys(resourceKinds).map(name => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </TextField>
      <Autocomplete
        sx={{ width: 300 }}
        options={refs ?? []}
        loading={refs === null}
        value={selected}
        onChange={(_, ref) => choose(ref)}
        getOptionLabel={refLabel}
        isOptionEqualToValue={(a, b) => refLabel(a) === refLabel(b)}
        renderInput={params => (
          <TextField
            {...params}
            label={resourceKinds[kind].namespaced ? 'Namespace/name' : 'Name'}
            error={!!error}
            helperText={error}
          />
        )}
      />
    </>
  );
}
