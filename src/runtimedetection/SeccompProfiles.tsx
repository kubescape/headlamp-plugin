/*
  Seccomp profiles that Kubescape generated from the syscalls the workloads made while learning.
*/
import { Icon } from '@iconify/react';
import {
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Alert, Box, Button, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { ClusterErrors } from '../common/ClusterErrors';
import { clusterColumns, useItemsInClusters } from '../common/clusters';
import { saveToFile } from '../common/filedialog';
import HeadlampTable from '../common/Table';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { fetchObject, listQuery } from '../model';
import { SeccompProfile } from '../softwarecomposition/SeccompProfile';
import {
  allowedSyscalls,
  discoverSeccompProfileClass,
  localhostProfile,
  profileContainers,
  securityContextYaml,
  toSeccompJson,
} from './seccomp';

function workloadName(profile: SeccompProfile) {
  return profile.metadata.labels?.['kubescape.io/workload-name'] ?? profile.metadata.name;
}

export function SeccompProfilesTab() {
  const { items, errors, loading, clusters } = useItemsInClusters<SeccompProfile>(async cluster =>
    listQuery(await discoverSeccompProfileClass(cluster), cluster)
  );

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Seccomp profiles that allow only the syscalls Kubescape observed while learning the
        behaviour of the workloads.
      </Typography>
      <ClusterErrors errors={errors} what="the seccomp profiles" />
      {!loading && errors.length === 0 && items.length === 0 && (
        <Typography variant="body2">No seccomp profiles found.</Typography>
      )}
      {errors.length < clusters.length && (
        <HeadlampTable
          data={items}
          columns={[
            {
              id: 'name',
              header: 'Name',
              accessorFn: workloadName,
              Cell: ({ cell, row }: any) => (
                <HeadlampLink
                  routeName={RoutingName.SeccompProfileDetail}
                  activeCluster={row.original.metadata.cluster}
                  params={{
                    name: row.original.metadata.name,
                    namespace: row.original.metadata.namespace,
                  }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
              gridTemplate: 'auto',
            },
            ...clusterColumns<SeccompProfile>(clusters, profile => profile.metadata.cluster),
            {
              header: 'Kind',
              accessorFn: (profile: SeccompProfile) =>
                profile.metadata.labels?.['kubescape.io/workload-kind'],
              gridTemplate: 'auto',
            },
            {
              header: 'Namespace',
              accessorFn: (profile: SeccompProfile) => profile.metadata.namespace,
              gridTemplate: 'auto',
            },
            {
              header: 'Containers',
              accessorFn: (profile: SeccompProfile) =>
                profileContainers(profile)
                  .map(container => container.name)
                  .join(', '),
              gridTemplate: 'auto',
            },
            {
              header: 'Allowed syscalls',
              accessorFn: (profile: SeccompProfile) =>
                Math.max(0, ...profileContainers(profile).map(c => allowedSyscalls(c.spec).length)),
              gridTemplate: 'min-content',
            },
            {
              header: 'Installed',
              accessorFn: (profile: SeccompProfile) => {
                const containers = profileContainers(profile);
                const installed = containers.filter(c => localhostProfile(profile, c)).length;
                return `${installed} of ${containers.length}`;
              },
              gridTemplate: 'min-content',
            },
          ]}
          initialState={{ sorting: [{ id: 'name', desc: false }] }}
        />
      )}
    </>
  );
}

export function SeccompProfileDetail() {
  const [name, namespace] = getURLSegments(-1, -2);
  const cluster = getCluster() ?? undefined;
  const [profile, setProfile] = useState<SeccompProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    discoverSeccompProfileClass(cluster)
      .then(profileClass => fetchObject(name, namespace, cluster ?? '', profileClass))
      .then(result => {
        if (active) setProfile(result);
      })
      .catch(err => {
        if (active) setError(err?.message ?? String(err));
      });
    return () => {
      active = false;
    };
  }, [name, namespace, cluster]);

  if (error) {
    return (
      <SectionBox title="Seccomp Profile" backLink>
        <Alert severity="error">{error}</Alert>
      </SectionBox>
    );
  }
  if (!profile) {
    return <></>;
  }

  return (
    <>
      <SectionBox title="Seccomp Profile" backLink>
        <NameValueTable
          rows={[
            { name: 'Workload', value: workloadName(profile) },
            { name: 'Kind', value: profile.metadata.labels?.['kubescape.io/workload-kind'] ?? '' },
            { name: 'Namespace', value: profile.metadata.namespace },
          ]}
        />
        <Alert severity="warning" sx={{ mt: 1 }}>
          A profile blocks every syscall that Kubescape did not observe while learning. Test the
          workload with the profile before you apply it in production.
        </Alert>
      </SectionBox>
      {profileContainers(profile).map(container => (
        <ContainerProfile key={container.name} profile={profile} container={container} />
      ))}
    </>
  );
}

function ContainerProfile(
  props: Readonly<{ profile: SeccompProfile; container: SeccompProfile.Container }>
) {
  const { profile, container } = props;
  const { enqueueSnackbar } = useSnackbar();
  const installedAt = localhostProfile(profile, container);
  const syscalls = allowedSyscalls(container.spec);

  return (
    <SectionBox title={`Container ${container.name}`}>
      <NameValueTable
        rows={[
          {
            name: 'Status',
            value: profile.status?.containers?.[container.name]?.status ?? 'Unknown',
          },
          { name: 'Default action', value: container.spec?.defaultAction ?? '' },
          { name: 'Installed on the nodes as', value: installedAt ?? 'Not installed yet' },
          { name: 'Allowed syscalls', value: String(syscalls.length) },
        ]}
      />
      <Box sx={{ my: 1, fontFamily: 'monospace', fontSize: '0.85em', overflowWrap: 'anywhere' }}>
        {syscalls.join(', ')}
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Apply
      </Typography>
      {installedAt ? (
        <>
          <Typography variant="body2">
            Add this to the securityContext of container {container.name}:
          </Typography>
          <Box component="pre" sx={{ my: 1 }}>
            {securityContextYaml(installedAt)}
          </Box>
        </>
      ) : (
        <Typography variant="body2" sx={{ my: 1 }}>
          Kubescape has not installed this profile on the nodes yet. You can download it, place it
          in the seccomp directory of the kubelet on every node (by default
          /var/lib/kubelet/seccomp), and refer to it with a Localhost seccomp profile.
        </Typography>
      )}
      {container.spec && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:download" />}
          onClick={() =>
            saveToFile(
              toSeccompJson(container.spec!),
              `${workloadName(profile)}-${container.name}-seccomp.json`,
              enqueueSnackbar
            )
          }
        >
          Download profile
        </Button>
      )}
    </SectionBox>
  );
}
