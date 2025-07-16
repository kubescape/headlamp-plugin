import { Box, TextField, Typography } from '@mui/material';
import React from 'react';
import { KubescapeConfig } from './config-store';

interface SettingsProps {
  data?: { [key: string]: any };
  onDataChange?: (data: { [key: string]: any }) => void;
}

export function KubescapeSettings({ data, onDataChange }: Readonly<SettingsProps>) {
  const kubescapeData = data as KubescapeConfig | undefined;
  const [inputValue, setInputValue] = React.useState<string>(
    (kubescapeData?.pageSize || 50).toString()
  );
  const [error, setError] = React.useState<string>('');

  // Update input value when external data changes
  React.useEffect(() => {
    setInputValue((kubescapeData?.pageSize || 50).toString());
    setError('');
  }, [kubescapeData?.pageSize]);

  const validatePageSize = (value: string): { isValid: boolean; error: string } => {
    if (value === '') {
      return { isValid: false, error: 'Page size is required' };
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Please enter a valid number' };
    }

    if (numValue <= 0) {
      return { isValid: false, error: 'Page size must be greater than 0' };
    }

    if (numValue > 500) {
      return { isValid: false, error: 'Page size cannot exceed 500' };
    }

    return { isValid: true, error: '' };
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    setInputValue(rawValue);

    // Clear error when user starts typing
    setError('');

    // Only save valid values immediately
    if (onDataChange && rawValue !== '') {
      const validation = validatePageSize(rawValue);
      if (validation.isValid) {
        onDataChange({ ...data, pageSize: parseInt(rawValue, 10) });
      }
    }
    // Don't update config when field is empty or invalid - let user type new value
  };

  const handlePageSizeBlur = () => {
    const validation = validatePageSize(inputValue);
    setError(validation.error);

    // Only save if valid (no errors)
    if (validation.isValid && onDataChange) {
      onDataChange({ ...data, pageSize: parseInt(inputValue, 10) });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Kubescape Plugin Settings
      </Typography>

      <TextField
        label="Items Per Page"
        type="number"
        value={inputValue}
        onChange={handlePageSizeChange}
        onBlur={handlePageSizeBlur}
        error={!!error}
        helperText={error || 'Number of scans to fetch from backend in one request.'}
        inputProps={{ min: 1, max: 500 }}
        fullWidth
        margin="normal"
      />
    </Box>
  );
}
