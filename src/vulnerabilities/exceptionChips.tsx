/*
  The exceptions of the CVEs of workloads, as chips coloured by what they say about the CVE.
*/
import { Icon } from '@iconify/react';
import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Button, Chip, ChipProps, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { createExceptionCheck, Permitted } from '../common/permissions';
import {
  fetchSecurityExceptions,
  SecurityExceptionData,
} from '../exceptions/apply-security-exceptions';
import {
  CveException,
  ExceptionState,
  exceptionStateLabels,
  WorkloadExceptions,
} from '../exceptions/vulnerabilityExceptions';
import { RoutingName } from '../index';

const stateColors: Record<ExceptionState, ChipProps['color']> = {
  accepted: 'success',
  not_affected: 'info',
  fixed: 'info',
  planned: 'warning',
  investigating: 'default',
};

/**
 * The security exceptions of the clusters, read again with reload. Workloads of the kinds are
 * matched against the object selectors of the exceptions.
 */
export function useSecurityExceptions(clusters: string[], kinds: string[]) {
  const [exceptions, setExceptions] = useState<Map<string, SecurityExceptionData>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const clusterKey = clusters.join(',');
  const kindKey = [...new Set(kinds)].sort().join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      clusters.map(async cluster => {
        const data = await fetchSecurityExceptions(
          cluster,
          [],
          kindKey ? kindKey.split(',') : []
        ).catch(() => undefined);
        return [cluster, data] as const;
      })
    ).then(results => {
      if (cancelled) return;
      setExceptions(new Map(results.filter((r): r is [string, SecurityExceptionData] => !!r[1])));
    });
    return () => {
      cancelled = true;
    };
  }, [clusterKey, kindKey, reloadKey]);

  return { exceptions, reload: () => setReloadKey(key => key + 1) };
}

/**
 * Opens the acceptance of the risk of the open CVEs of a page: a SecurityException in the
 * namespace, or a ClusterSecurityException without one.
 */
export function AcceptRiskButton(
  props: Readonly<{
    cveIds: string[];
    namespace?: string;
    cluster?: string;
    onClick: () => void;
  }>
) {
  const { cveIds, namespace, cluster, onClick } = props;
  return (
    <Permitted check={createExceptionCheck(namespace)} cluster={cluster}>
      {allowed => (
        <Button
          variant="outlined"
          size="small"
          disabled={!allowed}
          startIcon={<Icon icon="mdi:shield-check-outline" />}
          onClick={onClick}
        >
          Accept the risk of{' '}
          {cveIds.length === 1 ? 'the open CVE' : `the ${cveIds.length} open CVEs`}
        </Button>
      )}
    </Permitted>
  );
}

function ExceptionLink({
  exception,
  cluster,
}: Readonly<{ exception: CveException; cluster?: string }>) {
  const label = exception.namespace ? `${exception.namespace}/${exception.name}` : exception.name;
  return exception.namespace ? (
    <Link
      routeName={RoutingName.SecurityExceptionDetail}
      params={{ namespace: exception.namespace, name: exception.name }}
      activeCluster={cluster}
    >
      {label}
    </Link>
  ) : (
    <Link
      routeName={RoutingName.SecurityExceptionClusterDetail}
      params={{ name: exception.name }}
      activeCluster={cluster}
    >
      {label}
    </Link>
  );
}

/** Who made the exception, why and until when. */
export function ExceptionDetails(props: Readonly<{ exception: CveException; cluster?: string }>) {
  const { exception, cluster } = props;
  const until = exception.expiresAt
    ? `until ${new Date(exception.expiresAt).toLocaleDateString()}`
    : 'does not expire';
  return (
    <Box>
      <Typography variant="body2" fontWeight="bold">
        {exceptionStateLabels[exception.state]}:{' '}
        <ExceptionLink exception={exception} cluster={cluster} />
      </Typography>
      <Typography variant="caption" component="div">
        {[exception.author && `by ${exception.author}`, until].filter(Boolean).join(', ')}
        {exception.expiredOnFix && ', or until a fix is available'}
      </Typography>
      {exception.reason && (
        <Typography variant="caption" component="div">
          Reason: {exception.reason}
        </Typography>
      )}
      {exception.statement && (
        <Typography variant="caption" component="div">
          {exception.state === 'accepted' || exception.state === 'planned' ? 'Action' : 'Impact'}:{' '}
          {exception.statement}
        </Typography>
      )}
    </Box>
  );
}

/** The state of the exception of a finding, with the exception in the tooltip. */
export function ExceptionChip(
  props: Readonly<{ exception: CveException; cluster?: string; note?: string }>
) {
  const { exception, cluster, note } = props;
  return (
    <Tooltip
      title={
        <Stack spacing={1}>
          <ExceptionDetails exception={exception} cluster={cluster} />
          {note && <Typography variant="caption">{note}</Typography>}
        </Stack>
      }
    >
      <Chip
        size="small"
        color={stateColors[exception.state]}
        variant={exception.state === 'accepted' ? 'filled' : 'outlined'}
        label={exceptionStateLabels[exception.state]}
      />
    </Tooltip>
  );
}

// shown in a tooltip; more are on the findings page of the workload
const maxListedExceptions = 5;

/** How many CVEs of a workload are accepted, with the exceptions that cover them. */
export function AcceptedChip(props: Readonly<{ summary: WorkloadExceptions; cluster?: string }>) {
  const { summary, cluster } = props;
  const count = summary.accepted.size;
  if (count === 0) return null;
  const all = summary.open.length === 0;
  return (
    <Tooltip
      title={
        <Stack spacing={1}>
          {summary.exceptions.slice(0, maxListedExceptions).map(exception => (
            <ExceptionDetails
              key={JSON.stringify([
                exception.kind,
                exception.namespace,
                exception.name,
                exception.state,
                exception.statement,
              ])}
              exception={exception}
              cluster={cluster}
            />
          ))}
          {summary.exceptions.length > maxListedExceptions && (
            <Typography variant="caption">
              and {summary.exceptions.length - maxListedExceptions} more exceptions
            </Typography>
          )}
        </Stack>
      }
    >
      <Chip
        size="small"
        color="success"
        variant={all ? 'filled' : 'outlined'}
        label={all ? `All ${count} accepted` : `${count} accepted`}
      />
    </Tooltip>
  );
}
