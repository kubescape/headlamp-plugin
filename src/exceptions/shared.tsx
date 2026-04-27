import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  VulnerabilityJustification,
  VulnerabilityStatus,
} from '../softwarecomposition/SecurityException';

export const RESOURCE_KINDS = [
  'CronJob',
  'DaemonSet',
  'Deployment',
  'Job',
  'Pod',
  'ReplicaSet',
  'StatefulSet',
];

export const JUSTIFICATION_OPTIONS: VulnerabilityJustification[] = [
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'vulnerable_code_not_in_execute_path',
  'inline_mitigations_already_exist',
];

export function SectionTitle({ title }: Readonly<{ title: string }>) {
  return (
    <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>
      {title}
    </Typography>
  );
}

export function MetadataFields(
  props: Readonly<{
    name: string;
    onNameChange: (v: string) => void;
    nameDisabled?: boolean;
    namespace?: string; // undefined = hide namespace field
    onNamespaceChange?: (v: string) => void; // undefined = read-only
    reason: string;
    onReasonChange: (v: string) => void;
    expiresDate: string;
    onExpiresDateChange: (v: string) => void;
  }>
) {
  const {
    name,
    onNameChange,
    nameDisabled,
    namespace,
    onNamespaceChange,
    reason,
    onReasonChange,
    expiresDate,
    onExpiresDateChange,
  } = props;
  return (
    <>
      <Stack direction="row" spacing={2}>
        <TextField
          label="Name"
          required
          fullWidth
          disabled={nameDisabled}
          value={name}
          onChange={e => onNameChange(e.target.value)}
        />
        {namespace !== undefined && (
          <TextField
            label="Namespace"
            required
            fullWidth
            disabled={!onNamespaceChange}
            value={namespace}
            onChange={e => onNamespaceChange?.(e.target.value)}
          />
        )}
      </Stack>
      <TextField
        label="Reason"
        fullWidth
        value={reason}
        onChange={e => onReasonChange(e.target.value)}
      />
      <TextField
        label="Expires at"
        type="date"
        fullWidth
        InputLabelProps={{ shrink: true }}
        value={expiresDate}
        onChange={e => onExpiresDateChange(e.target.value)}
      />
    </>
  );
}

export function ContextBadge({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function VulnerabilityStatusSelect({
  value,
  onChange,
}: Readonly<{ value: VulnerabilityStatus; onChange: (v: VulnerabilityStatus) => void }>) {
  return (
    <FormControl fullWidth>
      <InputLabel>Status</InputLabel>
      <Select
        value={value}
        label="Status"
        onChange={e => onChange(e.target.value as VulnerabilityStatus)}
      >
        <MenuItem value="under_investigation">
          <Box>
            <Typography variant="body2">under_investigation</Typography>
            <Typography variant="caption" color="text.secondary">
              Temporarily acknowledged while assessing impact
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="not_affected">
          <Box>
            <Typography variant="body2">not_affected</Typography>
            <Typography variant="caption" color="text.secondary">
              CVE does not apply — requires justification
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="fixed">
          <Box>
            <Typography variant="body2">fixed</Typography>
            <Typography variant="caption" color="text.secondary">
              Fix has been applied or is planned
            </Typography>
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );
}

export function VulnExceptionFields(
  props: Readonly<{
    status: VulnerabilityStatus;
    onStatusChange: (v: VulnerabilityStatus) => void;
    justification: VulnerabilityJustification | '';
    onJustificationChange: (v: VulnerabilityJustification | '') => void;
    impactStatement: string;
    onImpactStatementChange: (v: string) => void;
    expiredOnFix: boolean;
    onExpiredOnFixChange: (v: boolean) => void;
  }>
) {
  const {
    status,
    onStatusChange,
    justification,
    onJustificationChange,
    impactStatement,
    onImpactStatementChange,
    expiredOnFix,
    onExpiredOnFixChange,
  } = props;
  return (
    <>
      <VulnerabilityStatusSelect value={status} onChange={onStatusChange} />

      {status === 'not_affected' && (
        <FormControl fullWidth>
          <InputLabel>Justification</InputLabel>
          <Select
            value={justification}
            label="Justification"
            required
            onChange={e => onJustificationChange(e.target.value as VulnerabilityJustification)}
          >
            {JUSTIFICATION_OPTIONS.map(opt => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <TextField
        label="Impact statement"
        fullWidth
        value={impactStatement}
        onChange={e => onImpactStatementChange(e.target.value)}
      />

      <FormControlLabel
        control={
          <Switch checked={expiredOnFix} onChange={e => onExpiredOnFixChange(e.target.checked)} />
        }
        label={
          <Box>
            <Typography variant="body2">Expired on fix</Typography>
            <Typography variant="caption" color="text.secondary">
              Auto-disable this exception once a fix is available in the scan results
            </Typography>
          </Box>
        }
      />
    </>
  );
}

export function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .substring(0, 63);
}

export function toImageGlob(imageRef: string): string {
  const lastColon = imageRef.lastIndexOf(':');
  if (lastColon > 0 && !imageRef.substring(lastColon + 1).includes('/')) {
    return imageRef.substring(0, lastColon) + ':*';
  }
  return imageRef + ':*';
}
