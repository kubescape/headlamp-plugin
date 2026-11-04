import { Alert } from '@mui/material';
import type { ClusterError } from '../model';

/** Reports the clusters whose data could not be read, next to the data of the others. */
export function ClusterErrors(props: Readonly<{ errors: ClusterError[]; what: string }>) {
  const { errors, what } = props;
  return (
    <>
      {errors.map(({ cluster, message }) => (
        <Alert key={cluster} severity="error" sx={{ mb: 1 }}>
          Unable to read {what} of cluster {cluster}: {message}
        </Alert>
      ))}
    </>
  );
}
