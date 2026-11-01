/*
  Button that saves table data as a CSV file.
*/
import { Icon } from '@iconify/react';
import { Button } from '@mui/material';
import { useSnackbar } from 'notistack';
import { CsvValue, toCsv } from './csv';
import { saveToFile } from './filedialog';

export interface CsvExport {
  fileName: string;
  header: string[];
  // computed when the button is clicked
  rows: () => CsvValue[][];
}

export function ExportCsvButton(props: Readonly<CsvExport>) {
  const { fileName, header, rows } = props;
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<Icon icon="mdi:file-delimited-outline" />}
      onClick={() => saveToFile(toCsv(header, rows()), fileName, enqueueSnackbar)}
    >
      Export CSV
    </Button>
  );
}
