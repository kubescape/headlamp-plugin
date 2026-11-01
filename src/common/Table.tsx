/*
  Headlamp's table, which keeps the sorting for the session: back on a page, its tables are
  sorted the way the user left them.
*/
import {
  Table as HeadlampTable,
  TableColumn,
  TableProps,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box } from '@mui/material';
import { MouseEvent, ReactNode, useState } from 'react';
import { CsvExport, ExportCsvButton } from './ExportCsvButton';

export type SortingState = Array<{ id: string; desc: boolean }>;

const storagePrefix = 'kubescape.sorting.';

// Headlamp offers up to 50 rows; scan results run into the hundreds
const rowsPerPageOptions = [15, 25, 50, 100, 200];

export function readSorting(key: string): SortingState | undefined {
  try {
    const saved = window.sessionStorage.getItem(storagePrefix + key);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

function writeSorting(key: string, sorting: SortingState) {
  try {
    window.sessionStorage.setItem(storagePrefix + key, JSON.stringify(sorting));
  } catch {
    // the sorting is not kept when the storage is not available
  }
}

/** Identifies a table by its columns, so tables with the same columns share their sorting. */
export function sortingKeyOf<RowItem extends Record<string, any>>(
  columns: TableColumn<RowItem>[]
): string {
  return columns
    .map(column => column.id ?? (typeof column.header === 'string' ? column.header : ''))
    .join('|');
}

/**
 * Whether a click on a cell is meant for its row: not for a button or link in the cell, not in a
 * menu that the cell opened, and not the end of selecting text.
 */
export function isRowClick(event: MouseEvent<HTMLElement>): boolean {
  const cell = event.currentTarget;
  const target = event.target as HTMLElement;
  // a menu or dialog the cell opened is not in the cell, though React passes its clicks on
  if (!cell.contains(target)) return false;
  const control = target.closest('button, a, input, [role="button"]');
  if (control && cell.contains(control)) return false;
  return !window.getSelection()?.toString();
}

/**
 * The columns with cells that pass a click to the row. Headlamp's table replaces the cell props
 * of the table with its own and gives its rows no box, so each cell takes the click.
 */
export function withRowClick<RowItem extends Record<string, any>>(
  columns: TableColumn<RowItem>[],
  onRowClick: (item: RowItem) => void
): TableColumn<RowItem>[] {
  return columns.map(column => {
    const own = column.muiTableBodyCellProps;
    const cellProps = (args: any) => {
      const props: any = (typeof own === 'function' ? own(args) : own) ?? {};
      return {
        ...props,
        onClick: (event: MouseEvent<HTMLTableCellElement>) => {
          props.onClick?.(event);
          if (isRowClick(event)) onRowClick(args.row.original);
        },
      };
    };
    // Headlamp reads the style of a column's cells from the props object
    const sx = typeof own === 'object' ? own?.sx : undefined;
    return { ...column, muiTableBodyCellProps: Object.assign(cellProps, { sx }) as any };
  });
}

const clickableRows = {
  '& tbody td': { cursor: 'pointer' },
  '& tbody tr:hover > td': { backgroundColor: 'action.hover' },
};

export default function Table<RowItem extends Record<string, any>>(
  props: TableProps<RowItem> & {
    // identifies the table, by default its columns
    sortingKey?: string;
    // offers the rows as a CSV file, with a button next to the table's own actions
    csvExport?: CsvExport;
    // controls for the rows, such as filter switches, at the start of the table's toolbar
    toolbarStart?: ReactNode;
    // makes the rows clickable, apart from the buttons and links in them
    onRowClick?: (item: RowItem) => void;
  }
) {
  const { sortingKey, csvExport, toolbarStart, onRowClick, ...tableProps } = props;
  const key = sortingKey ?? sortingKeyOf(tableProps.columns);
  const [sorting, setSorting] = useState<SortingState>(
    () => readSorting(key) ?? ((tableProps.initialState?.sorting ?? []) as SortingState)
  );

  // one line with the table's search and column buttons, instead of lines of their own
  const toolbar =
    csvExport || toolbarStart
      ? () => (
          <Box
            sx={{
              display: 'flex',
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {toolbarStart}
            </Box>
            {csvExport && <ExportCsvButton {...csvExport} />}
          </Box>
        )
      : tableProps.renderTopToolbarCustomActions;

  const headlampTable = (
    <HeadlampTable
      {...tableProps}
      columns={onRowClick ? withRowClick(tableProps.columns, onRowClick) : tableProps.columns}
      rowsPerPage={tableProps.rowsPerPage ?? rowsPerPageOptions}
      renderTopToolbarCustomActions={toolbar}
      state={{ ...tableProps.state, sorting }}
      onSortingChange={updater => {
        setSorting(previous => {
          const next = typeof updater === 'function' ? updater(previous) : updater;
          writeSorting(key, next);
          return next;
        });
      }}
    />
  );
  const table = onRowClick ? <Box sx={clickableRows}>{headlampTable}</Box> : headlampTable;

  // Headlamp shows an empty table as a message without the toolbar, which would take away the
  // filters that emptied it, so they stay above the message
  if (toolbarStart && !tableProps.data?.length && !tableProps.loading) {
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          {toolbarStart}
        </Box>
        {table}
      </>
    );
  }
  return table;
}
