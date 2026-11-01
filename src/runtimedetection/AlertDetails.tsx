/*
  The details of a runtime alert in a dialog: what the rule found, where, and in which process.
*/
import { Icon } from '@iconify/react';
import {
  Link as HeadlampLink,
  NameValueTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactNode } from 'react';
import type { Rule } from '../types/Rules';
import {
  alertMessage,
  alertNamespace,
  alertPod,
  alertSeverity,
  alertTrace,
  alertWorkload,
  mitreUrl,
  processId,
  profileDependencyTexts,
  ruleDescription,
  severityColor,
} from './alertFields';
import type { AlertmanagerAlert } from './alertmanager';

function process(name: string | undefined, pid: string | undefined) {
  if (!name) return pid ? `PID ${pid}` : undefined;
  return pid ? `${name} (PID ${pid})` : name;
}

function Section(props: Readonly<{ title: string; rows: { name: string; value: ReactNode }[] }>) {
  const rows = props.rows.filter(row => row.value !== undefined && row.value !== '');
  if (rows.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" component="h3">
        {props.title}
      </Typography>
      <NameValueTable rows={rows} />
    </Box>
  );
}

const codeStyle = {
  m: 0,
  p: 1,
  fontSize: '0.8rem',
  overflow: 'auto',
  maxHeight: 320,
  bgcolor: 'action.hover',
  borderRadius: 1,
};

function MitreLink(props: Readonly<{ id: string }>) {
  const url = mitreUrl(props.id);
  return url ? (
    <Link href={url} target="_blank" rel="noopener noreferrer">
      {props.id}
    </Link>
  ) : (
    <>{props.id}</>
  );
}

/** The details of a runtime alert, with what its rule detects. */
export function AlertDetailsDialog(
  props: Readonly<{
    alert: AlertmanagerAlert;
    // the rule as defined in the cluster, when it can be read
    rule?: Partial<Rule>;
    onClose: () => void;
  }>
) {
  const { alert, rule: ruleDefinition, onClose } = props;
  const description = ruleDescription(ruleDefinition);
  const { mitreTactic, mitreTechnique, profileDependency } = ruleDefinition ?? {};
  const { labels, annotations } = alert;
  const severity = alertSeverity(alert);
  const message = alertMessage(alert);
  const namespace = alertNamespace(alert);
  const pod = alertPod(alert);
  const trace = alertTrace(alert);
  const containerId = labels.container_id;
  const rule = labels.rule_name ?? labels.alertname;
  const workload = alertWorkload(alert);
  const messageSeverity =
    severityColor(severity) === 'error'
      ? 'error'
      : severityColor(severity) === 'warning'
      ? 'warning'
      : 'info';

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="alert-details-title">
      <DialogTitle id="alert-details-title">
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flexGrow: 1 }}>{rule}</Box>
          {severity && <Chip label={severity} color={severityColor(severity)} size="small" />}
          <IconButton aria-label="Close" onClick={onClose}>
            <Icon icon="mdi:close" />
          </IconButton>
        </Stack>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {message && (
          <Alert severity={messageSeverity} icon={false} sx={{ wordBreak: 'break-word' }}>
            {message}
          </Alert>
        )}
        <Section
          title="Where"
          rows={[
            { name: 'Cluster', value: alert.cluster },
            { name: 'Namespace', value: namespace },
            { name: 'Workload', value: workload },
            {
              name: 'Pod',
              value:
                pod && namespace ? (
                  <HeadlampLink
                    routeName="pod"
                    params={{ namespace, name: pod }}
                    activeCluster={alert.cluster}
                  >
                    {pod}
                  </HeadlampLink>
                ) : (
                  pod
                ),
            },
            { name: 'Container', value: labels.container_name ?? labels.container },
            {
              name: 'Node',
              value: labels.node_name && (
                <HeadlampLink
                  routeName="node"
                  params={{ name: labels.node_name }}
                  activeCluster={alert.cluster}
                >
                  {labels.node_name}
                </HeadlampLink>
              ),
            },
          ]}
        />
        <Section
          title="Process"
          rows={[
            { name: 'Process', value: process(labels.comm, labels.pid) },
            { name: 'Parent process', value: process(labels.pcomm, labels.ppid) },
            { name: 'Depth in process tree', value: labels.processtree_depth },
            { name: 'User ID', value: processId(labels.uid) },
            { name: 'Group ID', value: processId(labels.gid) },
          ]}
        />
        <Section
          title="Detection"
          rows={[
            { name: 'Rule', value: labels.rule_id ? `${rule} (${labels.rule_id})` : rule },
            {
              name: 'Severity',
              value:
                severity && /^\d+$/.test(labels.severity ?? '')
                  ? `${severity} (priority ${labels.severity})`
                  : severity,
            },
            { name: 'Started', value: alert.startsAt && localeDate(alert.startsAt) },
            { name: 'Active until', value: alert.endsAt && localeDate(alert.endsAt) },
            {
              name: 'MITRE ATT&CK',
              value: (mitreTactic || mitreTechnique) && (
                <>
                  {mitreTactic && <MitreLink id={mitreTactic} />}
                  {mitreTactic && mitreTechnique && ' / '}
                  {mitreTechnique && <MitreLink id={mitreTechnique} />}
                </>
              ),
            },
            {
              name: 'Learned profile',
              value:
                profileDependency === undefined
                  ? undefined
                  : profileDependencyTexts[profileDependency],
            },
            { name: 'Profile status', value: labels.profile_status },
            { name: 'Reported by', value: labels.host },
            {
              name: 'Container ID',
              value: containerId && (
                <Tooltip title={containerId}>
                  <span>{containerId.slice(0, 12)}</span>
                </Tooltip>
              ),
            },
            { name: 'Fix', value: annotations.fix?.trim() },
          ]}
        />
        {trace && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" component="h3">
              Trace
            </Typography>
            <Box component="pre" sx={codeStyle}>
              {trace}
            </Box>
          </Box>
        )}
        <Accordion disableGutters sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography variant="body2">All labels and annotations</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box component="pre" sx={codeStyle}>
              {JSON.stringify({ labels, annotations }, null, 2)}
            </Box>
          </AccordionDetails>
        </Accordion>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
