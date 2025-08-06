import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  Stack,
} from '@mui/material';
import React from 'react';
import { kubescapeConfigStore } from '../common/config-store';
import { defaultFrameworkNames, FrameWork, frameworks } from '../rego';
import { configurationScanContext } from './Compliance';
import { frameworkComplianceScore } from './workload-scanning';

export function FrameworkButtons(
  props: Readonly<{
    frameworkName: string;
    customFrameworks: FrameWork[];
  }>
) {
  const { frameworkName, customFrameworks } = props;
  function frameworkChange(event: React.ChangeEvent<HTMLInputElement>, value: string) {
    kubescapeConfigStore.update({ framework: value });
  }

  const selectedFrameworkNames =
    (kubescapeConfigStore.get().activeFrameworks as string[]) ?? defaultFrameworkNames;

  const labels: JSX.Element[] = [];

  selectedFrameworkNames
    .toSorted((a, b) => a.localeCompare(b))
    .forEach(name => {
      const framework =
        frameworks.find(fw => fw.name === name) ?? customFrameworks?.find(fw => fw.name === name);
      if (framework) {
        const percentage = configurationScanContext.workloadScans
          ? Math.trunc(frameworkComplianceScore(configurationScanContext.workloadScans, framework))
          : 0;
        labels.push(
          <FormControlLabel
            key={name}
            value={name}
            control={<Radio />}
            label={
              <Stack direction="row" spacing={1}>
                <Box sx={{ color: '#add8e6', fontWeight: 'heavy' }}>{percentage}%</Box>
                <Box>{name}</Box>
              </Stack>
            }
          />
        );
      }
    });

  const frameworkNames: string[] = frameworks
    .map(framework => framework.name)
    .concat(customFrameworks.map(framework => framework.name))
    .sort((a, b) => a.localeCompare(b));

  const handleChange = (event: SelectChangeEvent<typeof selectedFrameworkNames>) => {
    const {
      target: { value },
    } = event;

    const values = typeof value === 'string' ? value.split(',') : value;

    kubescapeConfigStore.update({ activeFrameworks: values });
  };

  return (
    <>
      <FormControl>
        <RadioGroup
          row
          value={frameworkName}
          name="row-radio-buttons-group"
          onChange={frameworkChange}
        >
          <FormControlLabel value="" control={<Radio />} label="Show all" />
          {labels}
        </RadioGroup>
      </FormControl>
      <FormControl variant="filled" sx={{ m: 1, minWidth: 160 }} size="small">
        <InputLabel id="select-label" sx={{ height: 40 }}>
          Frameworks
        </InputLabel>
        <Select
          labelId="select-label"
          id="simple-select"
          label="Frameworks"
          sx={{ height: 40, width: 160 }}
          value={selectedFrameworkNames}
          multiple
          onChange={handleChange}
          renderValue={() => ''}
          input={<OutlinedInput label="Frameworks" />}
        >
          {frameworkNames.map(frameworkName => (
            <MenuItem key={frameworkName} value={frameworkName}>
              <Checkbox checked={selectedFrameworkNames.includes(frameworkName)} />
              <ListItemText primary={frameworkName} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
}
