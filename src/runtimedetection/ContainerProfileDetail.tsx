/*
  The profile Kubescape learned for a version of a workload: its behaviour and network traffic,
  as YAML and, for the whole workload, as the diagram of the Network Policies page.
*/
import { Router } from '@kinvolk/headlamp-plugin/lib';
import {
  NameValueTable,
  SectionBox,
  Tabs as HeadlampTabs,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import Editor from '@monaco-editor/react';
import { Alert, Box, Typography } from '@mui/material';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useEditorTheme } from '../common/theme';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { applicationProfileClass, containerProfileClass } from '../model';
import { WorkloadNetworkGraph } from '../networkpolicies/Diagram';
import { ContainerProfile, getProfileContainers } from '../softwarecomposition/ContainerProfile';
import { discoverProfileResource, ProfileResource } from '../softwarecomposition/profileApi';
import { behaviorBaseline, networkBaseline } from './profileViews';
import { isPartial, workloadOfProfile } from './relearn';
import { RelearnButton } from './RelearnDialog';

const { createRouteURL } = Router;

export function ContainerProfileDetail() {
  const [source, setSource] = useState<ProfileResource | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    discoverProfileResource('behavior')
      .then(result => {
        if (active) setSource(result);
      })
      .catch(err => {
        if (active) setError(err?.message ?? String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!source) return <Typography variant="body2">Loading profile API...</Typography>;

  return <ResolvedProfileDetail key={source.plural} source={source} />;
}

function YamlEditor(props: Readonly<{ value: unknown }>) {
  const editorTheme = useEditorTheme();
  return (
    <Box sx={{ pt: 2 }}>
      <Editor
        language="yaml"
        theme={editorTheme}
        value={yaml.dump(props.value)}
        height="60vh"
        options={{
          readOnly: true,
          lineNumbers: 'off',
          automaticLayout: true,
          minimap: { enabled: false },
        }}
      />
    </Box>
  );
}

function count(containers: ReturnType<typeof getProfileContainers>, field: string) {
  return String(containers.reduce((n, c) => n + ((c as any)[field]?.length ?? 0), 0));
}

function ResolvedProfileDetail({ source }: Readonly<{ source: ProfileResource }>) {
  const [name, namespace] = getURLSegments(-1, -2);
  const history = useHistory();
  const [item, setItem] = useState<KubeObject | null>(null);
  const [error, setError] = useState('');
  // the graph is laid out once it is shown, so it is only drawn on its tab
  const [tab, setTab] = useState(0);

  // older Storage releases keep the behaviour in an ApplicationProfile of its own
  const resourceClass = source.modern ? containerProfileClass : applicationProfileClass;
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
  const workload = workloadOfProfile(profile);

  const tabs = [
    {
      label: 'Behaviour',
      component: <YamlEditor value={source.modern ? behaviorBaseline(profile) : profile} />,
    },
    ...(workload
      ? [
          {
            label: 'Network graph',
            render: () => (
              <WorkloadNetworkGraph
                kind={workload.kind}
                name={workload.name}
                namespace={workload.namespace}
                cluster={profile.metadata.cluster}
              />
            ),
          },
        ]
      : []),
    ...(source.modern
      ? [
          { label: 'Network', component: <YamlEditor value={networkBaseline(profile)} /> },
          { label: 'Full YAML', component: <YamlEditor value={profile} /> },
        ]
      : []),
  ].map((entry: any, index) => ({
    label: entry.label,
    component: entry.render ? (tab === index ? entry.render() : null) : entry.component,
  }));

  return (
    <SectionBox
      title="Application Profile"
      backLink
      headerProps={{
        actions: [
          <RelearnButton
            key="relearn"
            text
            profile={profile}
            source={source}
            // the profile is gone or no longer used
            onDone={() => history.push(createRouteURL(RoutingName.ApplicationProfiles))}
          />,
        ],
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        What Kubescape learned from {source.modern ? 'ContainerProfile' : resourceClass.kind}{' '}
        {profile.metadata.name}.
      </Typography>
      <NameValueTable
        rows={[
          {
            name: 'Workload',
            value: profile.metadata.labels?.['kubescape.io/workload-name'] ?? profile.metadata.name,
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
          ...(isPartial(profile)
            ? [
                {
                  name: 'Completion',
                  value:
                    'Partial: Kubescape began to watch the container after it had started, so it did not learn the start',
                },
              ]
            : []),
          { name: 'Execs', value: count(containers, 'execs') },
          { name: 'Opens', value: count(containers, 'opens') },
          ...(source.modern
            ? [
                { name: 'Ingress', value: count(containers, 'ingress') },
                { name: 'Egress', value: count(containers, 'egress') },
              ]
            : []),
        ]}
      />
      <HeadlampTabs tabs={tabs} onTabChanged={setTab} ariaLabel="Profile views" />
    </SectionBox>
  );
}
