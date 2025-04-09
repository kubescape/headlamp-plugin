import { Box, Button, CircularProgress } from '@mui/material';
import React from 'react';

export function ProgressIndicator(
  props: Readonly<{
    continueReading: React.MutableRefObject<boolean>;
    progressMessage: string;
  }>
) {
  const { continueReading, progressMessage } = props;
  const [showProgress, setShowProgress] = React.useState(false);

  // show the progress only after 0.5 sec
  React.useEffect(() => {
    setTimeout(() => {
      setShowProgress(true);
    }, 500);
  }, []);

  const cancelReading = () => {
    continueReading.current = false;
  };

  return (
    showProgress && (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ height: 40 }}>
          <CircularProgress />
        </Box>
        <Box sx={{ m: 2 }}>{progressMessage}</Box>
        <Button onClick={cancelReading} sx={{ m: 2 }} variant="contained">
          Cancel
        </Button>
      </Box>
    )
  );
}
