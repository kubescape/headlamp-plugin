/* 
  Build a horizontack stack with seperate cells for critical, high, medium, low, negligible and unknown. 
*/
import { Box, Stack, Tooltip } from '@mui/material';

export function getCVESummary(
  configurationScanSummary: any,
  showUnknown: boolean,
  showNegligible: boolean,
  relevant: boolean = false
) {
  const severities = configurationScanSummary?.spec.severities;

  const criticalCount = relevant ? severities.critical.relevant : severities.critical.all;
  const highCount = relevant ? severities.high.relevant : severities.high.all;
  const mediumCount = relevant ? severities.medium.relevant : severities.medium.all;
  const lowCount = relevant ? severities.low.relevant : severities.low.all;
  const negligibleCount = relevant ? severities.negligible.relevant : severities.negligible.all;
  const unknownCount = relevant ? severities.unknown.relevant : severities.unknown.all;

  function box(color: string, severity: string, countScan: number | undefined) {
    return (
      <Box
        sx={{
          borderLeft: 2,
          borderTop: 1,
          borderRight: 1,
          borderBottom: 1,
          borderColor: `gray gray gray ${color}`,
          textAlign: 'center',
          width: 100,
        }}
      >
        <Tooltip title={severity}>
          <Box>
            {countScan ?? 0} {severity}
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {box('purple', 'Critical', criticalCount)}
      {box('red', 'High', highCount)}
      {box('orange', 'Medium', mediumCount)}
      {box('yellow', 'Low', lowCount)}
      {showNegligible ? box('darkgray', 'Negligible', negligibleCount) : ''}
      {showUnknown ? box('lightgray', 'Unknown', unknownCount) : ''}
    </Stack>
  );
}
