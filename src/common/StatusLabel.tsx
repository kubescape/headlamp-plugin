import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

export interface StatusLabelProps {
  status: 'success' | 'warning' | 'error' | '';
  [otherProps: string]: any;
}

export function StatusLabel(props: Readonly<StatusLabelProps>) {
  const { status, ...other } = props;
  const theme = useTheme();

  const palette =
    status && Object.keys(theme.palette).some(key => key === status)
      ? theme.palette[status]
      : theme.palette.primary;

  return (
    <Typography
      sx={{
        backgroundColor: palette.main,
        color: palette.contrastText,
        fontSize: theme.typography.pxToRem(14),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        paddingTop: theme.spacing(0.5),
        paddingBottom: theme.spacing(0.5),
        display: 'inline-flex',
        alignItems: 'normal',
        gap: theme.spacing(0.5),
        borderRadius: theme.spacing(0.5),
      }}
      component="span"
      {...other}
    />
  );
}
