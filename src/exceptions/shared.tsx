import { Icon } from '@iconify/react';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  LabelSelectorRequirement,
  VulnerabilityJustification,
  VulnerabilityStatus,
} from '../softwarecomposition/SecurityException';

// Suggestions only. Kubescape maps match.resources[].kind straight onto the
// exception designator, so controls on any kind (Service, Role, ClusterRole, ...)
// can be excepted and the field must stay free text.
export const RESOURCE_KIND_SUGGESTIONS = [
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

// A date picker gives us a day, and the user means "valid through that day".
// Anchoring to the end of the day avoids creating an exception that is already
// expired the moment it is saved.
export const EXPIRES_AT_TIME = 'T23:59:59Z';

export function toExpiresAt(date: string): string {
  return `${date}${EXPIRES_AT_TIME}`;
}

export function expiresAtToDate(expiresAt?: string): string {
  return expiresAt ? expiresAt.split('T')[0] : '';
}

export interface LabelRow {
  key: string;
  value: string;
}

export function matchLabelsToRows(matchLabels?: Record<string, string>): LabelRow[] {
  return Object.entries(matchLabels ?? {}).map(([key, value]) => ({ key, value }));
}

export function rowsToMatchLabels(rows: LabelRow[]): Record<string, string> {
  return Object.fromEntries(rows.filter(r => r.key).map(r => [r.key, r.value]));
}

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
    author?: string; // undefined = hide author field
    onAuthorChange?: (v: string) => void;
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
    author,
    onAuthorChange,
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
      {author !== undefined && (
        <TextField
          label="Author"
          fullWidth
          placeholder="who is accepting this risk"
          value={author}
          onChange={e => onAuthorChange?.(e.target.value)}
        />
      )}
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
        helperText="Valid through the end of this day (UTC)"
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

export function ResourceKindInput({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <Autocomplete
      freeSolo
      options={RESOURCE_KIND_SUGGESTIONS}
      value={value}
      sx={{ minWidth: 200 }}
      onChange={(_, v) => onChange(v ?? '')}
      onInputChange={(_, v) => onChange(v)}
      renderInput={params => <TextField {...params} label="Kind" placeholder="Deployment" />}
    />
  );
}

/**
 * Editor for the matchLabels half of a label selector. matchExpressions are not
 * editable here, but the caller keeps them and writes them back untouched, so
 * editing an exception authored with kubectl does not drop them.
 */
export function LabelSelectorEditor(
  props: Readonly<{
    rows: LabelRow[];
    onChange: (rows: LabelRow[]) => void;
    addLabel: string;
    emptyHint: string;
    preservedExpressions?: LabelSelectorRequirement[];
  }>
) {
  const { rows, onChange, addLabel, emptyHint, preservedExpressions } = props;
  return (
    <>
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyHint}
        </Typography>
      )}
      {rows.map((r, i) => (
        <Stack key={`sel-${i}`} direction="row" spacing={1} alignItems="center">
          <TextField
            label="Label key"
            value={r.key}
            onChange={e => {
              const updated = [...rows];
              updated[i] = { ...r, key: e.target.value };
              onChange(updated);
            }}
          />
          <TextField
            label="Label value"
            value={r.value}
            onChange={e => {
              const updated = [...rows];
              updated[i] = { ...r, value: e.target.value };
              onChange(updated);
            }}
          />
          <IconButton onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            <Icon icon="mdi:delete" />
          </IconButton>
        </Stack>
      ))}
      <Button
        startIcon={<Icon icon="mdi:plus" />}
        onClick={() => onChange([...rows, { key: '', value: '' }])}
        size="small"
      >
        {addLabel}
      </Button>
      {preservedExpressions && preservedExpressions.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {preservedExpressions.length} matchExpressions rule
          {preservedExpressions.length === 1 ? '' : 's'} on this selector are kept as they are. Edit
          them with kubectl.
        </Typography>
      )}
    </>
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
              CVE does not apply, requires justification
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

export function PostureActionSelect({
  value,
  onChange,
  fullWidth = false,
}: Readonly<{
  value: 'ignore' | 'alert_only';
  onChange: (v: 'ignore' | 'alert_only') => void;
  fullWidth?: boolean;
}>) {
  return (
    <FormControl fullWidth={fullWidth} sx={fullWidth ? undefined : { minWidth: 120 }}>
      <InputLabel>Action</InputLabel>
      <Select
        value={value}
        label="Action"
        onChange={e => onChange(e.target.value as 'ignore' | 'alert_only')}
      >
        <MenuItem value="ignore">
          <Box>
            <Typography variant="body2">ignore</Typography>
            <Typography variant="caption" color="text.secondary">
              Remove the finding from results and scoring
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="alert_only">
          <Box>
            <Typography variant="body2">alert_only</Typography>
            <Typography variant="caption" color="text.secondary">
              Record the finding as accepted risk. Kubescape currently scores this the same as
              ignore.
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
    .substring(0, 63)
    .replaceAll(/^-|-$/g, '');
}

export function toImageGlob(imageRef: string): string {
  // Strip digest reference before computing the tag glob
  const atIdx = imageRef.indexOf('@');
  const ref = atIdx > 0 ? imageRef.substring(0, atIdx) : imageRef;
  const lastColon = ref.lastIndexOf(':');
  if (lastColon > 0 && !ref.substring(lastColon + 1).includes('/')) {
    return ref.substring(0, lastColon) + ':*';
  }
  return ref + ':*';
}
