import { ShowHideLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { TabContext, TabList } from '@mui/lab';
import { Box, Tab, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useState } from 'react';
import { TabPanel } from '../common/TabPanel';

interface EvalResult {
  index: number;
  name: string;
  expression: string;
  result: string | boolean;
  error: string;
  message: string;
}

interface EvaluationResults {
  variables: EvalResult[];
  matchConditions: EvalResult[];
  matchConstraints: boolean;
  validations: EvalResult[];
  auditAnnotations: EvalResult[];
}

export function EvaluationResultsTables(props: { evaluationResult: EvaluationResults | null }) {
  const { evaluationResult } = props;
  const [tabValue, setTabValue] = useState(3);

  if (!evaluationResult?.matchConstraints) {
    return <p>The resource does not match.</p>;
  }
  const valid = evaluationResult?.validations?.filter(v => v.result !== true).length === 0;
  const error = evaluationResult?.validations?.filter(v => v.error).length > 0;

  if (valid && !error) {
    return <p>The resource is valid.</p>;
  }
  return (
    <TabContext value={tabValue}>
      <TabList
        onChange={(event: React.SyntheticEvent, newValue: number) => {
          setTabValue(newValue);
        }}
      >
        <Tab label="Variables" disabled={!evaluationResult?.variables} value={1} />
        <Tab label="Match Conditions" disabled={!evaluationResult?.matchConditions} value={2} />
        <Tab label="Validations" disabled={!evaluationResult?.validations} value={3} />
        <Tab label="Audit Annotations" disabled={!evaluationResult?.auditAnnotations} value={4} />
      </TabList>

      <TabPanel value={1}>
        <EvaluationResult results={evaluationResult?.variables} />
      </TabPanel>
      <TabPanel value={2}>
        <EvaluationResult results={evaluationResult?.matchConditions} />
      </TabPanel>
      <TabPanel value={3}>
        <EvaluationResult results={evaluationResult?.validations} />
      </TabPanel>
      <TabPanel value={4}>
        <EvaluationResult results={evaluationResult?.auditAnnotations} />
      </TabPanel>
    </TabContext>
  );
}

function EvaluationResult(props: { results: EvalResult[] }) {
  const { results } = props;

  const bgColor = localStorage.headlampThemePreference === 'dark' ? 'black' : 'white';

  return (
    <Box sx={{ pt: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: bgColor }}>
            <TableCell>Name</TableCell>
            <TableCell>Expression</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Message</TableCell>
            <TableCell>Error</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results?.map(result => (
            <TableRow key={result.name}>
              <TableCell style={{ width: '10%' }} component="th" scope="row">
                {result.name}
              </TableCell>
              <TableCell style={{ width: '25%' }}>
                <ShowHideLabel>{result.expression}</ShowHideLabel>
              </TableCell>
              <TableCell style={{ width: '20%' }}>{result.result?.toString()}</TableCell>
              <TableCell style={{ width: '25%' }}>{result.message}</TableCell>
              <TableCell style={{ width: '20%' }}>{result.error}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
