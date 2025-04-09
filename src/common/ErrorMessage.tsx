import { ApiError } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { Alert, AlertTitle } from '@mui/material';

export function ErrorMessage({ error }: Readonly<{ error: ApiError }>) {
  const defaultTitle = 'Failed to load resources';
  const forbiddenTitle = "You don't have permissions to view this resource";
  const notFoundTitile = 'Resource not found';

  let title = defaultTitle;
  if (error.status === 404) {
    title = notFoundTitile;
  } else if (error.status === 403) {
    title = forbiddenTitle;
  }

  const severity = 'info';

  return (
    <Alert severity={severity} sx={{ mb: 1 }}>
      <AlertTitle>{title}</AlertTitle>
      {error.message}
    </Alert>
  );
}
