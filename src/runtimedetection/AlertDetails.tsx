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
import { ReactNode, useEffect, useState } from 'react';
import { RoutingName } from '../index';
import type { Rule } from '../types/Rules';
import {
  alertDomain,
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
import {
  AlertProfileMatch,
  compareDomain,
  fetchLearnedDomains,
  findAlertProfile,
  profileInstance,
  registeredDomain,
} from './alertProfile';
import { SilenceButton, SilenceNotice } from './Silences';

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

type ProfileLookup =
  | { state: 'looking' }
  | { state: 'found'; match: AlertProfileMatch }
  | { state: 'none' }
  | { state: 'error'; message: string };

function useAlertProfile(alert: AlertmanagerAlert): ProfileLookup {
  const [lookup, setLookup] = useState<ProfileLookup>({ state: 'looking' });
  useEffect(() => {
    let active = true;
    setLookup({ state: 'looking' });
    findAlertProfile(alert)
      .then(match => {
        if (active) setLookup(match ? { state: 'found', match } : { state: 'none' });
      })
      .catch(err => {
        if (active) setLookup({ state: 'error', message: err?.message ?? String(err) });
      });
    return () => {
      active = false;
    };
  }, [alert]);
  return lookup;
}

type DomainsLookup = 'looking' | 'unavailable' | { error: string } | string[];

/** The domains the profile of a DNS alert learned, once the profile is found. */
function useLearnedDomains(
  lookup: ProfileLookup,
  domain: string | undefined,
  container: string | undefined
): DomainsLookup | undefined {
  const [domains, setDomains] = useState<DomainsLookup>('looking');
  const match = lookup.state === 'found' ? lookup.match : undefined;
  useEffect(() => {
    if (!match || !domain) return;
    let active = true;
    setDomains('looking');
    fetchLearnedDomains(match, container)
      .then(found => {
        if (active) setDomains(found ?? 'unavailable');
      })
      .catch(err => {
        if (active) setDomains({ error: err?.message ?? String(err) });
      });
    return () => {
      active = false;
    };
  }, [match, domain, container]);
  return match && domain ? domains : undefined;
}

/** How the domain of a DNS alert compares to what the profile learned. */
function LearnedDomains(props: Readonly<{ domain: string; domains: DomainsLookup }>) {
  const { domain, domains } = props;
  const [showAll, setShowAll] = useState(false);
  if (domains === 'looking') return <Typography color="text.secondary">Looking up…</Typography>;
  if (domains === 'unavailable') {
    return <>This Storage release keeps them in a separate NetworkNeighborhood</>;
  }
  if (!Array.isArray(domains)) return <>Unable to read the profile: {domains.error}</>;
  if (domains.length === 0) {
    return <>None: the profile learned no lookups, so every domain alerts</>;
  }
  const { learned, related } = compareDomain(domain, domains);
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <span>
        {learned
          ? `${domains.length}, including ${domain}: the profile has it now`
          : `${domains.length}, and ${domain} is not one of them`}
      </span>
      <Typography variant="body2" color="text.secondary">
        {related.length > 0
          ? `Under ${registeredDomain(domain)} it learned ${related.join(', ')}`
          : `It learned nothing under ${registeredDomain(domain)}`}
      </Typography>
      <Link component="button" variant="body2" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Hide the learned domains' : `Show all ${domains.length}`}
      </Link>
      {showAll && (
        <Box component="pre" sx={{ ...codeStyle, alignSelf: 'stretch' }}>
          {domains.join('\n')}
        </Box>
      )}
    </Stack>
  );
}

/** A link to the profile of the alert's container, and whether it is that of the pod itself. */
function AlertProfileLink(props: Readonly<{ lookup: ProfileLookup; workload?: string }>) {
  const { lookup, workload } = props;
  if (lookup.state === 'looking') {
    return <Typography color="text.secondary">Looking up…</Typography>;
  }
  if (lookup.state === 'none') return <>Kubescape has no profile of this container</>;
  if (lookup.state === 'error') return <>Unable to read the profiles: {lookup.message}</>;
  const { profile, ofPodVersion } = lookup.match;
  const instance = profileInstance(profile);
  return (
    <Stack spacing={0.5}>
      <HeadlampLink
        routeName={RoutingName.RuntimeDetection}
        params={{ namespace: profile.metadata.namespace, name: profile.metadata.name }}
        activeCluster={profile.metadata.cluster}
      >
        {instance.kind && instance.name
          ? `${instance.kind} ${instance.name}${
              instance.container ? `, ${instance.container}` : ''
            }`
          : profile.metadata.name}
      </HeadlampLink>
      {!ofPodVersion && (
        <Typography variant="body2" color="text.secondary">
          {profile.metadata.labels?.['kubescape.io/workload-kind'] === 'CronJob'
            ? 'The newest profile of the CronJob: Kubescape learns a CronJob per version of its template, not per Job.'
            : `The newest profile of ${
                workload ?? 'the workload'
              }: the version of this pod has none, or the pod is gone.`}
        </Typography>
      )}
    </Stack>
  );
}

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

/** The details of a runtime alert, with what its rule detects and the silence menu. */
export function AlertDetailsDialog(
  props: Readonly<{
    alert: AlertmanagerAlert;
    // the rule as defined in the cluster, when it can be read
    rule?: Partial<Rule>;
    onClose: () => void;
    onSilenced: (notice: SilenceNotice) => void;
  }>
) {
  const { alert, rule: ruleDefinition, onClose, onSilenced } = props;
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
  const profileLookup = useAlertProfile(alert);
  const container = labels.container_name ?? labels.container;
  const domain = alertDomain(alert);
  const learnedDomains = useLearnedDomains(profileLookup, domain, container);
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
            { name: 'Domain', value: domain },
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
            {
              name: 'Application profile',
              value: <AlertProfileLink lookup={profileLookup} workload={workload} />,
            },
            {
              name: 'Learned domains',
              value: domain && learnedDomains && (
                <LearnedDomains domain={domain} domains={learnedDomains} />
              ),
            },
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
        <SilenceButton alert={alert} onDone={onSilenced} />
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
