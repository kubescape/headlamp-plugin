import {
  Box,
  Checkbox,
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
import { useCurrentUser } from '../common/currentUser';
import {
  VulnerabilityJustification,
  VulnerabilityResponse,
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
      <ExpiryField expiresDate={expiresDate} onExpiresDateChange={onExpiresDateChange} />
      <RecordedAs />
    </>
  );
}

// A date in the local time zone, as a date input shows it
export function dateInDays(days: number, now: Date = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * When the exception expires, or that it never does, which an empty date means. Choosing an
 * expiry proposes a date a month ahead.
 */
function ExpiryField(
  props: Readonly<{ expiresDate: string; onExpiresDateChange: (v: string) => void }>
) {
  const { expiresDate, onExpiresDateChange } = props;
  const neverExpires = expiresDate === '';
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        label="Expires at"
        type="date"
        fullWidth
        disabled={neverExpires}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: dateInDays(0) }}
        value={expiresDate}
        onChange={e => onExpiresDateChange(e.target.value)}
        helperText={neverExpires ? 'The exception applies until it is deleted.' : undefined}
      />
      <FormControlLabel
        sx={{ whiteSpace: 'nowrap' }}
        control={
          <Checkbox
            checked={neverExpires}
            onChange={(_, checked) => onExpiresDateChange(checked ? '' : dateInDays(30))}
          />
        }
        label="Never expires"
      />
    </Stack>
  );
}

// Tells the user under which name the change is recorded in the history of the exception
function RecordedAs() {
  const user = useCurrentUser();
  return (
    <Typography variant="body2" color="text.secondary">
      {user
        ? `The change is recorded in the history of the exception as ${user}.`
        : 'The cluster does not tell who you are, so the change is recorded without a name.'}
    </Typography>
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
        <MenuItem value="affected">
          <Box>
            <Typography variant="body2">affected</Typography>
            <Typography variant="caption" color="text.secondary">
              The CVE applies; with can't fix or won't fix the risk is accepted
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

export const RESPONSE_OPTIONS: { value: VulnerabilityResponse; label: string }[] = [
  { value: 'can_not_fix', label: "Can't fix: no fix or upgrade is possible" },
  { value: 'will_not_fix', label: "Won't fix: the risk is accepted as it is" },
  { value: 'update', label: 'Update: an upgrade is planned' },
  { value: 'rollback', label: 'Rollback: going back to an unaffected version' },
  { value: 'workaround_available', label: 'Workaround available' },
];

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
    // for affected
    response?: VulnerabilityResponse;
    onResponseChange?: (v: VulnerabilityResponse) => void;
    actionStatement?: string;
    onActionStatementChange?: (v: string) => void;
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
    response,
    onResponseChange,
    actionStatement,
    onActionStatementChange,
  } = props;
  return (
    <>
      <VulnerabilityStatusSelect value={status} onChange={onStatusChange} />

      {status === 'affected' && onResponseChange && (
        <>
          <FormControl fullWidth>
            <InputLabel>Response</InputLabel>
            <Select
              value={response ?? ''}
              label="Response"
              onChange={e => onResponseChange(e.target.value as VulnerabilityResponse)}
            >
              {RESPONSE_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Action statement"
            required
            fullWidth
            multiline
            value={actionStatement ?? ''}
            onChange={e => onActionStatementChange?.(e.target.value)}
            helperText="What is done about it, such as a mitigation, or why it cannot be fixed."
          />
          {response && response !== 'can_not_fix' && response !== 'will_not_fix' && (
            <Typography variant="caption" color="text.secondary">
              The finding stays in the scan results until it is fixed; only can't fix and won't fix
              accept the risk.
            </Typography>
          )}
        </>
      )}

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

      {status !== 'affected' && (
        <TextField
          label="Impact statement"
          fullWidth
          value={impactStatement}
          onChange={e => onImpactStatementChange(e.target.value)}
        />
      )}

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
