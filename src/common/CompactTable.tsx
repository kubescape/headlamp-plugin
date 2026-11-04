/*
  A small table for a few rows, such as the summaries of the Overview, without the search,
  filter and paging of the full table and the space they take.
*/
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ReactNode } from 'react';

export interface CompactColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export function CompactTable<T>(
  props: Readonly<{
    rows: T[];
    columns: CompactColumn<T>[];
    rowKey: (row: T, index: number) => string;
  }>
) {
  const { rows, columns, rowKey } = props;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(column => (
              <TableCell key={column.header} sx={{ fontWeight: 'bold' }}>
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={rowKey(row, index)}>
              {columns.map(column => (
                <TableCell key={column.header}>{column.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
