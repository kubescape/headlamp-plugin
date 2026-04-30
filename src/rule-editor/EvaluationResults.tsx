import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { RuleEvalResults } from '../types/Rules';

export function EvaluationResults(props: { results: RuleEvalResults | null }) {
  const { results } = props;

  if (!results) {
    return null;
  }

  if (results.error) {
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 1 }}>
        <strong>Error:</strong> {results.error}
      </Box>
    );
  }

  if (results.eventTypeMismatch) {
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'info.main', borderRadius: 1 }}>
        {results.eventTypeMismatch} — the node-agent will skip this rule.
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Field</TableCell>
            <TableCell>Expression</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Error</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.ruleExpression?.map((r, i) => (
            <TableRow key={i}>
              <TableCell>
                <code>ruleExpression [{r.eventType}]</code>
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 400 }}>
                {r.expression}
              </TableCell>
              <TableCell>
                {r.result === null || r.result === undefined ? (
                  '—'
                ) : (
                  <Chip
                    label={r.result ? 'fired (true)' : 'not fired (false)'}
                    color={r.result ? 'warning' : 'success'}
                    size="small"
                  />
                )}
              </TableCell>
              <TableCell sx={{ color: 'error.main', fontSize: '0.75rem' }}>{r.error}</TableCell>
            </TableRow>
          ))}

          <TableRow>
            <TableCell>
              <code>message</code>
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {results.message?.result}
            </TableCell>
            <TableCell />
            <TableCell sx={{ color: 'error.main', fontSize: '0.75rem' }}>
              {results.message?.error}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell>
              <code>uniqueId</code>
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {results.uniqueId?.result}
            </TableCell>
            <TableCell />
            <TableCell sx={{ color: 'error.main', fontSize: '0.75rem' }}>
              {results.uniqueId?.error}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}
