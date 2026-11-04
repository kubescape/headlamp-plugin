/*
  A search of the Kubescape data in Headlamp's top bar: CVEs, packages, images, workloads and
  controls. The vulnerability reports are read once per session, into the cache that the
  Vulnerabilities pages share, so the first search of a session waits for them.
*/
import { Icon } from '@iconify/react';
import { Link as HeadlampLink } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { KubescapeConfig, kubescapeConfigStore } from '../common/config-store';
import makeSeverityLabel from '../common/SeverityLabel';
import { RoutingName, useHLSelectedClusters } from '../index';
import type { Control } from '../rego/Control';
import { fetchRegoData } from '../rego/RegoDataProvider';
import type { WorkloadScan } from '../vulnerabilities/scanData';
import { readVulnerabilityScans } from '../vulnerabilities/Vulnerabilities';
import { buildVulnerabilityIndex, minimumQueryLength, search, SearchGroup } from './searchIndex';

const searchHint = 'CVE, package, image, workload or control';

/** The button in Headlamp's top bar that opens the Kubescape search. */
export function KubescapeSearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title={`Search Kubescape: ${searchHint}`}>
        <IconButton aria-label="Search Kubescape" onClick={() => setOpen(true)}>
          <Icon icon="mdi:shield-search" />
        </IconButton>
      </Tooltip>
      {open && <KubescapeSearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

interface Target {
  routeName: string;
  params: Record<string, string>;
  activeCluster?: string;
}

function ResultGroup<T>(
  props: Readonly<{
    title: string;
    group: SearchGroup<T>;
    render: (item: T) => { key: string; primary: ReactNode; secondary: ReactNode; target: Target };
    onOpen: () => void;
    firstLink?: React.MutableRefObject<HTMLElement | null>;
  }>
) {
  const { title, group, render, onOpen, firstLink } = props;
  if (group.total === 0) return null;
  return (
    <>
      <ListSubheader disableSticky>
        {title} ({group.total})
      </ListSubheader>
      {group.items.map((item, index) => {
        const { key, primary, secondary, target } = render(item);
        return (
          <ListItemButton
            key={key}
            component={HeadlampLink as any}
            {...({
              routeName: target.routeName,
              params: target.params,
              activeCluster: target.activeCluster,
              role: 'link',
            } as any)}
            ref={index === 0 && firstLink ? firstLink : undefined}
            onClick={onOpen}
            dense
          >
            <ListItemText
              primary={primary}
              secondary={secondary}
              secondaryTypographyProps={{ noWrap: true }}
            />
          </ListItemButton>
        );
      })}
      {group.total > group.items.length && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1 }}>
          {group.total - group.items.length} more: type more of the name to narrow them down.
        </Typography>
      )}
    </>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function KubescapeSearchDialog(props: Readonly<{ onClose: () => void }>) {
  const { onClose } = props;
  const clusters: string[] = useHLSelectedClusters() ?? [];
  const clusterKey = clusters.join(',');
  const [query, setQuery] = useState('');
  const [scans, setScans] = useState<WorkloadScan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [controls, setControls] = useState<Control[]>([]);
  const continueReading = useRef(true);
  const firstLink = useRef<HTMLElement | null>(null);
  // the search was opened to type in it; the dialog renders its content after it mounts
  const focused = useRef(false);
  const focusOnce = (element: HTMLInputElement | null) => {
    if (element && !focused.current) {
      focused.current = true;
      element.focus();
    }
  };

  useEffect(() => {
    fetchRegoData()
      .then(data => setControls(data.controls))
      .catch(() => setControls([]));
  }, []);

  useEffect(() => {
    if (clusters.length === 0) return;
    continueReading.current = true;
    readVulnerabilityScans(
      clusters,
      (kubescapeConfigStore.get() ?? {}) as KubescapeConfig,
      continueReading,
      setLoading,
      setProgress
    )
      .then(setScans)
      .catch(err => setError(err?.message ?? String(err)));
    // a closed search stops reading; the next one continues where it stopped
    return () => {
      continueReading.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterKey]);

  const index = useMemo(() => (scans ? buildVulnerabilityIndex(scans) : null), [scans]);
  const results = useMemo(() => search(index, controls, query), [index, controls, query]);
  const found =
    results &&
    results.cves.total + results.images.total + results.workloads.total + results.controls.total;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="kubescape-search-title">
      <DialogTitle id="kubescape-search-title">Search Kubescape</DialogTitle>
      <DialogContent>
        <TextField
          inputRef={focusOnce}
          fullWidth
          placeholder={searchHint}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') firstLink.current?.click();
          }}
          inputProps={{ 'aria-label': 'Search Kubescape' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icon icon="mdi:magnify" />
              </InputAdornment>
            ),
          }}
          sx={{ mt: 1 }}
        />
        {clusters.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Open a cluster to search its Kubescape data.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Unable to read the vulnerability reports: {error}
          </Alert>
        )}
        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {progress || 'Reading the vulnerability reports…'} The first search of a session reads
              them; later searches and the Vulnerabilities pages reuse them. Controls can be
              searched already.
            </Typography>
          </Box>
        )}
        {!results ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Type at least {minimumQueryLength} characters: a CVE or GHSA id, a package such as
            openssl, an image, a workload or a control such as C-0017.
          </Typography>
        ) : found === 0 ? (
          <Typography variant="body2" sx={{ mt: 2 }}>
            Nothing found for “{query.trim()}”{loading ? ' yet' : ''}.
          </Typography>
        ) : (
          <List dense sx={{ mt: 1 }}>
            <ResultGroup
              title="CVEs"
              group={results.cves}
              firstLink={firstLink}
              onOpen={onClose}
              render={cve => ({
                key: cve.id,
                primary: (
                  <Stack direction="row" spacing={1} alignItems="center" component="span">
                    <span>{cve.id}</span>
                    {makeSeverityLabel(cve.severity)}
                  </Stack>
                ),
                secondary: [
                  cve.packages.slice(0, 3).join(', ') +
                    (cve.packages.length > 3 ? ` and ${cve.packages.length - 3} more` : ''),
                  plural(cve.images, 'image'),
                  plural(cve.workloads, 'workload'),
                  cve.aliases.length > 0 ? `also ${cve.aliases.join(', ')}` : '',
                  clusters.length > 1 ? cve.clusters.join(', ') : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
                target: { routeName: RoutingName.KubescapeCVEResults, params: { cve: cve.id } },
              })}
            />
            <ResultGroup
              title="Images"
              group={results.images}
              firstLink={results.cves.total === 0 ? firstLink : undefined}
              onOpen={onClose}
              render={image => ({
                key: `${image.cluster}/${image.namespace}/${image.manifestName}`,
                primary: image.image,
                secondary: [
                  `${image.critical} critical, ${image.high} high`,
                  plural(image.workloads, 'workload'),
                  clusters.length > 1 ? image.cluster : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
                target: {
                  routeName: RoutingName.ImageVulnerabilityDetails,
                  params: { namespace: image.namespace, name: image.manifestName },
                  activeCluster: image.cluster,
                },
              })}
            />
            <ResultGroup
              title="Workloads"
              group={results.workloads}
              firstLink={results.cves.total + results.images.total === 0 ? firstLink : undefined}
              onOpen={onClose}
              render={workload => ({
                key: `${workload.cluster}/${workload.namespace}/${workload.manifestName}`,
                primary: `${workload.name} / ${workload.container}`,
                secondary: [
                  workload.kind,
                  workload.namespace,
                  clusters.length > 1 ? workload.cluster : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
                target: {
                  routeName: RoutingName.KubescapeVulnerabilityDetails,
                  params: { namespace: workload.namespace, name: workload.manifestName },
                  activeCluster: workload.cluster,
                },
              })}
            />
            <ResultGroup
              title="Controls"
              group={results.controls}
              firstLink={
                results.cves.total + results.images.total + results.workloads.total === 0
                  ? firstLink
                  : undefined
              }
              onOpen={onClose}
              render={control => ({
                key: control.controlID,
                primary: `${control.controlID} ${control.name}`,
                secondary: control.description,
                target: {
                  routeName: RoutingName.KubescapeControlResults,
                  params: { control: control.controlID },
                },
              })}
            />
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
