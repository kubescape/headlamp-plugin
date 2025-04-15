import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Stack } from '@mui/material';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { configurationScanContext, countScans, filterWorkloadScanData } from './Compliance';
import { FrameWork } from './FrameWork';
import { frameworks } from './frameworks';

export function FrameworkButtons(
  props: Readonly<{
    setFramework: React.Dispatch<React.SetStateAction<FrameWork>>;
  }>
) {
  const { setFramework } = props;
  function frameworkChange(event: React.ChangeEvent<HTMLInputElement>, value: string) {
    const f = frameworks.find(fw => fw.name === value);
    setFramework(f ?? frameworks[0]);
  }

  const frameworkNames = {
    'All controls': 'AllControls',
    'CIS v1.10': 'cis-v1.10.0',
    MITRE: 'MITRE',
    NSA: 'NSA',
  };
  const labels: JSX.Element[] = [];

  Object.entries(frameworkNames).forEach(([frameworkLabel, frameworkName]) => {
    const framework = frameworks.find(fw => fw.name === frameworkName);
    if (framework) {
      const workloadScanData = filterWorkloadScanData(
        configurationScanContext.workloadScans,
        framework
      );
      const percentage = workloadScanData
        ? Math.trunc(calculateComplianceScore(workloadScanData, framework))
        : 0;
      labels.push(
        <FormControlLabel
          key={frameworkName}
          value={frameworkName}
          control={<Radio />}
          label={
            <Stack direction="row" spacing={1}>
              <Box sx={{ color: '#add8e6', fontWeight: 'heavy' }}>{percentage}%</Box>
              <Box>{frameworkLabel}</Box>
            </Stack>
          }
        />
      );
    }
  });

  return (
    <FormControl>
      <RadioGroup
        row
        defaultValue="AllControls"
        aria-labelledby="demo-row-radio-buttons-group-label"
        name="row-radio-buttons-group"
        onChange={frameworkChange}
      >
        {labels}
      </RadioGroup>
    </FormControl>
  );
}

// The framework compliance score provides an overall assessment of your cluster's compliance with a specific framework.
// It is calculated by averaging the Control Compliance Scores of all controls within the framework.
// https://kubescape.io/docs/frameworks-and-controls/frameworks/
function calculateComplianceScore(
  workloadScanData: WorkloadConfigurationScanSummary[],
  framework: FrameWork
) {
  const controlComplianceScores: number[] = [];
  for (const control of framework.controls) {
    // The control compliance score measures the compliance of individual controls within a framework.
    // It is calculated by evaluating the ratio of resources that passed to the total number of resources evaluated against that control.
    const failCount = countScans(workloadScanData, control, 'failed');
    const passedCount = countScans(workloadScanData, control, 'passed');
    const total = failCount + passedCount;
    const controlCompliance = total > 0 ? (passedCount / total) * 100 : 100;
    controlComplianceScores.push(controlCompliance);
  }
  return controlComplianceScores.reduce((a, b) => a + b, 0) / controlComplianceScores.length;
}
