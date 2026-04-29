import { FormControl, MenuItem, Stack, TextField } from '@mui/material';
import * as yaml from 'js-yaml';
import { useContext, useEffect, useState } from 'react';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { CurrentEvalContext } from './ValidatingAdmissionPolicy';

export function ChooseTestResource() {
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
    <Stack direction="row" spacing={0}>
      <FormControl variant="outlined" sx={{ width: 600 }}>
        <TextField
          select
          value={selectedValue}
          onChange={handleChange}
          label="Choose Test Resource"
        >
          {testFileNames.map((fileName, indx) => (
            <MenuItem key={indx} value={fileName}>
              {fileName}
            </MenuItem>
          ))}
        </TextField>
      </FormControl>
    </Stack>
  );
}
