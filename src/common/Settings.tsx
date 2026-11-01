import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { useClustersConf } from '@kinvolk/headlamp-plugin/lib/k8s';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import { detectPrometheus } from '../overview/prometheus';
import { detectAlertmanager } from '../runtimedetection/alertmanager';
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
  // Alertmanager addresses found in the selected cluster, null before looking
  const [detected, setDetected] = React.useState<string[] | null>(null);
  const [detecting, setDetecting] = React.useState(false);
  const prometheusAddress = kubescapeData?.prometheusUrl ?? '';
  const prometheusAddressError =
    !!prometheusAddress && !isValidAlertmanagerAddress(prometheusAddress);
  // Prometheus addresses found in the selected cluster, null before looking
  const [detectedPrometheus, setDetectedPrometheus] = React.useState<string[] | null>(null);

  const handleDetectPrometheus = async () => {
    const addresses = await detectPrometheus(selectedCluster).catch(() => []);
    setDetectedPrometheus(addresses);
    if (!prometheusAddress && addresses.length > 0 && onDataChange) {
      onDataChange({ ...data, prometheusUrl: addresses[0] });
    }
  };

  React.useEffect(() => {
    if (kubescapeData?.alertmanagerUrl !== undefined)
      setAlertmanagerAddress(kubescapeData.alertmanagerUrl);
  }, [kubescapeData?.alertmanagerUrl]);

  const changeAlertmanagerAddress = (address: string) => {
    setAlertmanagerAddress(address);
    if (onDataChange) onDataChange({ ...data, alertmanagerUrl: address });
  };

  const handleDetect = async (fillIn: boolean) => {
    setDetecting(true);
    try {
      const addresses = await detectAlertmanager(selectedCluster);
      setDetected(addresses);
      if (fillIn && addresses.length > 0) changeAlertmanagerAddress(addresses[0]);
    } catch {
      setDetected([]);
    } finally {
      setDetecting(false);
    }
  };

  // Suggest the Alertmanager of the cluster while none is configured
  React.useEffect(() => {
    if (selectedCluster && !kubescapeData?.alertmanagerUrl && detected === null) {
      handleDetect(true);
    }
    // only when the cluster is known; handleDetect changes on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster]);

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

      <Box display="flex" flexDirection="column">
        <FormControlLabel
          control={
            <Switch
              checked={kubescapeData?.notifications !== false}
              onChange={(_, checked) => onDataChange?.({ ...data, notifications: checked })}
            />
          }
          label="Notify about critical runtime alerts and security exceptions that expire within a week"
        />
        <FormControlLabel
          control={
            <Switch
              checked={kubescapeData?.imageVersions !== false}
              onChange={(_, checked) => onDataChange?.({ ...data, imageVersions: checked })}
            />
          }
          label="Show the newest version of images"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
          Asks Quay, Google&apos;s Artifact Registry, shields.io (for Docker Hub), jsDelivr (for
          projects on GitHub and Docker&apos;s official images) and endoflife.date about public
          images, and reads version-checker in clusters that run it. Images are only asked about at
          their own registry or at services that know them publicly, and answers are kept for a day.
        </Typography>
        <FormControlLabel
          sx={{ ml: 4 }}
          control={
            <Switch
              checked={kubescapeData?.imageVersions !== false && kubescapeData?.endOfLife !== false}
              disabled={kubescapeData?.imageVersions === false}
              onChange={(_, checked) => onDataChange?.({ ...data, endOfLife: checked })}
            />
          }
          label="Show when the release line of an image reaches its end of life (from endoflife.date)"
        />
      </Box>

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
            onChange={e => changeAlertmanagerAddress(e.target.value)}
            fullWidth
          />
          <Button
            variant="outlined"
            disabled={!selectedCluster || detecting}
            onClick={() => handleDetect(!alertmanagerAddress)}
            sx={{ mt: 1, minWidth: '100px' }}
          >
            {detecting ? 'Detecting…' : 'Detect'}
          </Button>
          <Button
            variant="contained"
            disabled={addressError || !alertmanagerAddress || testStatus === 'testing'}
            onClick={handleTestConnection}
            sx={{ mt: 1, minWidth: '140px' }}
          >
            {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>
        {detected && detected.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No Alertmanager service found in cluster {selectedCluster}.
          </Typography>
        )}
        {detected && detected.length > 0 && (
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              Found in {selectedCluster}:
            </Typography>
            {detected.map(address => (
              <Chip
                key={address}
                label={address}
                size="small"
                color={address === alertmanagerAddress ? 'primary' : 'default'}
                onClick={() => changeAlertmanagerAddress(address)}
              />
            ))}
          </Box>
        )}
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

      <Box display="flex" flexDirection="column" mt={3}>
        <Box display="flex" gap={2} alignItems="flex-start">
          <TextField
            label="Prometheus Service Address"
            value={prometheusAddress}
            error={prometheusAddressError}
            helperText={
              prometheusAddressError
                ? 'Invalid format. Use: namespace/service-name:port'
                : 'Prometheus with the metrics of the Kubescape exporter, for the trends on the Overview page. Format: namespace/service-name:port'
            }
            onChange={e => onDataChange?.({ ...data, prometheusUrl: e.target.value })}
            fullWidth
          />
          <Button
            variant="outlined"
            disabled={!selectedCluster}
            onClick={handleDetectPrometheus}
            sx={{ mt: 1, minWidth: '100px' }}
          >
            Detect
          </Button>
        </Box>
        {detectedPrometheus && detectedPrometheus.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No Prometheus service found in cluster {selectedCluster}.
          </Typography>
        )}
        {detectedPrometheus && detectedPrometheus.length > 0 && (
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              Found in {selectedCluster}:
            </Typography>
            {detectedPrometheus.map(address => (
              <Chip
                key={address}
                label={address}
                size="small"
                color={address === prometheusAddress ? 'primary' : 'default'}
                onClick={() => onDataChange?.({ ...data, prometheusUrl: address })}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
