import { FormControl, MenuItem, Stack, TextField } from '@mui/material';
import * as yaml from 'js-yaml';
import { useContext, useEffect, useState } from 'react';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { ValidatingAdmissionPolicy } from '../types/ValidatingAdmissionPolicy';
import { CurrentEvalContext } from './ValidatingAdmissionPolicy';

export function ChoosePolicyButton() {
  const { setValidatingAdmissionPolicy } = useContext<any>(CurrentEvalContext);
  const [policies, setKubescapeValidatingAdmissionPolicies] = useState<ValidatingAdmissionPolicy[]>(
    []
  );

  useEffect(() => {
    const kubescapeValidatingAdmissionPoliciesURL =
      getKubescapePluginUrl() + '/validating-admission-policies.yaml';
    fetch(kubescapeValidatingAdmissionPoliciesURL)
      .then(response => response.text())
      .then(data =>
        setKubescapeValidatingAdmissionPolicies(yaml.loadAll(data) as ValidatingAdmissionPolicy[])
      );
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedValue(event.target.value);
    setValidatingAdmissionPolicy(
      policies?.find(policy => policy.metadata.name === event.target.value)
    );
  };

  const [selectedValue, setSelectedValue] = useState('');

  return (
    <Stack direction="row" spacing={0}>
      <FormControl variant="outlined" sx={{ width: 600 }}>
        <TextField
          select
          value={selectedValue}
          onChange={handleChange}
          label="Choose Sample Policy"
        >
          {policies?.map((policy, indx) => (
            <MenuItem key={indx} value={policy.metadata.name}>
              {policy.metadata.name}
            </MenuItem>
          ))}
        </TextField>
      </FormControl>
    </Stack>
  );
}
