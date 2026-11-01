/*
  Button that asks the Kubescape operator to scan now, instead of on its schedule.
*/
import { Icon } from '@iconify/react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { getKubescapeNamespace } from '../custom-objects/api-queries';
import {
  OperatorApiCommand,
  sendOperatorCommand,
  waitForOperatorCommand,
} from './operatorCommands';
import { AccessCheck, canI, deniedMessage } from './permissions';

/**
 * Why the user cannot ask for a scan in any of the clusters, or undefined when they can in at
 * least one, or when that is unknown.
 */
function useDeniedEverywhere(clusters: string[]): string | undefined {
  const [reason, setReason] = useState<string | undefined>();
  const clustersKey = clusters.join(',');

  useEffect(() => {
    let active = true;
    Promise.all(
      clusters.map(async cluster => {
        const { kubeScapeNamespace } = await getKubescapeNamespace(cluster);
        if (!kubeScapeNamespace) return { allowed: undefined };
        const check: AccessCheck = {
          group: 'kubescape.io',
          resource: 'operatorcommands',
          verb: 'create',
          namespace: kubeScapeNamespace,
        };
        return { allowed: await canI(check, cluster), check };
      })
    ).then(answers => {
      if (!active) return;
      const denied = answers.length > 0 && answers.every(answer => answer.allowed === false);
      setReason(denied && answers[0].check ? deniedMessage(answers[0].check) : undefined);
    });
    return () => {
      active = false;
    };
    // clustersKey covers clusters, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustersKey]);

  return reason;
}

export function ScanNowButton(
  props: Readonly<{
    clusters: string[];
    // or how to build it for a cluster, when that needs to read the cluster
    command: OperatorApiCommand | ((cluster: string) => Promise<OperatorApiCommand>);
    label?: string;
    tooltip: string;
    // called when the operator started the scan in at least one cluster
    onStarted?: () => void;
  }>
) {
  const { clusters, command, label = 'Scan now', tooltip, onStarted } = props;
  const { enqueueSnackbar } = useSnackbar();
  const [running, setRunning] = useState(false);
  const deniedReason = useDeniedEverywhere(clusters);

  const scan = async () => {
    setRunning(true);
    const results = await Promise.allSettled(
      clusters.map(async cluster => {
        const resolved = typeof command === 'function' ? await command(cluster) : command;
        const status = await waitForOperatorCommand(await sendOperatorCommand(cluster, resolved));
        if (status.error) throw new Error(status.error);
        if (status.timedOut) throw new Error('the operator did not pick up the scan request');
      })
    );
    setRunning(false);

    const prefix = (i: number) => (clusters.length > 1 ? `${clusters[i]}: ` : '');
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        enqueueSnackbar(`${prefix(i)}Scan failed: ${result.reason?.message ?? result.reason}`, {
          variant: 'error',
        });
      }
    });
    if (results.some(result => result.status === 'fulfilled')) {
      enqueueSnackbar(
        'Kubescape is scanning. The results update when the scan finishes, usually within a few minutes.',
        { variant: 'success' }
      );
      onStarted?.();
    }
  };

  return (
    <Tooltip title={deniedReason ?? tooltip}>
      <span>
        <Button
          variant="outlined"
          size="small"
          disabled={running || !!deniedReason}
          onClick={scan}
          startIcon={running ? <CircularProgress size={16} /> : <Icon icon="mdi:radar" />}
        >
          {running ? 'Starting scan…' : label}
        </Button>
      </span>
    </Tooltip>
  );
}
