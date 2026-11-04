/*
  Silencing runtime alerts in Alertmanager, recording who silenced them and why.
*/
import { Icon } from '@iconify/react';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { getCurrentUser, useCurrentUser } from '../common/currentUser';
import { Permitted } from '../common/permissions';
import { ContextBadge } from '../exceptions/shared';
import { alertNamespace, alertPod, alertWorkload } from './alertFields';
import {
  AlertmanagerAlert,
  alertmanagerProxyCheck,
  expireSilence,
  Silence,
  silenceAlert,
  SilenceMatcher,
  silenceMatchers,
  SilenceScope,
  silenceScopes,
} from './alertmanager';

export interface SilenceNotice {
  severity: 'success' | 'error';
  text: string;
}

const durations = [
  { hours: 1, label: '1 hour' },
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '1 day' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 30, label: '30 days' },
];

function ruleName(labels: Record<string, string>) {
  return labels.rule_name ?? labels.alertname;
}

function errorText(error: any) {
  return error?.message ?? String(error);
}

function matchersText(matchers: SilenceMatcher[]) {
  return matchers
    .filter(matcher => matcher.name !== 'alertname')
    .map(
      matcher =>
        `${matcher.name}${matcher.isEqual === false ? '!' : ''}${matcher.isRegex ? '=~' : '='}${
          matcher.value
        }`
    )
    .join(', ');
}

// What a scope silences, as an option and in the notice after silencing
function scopeTexts(alert: AlertmanagerAlert, scope: SilenceScope) {
  const namespace = alertNamespace(alert);
  const workload = alertWorkload(alert);
  const pod = alertPod(alert);
  switch (scope) {
    case 'pod':
      return {
        label: 'This pod only',
        description: pod
          ? `Pod "${pod}"; its replacement after a restart or rollout alerts again`
          : 'Alerts with the same labels',
        notice: pod ? `for pod ${pod}` : '',
      };
    case 'workload':
      return {
        label: 'This workload',
        description: `All pods of "${workload}"${
          namespace ? ` in namespace "${namespace}"` : ''
        }, also after a restart or rollout`,
        notice: `for ${workload}`,
      };
    case 'namespace':
      return {
        label: 'All workloads in namespace',
        description: `Every workload in namespace "${namespace}"`,
        notice: `in namespace ${namespace}`,
      };
    case 'cluster':
      return {
        label: 'The whole cluster',
        description: `Every workload${alert.cluster ? ` in cluster "${alert.cluster}"` : ''}`,
        notice: alert.cluster ? `in cluster ${alert.cluster}` : 'in the whole cluster',
      };
  }
}

/** Asks where, how long and why to silence the rule of an alert, and silences it. */
export function SilenceDialog(
  props: Readonly<{
    alert: AlertmanagerAlert;
    onClose: () => void;
    onDone: (notice: SilenceNotice) => void;
  }>
) {
  const { alert, onClose, onDone } = props;
  const { labels } = alert;
  const scopes = silenceScopes(alert);
  const [scope, setScope] = useState<SilenceScope>(
    scopes.includes('workload') ? 'workload' : scopes[0]
  );
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser(alert.cluster);
  const rule = ruleName(labels);
  const namespace = alertNamespace(alert);
  const workload = alertWorkload(alert);
  const pod = alertPod(alert);
  const duration = durations.find(option => option.hours === hours)?.label ?? `${hours} hours`;

  const silence = async () => {
    setBusy(true);
    setError(null);
    try {
      await silenceAlert(
        alert,
        { scope, hours, comment: reason },
        await getCurrentUser(alert.cluster)
      );
      const where = scopeTexts(alert, scope).notice;
      onDone({
        severity: 'success',
        text: `Silenced ${rule}${where ? ` ${where}` : ''} for ${duration}.`,
      });
    } catch (err) {
      setError(`Unable to silence the alert: ${errorText(err)}`);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="silence-title">
      <DialogTitle id="silence-title">Silence an alert</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <ContextBadge
              label="Rule"
              value={labels.rule_id ? `${rule} (${labels.rule_id})` : rule}
            />
            {namespace && <ContextBadge label="Namespace" value={namespace} />}
            {workload && <ContextBadge label="Workload" value={workload} />}
            {pod && <ContextBadge label="Pod" value={pod} />}
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Silence scope
            </Typography>
            <RadioGroup value={scope} onChange={e => setScope(e.target.value as SilenceScope)}>
              {scopes.map(option => {
                const texts = scopeTexts(alert, option);
                return (
                  <FormControlLabel
                    key={option}
                    value={option}
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2">{texts.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {texts.description}
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', mb: 0.5 }}
                  />
                );
              })}
            </RadioGroup>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Silence for
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={hours}
              onChange={(_, value) => value && setHours(value)}
            >
              {durations.map(option => (
                <ToggleButton key={option.hours} value={option.hours}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <TextField
            label="Reason"
            required
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            helperText="Kept with the silence in Alertmanager"
          />

          <Box>
            <Typography variant="body2" color="text.secondary">
              Silences alerts with{' '}
              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                {matchersText(silenceMatchers(alert, scope))}
              </Box>
              .
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user
                ? `The silence is recorded in Alertmanager as ${user}.`
                : 'The cluster does not tell who you are, so the silence is recorded without a name.'}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !reason.trim()} onClick={silence}>
          Silence
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Opens the dialog that silences the rule of an alert. */
export function SilenceButton(
  props: Readonly<{ alert: AlertmanagerAlert; onDone: (notice: SilenceNotice) => void }>
) {
  const { alert, onDone } = props;
  const [open, setOpen] = useState(false);

  return (
    <Permitted check={alertmanagerProxyCheck()} cluster={alert.cluster}>
      {allowed => (
        <>
          <Tooltip title={allowed ? 'Silence' : ''}>
            <span>
              <IconButton
                size="small"
                aria-label="Silence"
                disabled={!allowed}
                onClick={() => setOpen(true)}
              >
                <Icon icon="mdi:bell-off-outline" />
              </IconButton>
            </span>
          </Tooltip>
          {open && (
            <SilenceDialog
              alert={alert}
              onClose={() => setOpen(false)}
              onDone={notice => {
                setOpen(false);
                onDone(notice);
              }}
            />
          )}
        </>
      )}
    </Permitted>
  );
}

/** The silences of Kubescape alerts in Alertmanager, with who created them and why. */
export function SilenceList(
  props: Readonly<{
    silences: Silence[];
    showCluster: boolean;
    onDone: (notice: SilenceNotice) => void;
  }>
) {
  const { silences, showCluster, onDone } = props;
  const [expiring, setExpiring] = useState<string | null>(null);

  if (silences.length === 0) return null;

  const expire = async (silence: Silence) => {
    setExpiring(silence.id);
    try {
      await expireSilence(silence);
      onDone({ severity: 'success', text: 'The silence ended, its alerts show again.' });
    } catch (error) {
      onDone({ severity: 'error', text: `Unable to end the silence: ${errorText(error)}` });
    } finally {
      setExpiring(null);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" component="h2">
        Silences
      </Typography>
      {silences.map(silence => (
        <Stack
          key={`${silence.cluster}/${silence.id}`}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2">{matchersText(silence.matchers)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {silence.status?.state === 'pending' ? 'Starts' : 'Silenced'} by {silence.createdBy}
              {showCluster && silence.cluster ? ` in ${silence.cluster}` : ''} until{' '}
              {localeDate(silence.endsAt)}
              {silence.comment ? `: ${silence.comment}` : ''}
            </Typography>
          </Box>
          <Permitted check={alertmanagerProxyCheck('delete')} cluster={silence.cluster}>
            {allowed => (
              <Button
                size="small"
                disabled={!allowed || expiring === silence.id}
                onClick={() => expire(silence)}
              >
                End silence
              </Button>
            )}
          </Permitted>
        </Stack>
      ))}
    </Box>
  );
}
