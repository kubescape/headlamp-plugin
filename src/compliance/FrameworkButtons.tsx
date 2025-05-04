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
import { KubescapeSettings, useLocalStorage } from '../common/webStorage';
import { defaultFrameworkNames, FrameWork, frameworks } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext } from './Compliance';
import { controlComplianceScore, filterWorkloadScanData } from './workload-scanning';

export function FrameworkButtons(
  props: Readonly<{
    frameworkName: string;
    customFrameworks: FrameWork[];
    setFrameworkName: React.Dispatch<React.SetStateAction<string>>;
  }>
) {
  const { frameworkName, customFrameworks, setFrameworkName } = props;
  function frameworkChange(event: React.ChangeEvent<HTMLInputElement>, value: string) {
    setFrameworkName(value);
  }

  const [selectedFrameworkNames, setSelectedFrameworkNames] = useLocalStorage<string[]>(
    KubescapeSettings.FrameworkNames,
    defaultFrameworkNames
  );

  const labels: JSX.Element[] = [];

  selectedFrameworkNames
    .toSorted((a, b) => a.localeCompare(b))
    .forEach(name => {
      const framework =
        frameworks.find(fw => fw.name === name) ?? customFrameworks?.find(fw => fw.name === name);
      if (framework) {
        const [filteredWorkloadScans] = filterWorkloadScanData(
          configurationScanContext.workloadScans,
          framework
        );
        const percentage = filteredWorkloadScans
          ? Math.trunc(frameworkComplianceScore(filteredWorkloadScans, framework))
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

    // Save the updated configuration to the store
    setSelectedFrameworkNames(
      values.filter(
        frameworkName =>
          frameworks.some(fw => fw.name === frameworkName) ||
          customFrameworks.some(fw => fw.name === frameworkName)
      )
    );
  };

  return (
    <>
      <FormControl>
        <RadioGroup
          row
          defaultValue={frameworkName}
          name="row-radio-buttons-group"
          onChange={frameworkChange}
        >
          {labels}
        </RadioGroup>
      </FormControl>
      <FormControl variant="filled" sx={{ m: 1, minWidth: 160 }} size="small">
        <InputLabel id="select-label">Frameworks</InputLabel>
        <Select
          labelId="select-label"
          id="simple-select"
          label="Frameworks"
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

// The framework compliance score provides an overall assessment of your cluster's compliance with a specific framework.
// It is calculated by averaging the Control Compliance Scores of all controls within the framework.
// https://kubescape.io/docs/frameworks-and-controls/frameworks/
function frameworkComplianceScore(
  workloadScanData: WorkloadConfigurationScanSummary[],
  framework: FrameWork
) {
  const controlComplianceScores = framework.controls.map(control =>
    controlComplianceScore(workloadScanData, control)
  );

  return controlComplianceScores.reduce((a, b) => a + b, 0) / controlComplianceScores.length;
}
