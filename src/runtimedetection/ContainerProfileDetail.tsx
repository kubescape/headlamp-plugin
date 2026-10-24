import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import Editor from '@monaco-editor/react';
import { Alert, Typography } from '@mui/material';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { getURLSegments } from '../common/url';
import {
  applicationProfileClass,
  containerProfileClass,
  networkNeighborhoodsClass,
} from '../model';
import { ContainerProfile, getProfileContainers } from '../softwarecomposition/ContainerProfile';
import {
  discoverProfileResource,
  ProfileResource,
  ProfileView,
} from '../softwarecomposition/profileApi';
import { behaviorBaseline, networkBaseline } from './profileViews';

export function ContainerProfileDetail({ view }: Readonly<{ view: ProfileView }>) {
  const [source, setSource] = useState<ProfileResource | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setSource(null);
    setError('');
    discoverProfileResource(view)
      .then(result => {
        if (active) setSource(result);
      })
      .catch(err => {
        if (active) setError(err?.message ?? String(err));
      });
    return () => {
      active = false;
    };
  }, [view]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!source) return <Typography variant="body2">Loading profile API...</Typography>;

  return <ResolvedProfileDetail key={source.plural} view={view} source={source} />;
}

function ResolvedProfileDetail({
  view,
  source,
}: Readonly<{ view: ProfileView; source: ProfileResource }>) {
  const [name, namespace] = getURLSegments(-1, -2);
  const [item, setItem] = useState<KubeObject | null>(null);
  const [error, setError] = useState('');

  const resourceClass = source.modern
    ? containerProfileClass
    : view === 'behavior'
    ? applicationProfileClass
    : networkNeighborhoodsClass;
  resourceClass.useApiGet(
    object => {
      setItem(object);
      setError('');
    },
    name,
    namespace,
    err => setError(err?.message ?? '')
  );

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!item) return <Typography variant="body2">Loading profile...</Typography>;

  const profile = item.jsonData as ContainerProfile;
  const containers = getProfileContainers(profile);
  const behavior = view === 'behavior';
  const baseline = source.modern
    ? behavior
      ? behaviorBaseline(profile)
      : networkBaseline(profile)
    : profile;

  return (
    <>
      <SectionBox title={behavior ? 'Application Profile' : 'Network Neighborhood'} backLink>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {behavior ? 'Behavior' : 'Network'} baseline from{' '}
          {source.modern ? 'ContainerProfile' : resourceClass.kind} {profile.metadata.name}.
        </Typography>
        <NameValueTable
          rows={[
            {
              name: 'Workload',
              value:
                profile.metadata.labels?.['kubescape.io/workload-name'] ?? profile.metadata.name,
            },
            {
              name: 'Kind',
              value: profile.metadata.labels?.['kubescape.io/workload-kind'] ?? '—',
            },
            { name: 'Namespace', value: profile.metadata.namespace },
            {
              name: 'Containers',
              value: containers.map(container => container.name).join(', ') || '—',
            },
            { name: 'Status', value: profile.metadata.annotations?.['kubescape.io/status'] ?? '—' },
            ...(behavior
              ? [
                  {
                    name: 'Execs',
                    value: String(containers.reduce((n, c) => n + (c.execs?.length ?? 0), 0)),
                  },
                  {
                    name: 'Opens',
                    value: String(containers.reduce((n, c) => n + (c.opens?.length ?? 0), 0)),
                  },
                ]
              : [
                  {
                    name: 'Ingress',
                    value: String(containers.reduce((n, c) => n + (c.ingress?.length ?? 0), 0)),
                  },
                  {
                    name: 'Egress',
                    value: String(containers.reduce((n, c) => n + (c.egress?.length ?? 0), 0)),
                  },
                ]),
          ]}
        />
      </SectionBox>
      <Editor
        language="yaml"
        theme={localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : ''}
        value={yaml.dump(baseline)}
        height="60vh"
        width="60vw"
        options={{
          readOnly: true,
          lineNumbers: 'off',
          automaticLayout: true,
          minimap: { enabled: false },
        }}
      />
      {source.modern && (
        <details>
          <summary>Full ContainerProfile YAML</summary>
          <pre style={{ maxHeight: '50vh', overflow: 'auto' }}>{yaml.dump(profile)}</pre>
        </details>
      )}
    </>
  );
}
