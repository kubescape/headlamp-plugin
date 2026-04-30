import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { useClustersConf } from '@kinvolk/headlamp-plugin/lib/k8s';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import { isValidAlertmanagerAddress, KubescapeConfig } from './config-store';

interface SettingsProps {
  data?: { [key: string]: any };
  onDataChange?: (data: { [key: string]: any }) => void;
}

export function KubescapeSettings({ data, onDataChange }: Readonly<SettingsProps>) {
  const kubescapeData = data as KubescapeConfig | undefined;
  const clusters = useClustersConf() || {};
  const [selectedCluster, setSelectedCluster] = React.useState('');

  React.useEffect(() => {
    if (Object.keys(clusters).length > 0 && !selectedCluster)
      setSelectedCluster(Object.keys(clusters)[0]);
  }, [clusters, selectedCluster]);
  const [inputValue, setInputValue] = React.useState<string>(
    (kubescapeData?.pageSize || 50).toString()
  );
  const [error, setError] = React.useState<string>('');
  const [alertmanagerAddress, setAlertmanagerAddress] = React.useState<string>(
    kubescapeData?.alertmanagerUrl ?? ''
  );
  const [addressError, setAddressError] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle'
  );
  const [testMessage, setTestMessage] = React.useState('');

  React.useEffect(() => {
    if (kubescapeData?.alertmanagerUrl !== undefined)
      setAlertmanagerAddress(kubescapeData.alertmanagerUrl);
  }, [kubescapeData?.alertmanagerUrl]);

  React.useEffect(() => {
    setInputValue((kubescapeData?.pageSize || 50).toString());
    setError('');
  }, [kubescapeData?.pageSize]);

  React.useEffect(() => {
    if (alertmanagerAddress) {
      setAddressError(!isValidAlertmanagerAddress(alertmanagerAddress));
      setTestStatus('idle');
      setTestMessage('');
    } else {
      setAddressError(false);
    }
  }, [alertmanagerAddress]);

  const validatePageSize = (value: string): { isValid: boolean; error: string } => {
    if (value === '') return { isValid: false, error: 'Page size is required' };
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return { isValid: false, error: 'Please enter a valid number' };
    if (numValue <= 0) return { isValid: false, error: 'Page size must be greater than 0' };
    if (numValue > 500) return { isValid: false, error: 'Page size cannot exceed 500' };
    return { isValid: true, error: '' };
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    setInputValue(rawValue);
    setError('');
    if (onDataChange && rawValue !== '') {
      const validation = validatePageSize(rawValue);
      if (validation.isValid) onDataChange({ ...data, pageSize: parseInt(rawValue, 10) });
    }
  };

  const handlePageSizeBlur = () => {
    const validation = validatePageSize(inputValue);
    setError(validation.error);
    if (validation.isValid && onDataChange)
      onDataChange({ ...data, pageSize: parseInt(inputValue, 10) });
  };

  const handleTestConnection = async () => {
    if (!alertmanagerAddress || !isValidAlertmanagerAddress(alertmanagerAddress)) {
      setAddressError(true);
      setTestMessage('Invalid address format');
      setTestStatus('error');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connection…');

    try {
      if (!selectedCluster) throw new Error('No cluster selected');
      const [namespace, serviceAndPort] = alertmanagerAddress.split('/');
      const proxyUrl = `/clusters/${selectedCluster}/api/v1/namespaces/${namespace}/services/${serviceAndPort}/proxy/api/v2/alerts`;
      await ApiProxy.request(proxyUrl);
      setTestStatus('success');
      setTestMessage('Connection successful!');
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
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

      <Box display="flex" flexDirection="column" mt={2}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Typography variant="body2" color="text.secondary">
            Test against cluster:
          </Typography>
          <Select
            size="small"
            value={selectedCluster}
            onChange={e => setSelectedCluster(e.target.value)}
          >
            {Object.keys(clusters).map(name => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box display="flex" gap={2} alignItems="flex-start">
          <TextField
            label="Alertmanager Service Address"
            value={alertmanagerAddress}
            error={addressError}
            helperText={
              addressError
                ? 'Invalid format. Use: namespace/service-name:port'
                : 'Address of the Alertmanager service. Format: namespace/service-name:port'
            }
            onChange={e => {
              setAlertmanagerAddress(e.target.value);
              if (onDataChange) onDataChange({ ...data, alertmanagerUrl: e.target.value });
            }}
            fullWidth
          />
          <Button
            variant="contained"
            disabled={addressError || !alertmanagerAddress || testStatus === 'testing'}
            onClick={handleTestConnection}
            sx={{ mt: 1, minWidth: '140px' }}
          >
            {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>
        {testStatus !== 'idle' && testMessage && (
          <Alert
            severity={
              testStatus === 'success' ? 'success' : testStatus === 'testing' ? 'info' : 'error'
            }
            sx={{ mt: 2, width: 'fit-content' }}
          >
            {testMessage}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
