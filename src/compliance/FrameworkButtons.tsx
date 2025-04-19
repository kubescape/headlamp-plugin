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
import { KubescapeSettings, useLocalStorage } from '../common/localStorage';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import {
  configurationScanContext,
  controlComplianceScore,
  filterWorkloadScanData,
} from './Compliance';
import { FrameWork } from './FrameWork';
import { frameworks } from './frameworks';

export function FrameworkButtons(
  props: Readonly<{
    frameworkName: string;
    setFrameworkName: React.Dispatch<React.SetStateAction<string>>;
  }>
) {
  const { frameworkName, setFrameworkName } = props;
  function frameworkChange(event: React.ChangeEvent<HTMLInputElement>, value: string) {
    setFrameworkName(value);
  }

  const defaultFrameworkNames = ['AllControls', 'cis-v1.10.0', 'MITRE', 'NSA'];

  const [selectedFrameworkNames, setSelectedFrameworkNames] = useLocalStorage<string[]>(
    KubescapeSettings.FrameworkNames,
    defaultFrameworkNames
  );

  const labels: JSX.Element[] = [];

  selectedFrameworkNames
    .toSorted((a, b) => a.localeCompare(b))
    .forEach(name => {
      const framework = frameworks.find(fw => fw.name === name);
      if (framework) {
        const workloadScanData = filterWorkloadScanData(
          configurationScanContext.workloadScans,
          framework
        );
        const percentage = workloadScanData
          ? Math.trunc(frameworkComplianceScore(workloadScanData, framework))
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
    .sort((a, b) => a.localeCompare(b));

  const handleChange = (event: SelectChangeEvent<typeof selectedFrameworkNames>) => {
    const {
      target: { value },
    } = event;
    setSelectedFrameworkNames(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value
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
