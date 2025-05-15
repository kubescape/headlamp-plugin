import { Box } from '@mui/material';
import { ReactNode } from 'react';

export function ErrorContainer({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box
      sx={{
        padding: '1rem 1.5rem',
        backgroundColor: '#ff6666',
        color: 'white',
        borderRadius: 4,
        margin: '1rem 0',
        textAlign: 'center',
      }}
    >
      {children}
    </Box>
  );
}
