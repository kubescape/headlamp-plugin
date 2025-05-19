import { Icon } from '@iconify/react';
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import { ApiError, remove } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { Link, Table as HeadlampTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useHistory } from 'react-router-dom';
import { ErrorMessage } from '../common/ErrorMessage';
import { getItemFromSessionStorage, KubescapeSettings } from '../common/sessionStorage';
import { RoutingName } from '../index';
import { customObjectLabel } from '../model';
import { ExceptionPolicy, ExceptionPolicyGroup } from './ExceptionPolicy';

const { createRouteURL } = Router;

export function ExceptionGroupList() {
  const [exceptionGroupConfigmaps] = K8s.ResourceClasses.ConfigMap.useList({
    labelSelector: `${customObjectLabel}=exceptions`,
  });
  const history = useHistory();

  // fetch exception groups
  const exceptionGroups =
    exceptionGroupConfigmaps?.map((configMap: any) => {
      const exceptionPolicies: ExceptionPolicy[] =
        JSON.parse(configMap.jsonData.data.exceptionPolicies) ?? [];
      return {
        name: configMap?.jsonData.data.name,
        description: configMap.jsonData.data.description,
        exceptionPolicies: exceptionPolicies,
        configmapManifestName: configMap.metadata.name,
      } as ExceptionPolicyGroup;
    }) ?? [];

  const kubeScapeNamespace = getItemFromSessionStorage<string>(
    KubescapeSettings.KubescapeNamespace
  );
  if (!kubeScapeNamespace)
    return <ErrorMessage error={new ApiError('Kubescape namespace not found')} />;

  return (
    <Stack direction="column" sx={{ marginTop: '20px' }} spacing={0}>
      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Exceptions
        </Typography>
        <Tooltip title="Add a group of exception policies">
          <IconButton onClick={() => history.push(createRouteURL(RoutingName.ExceptionGroupNew))}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        Create multiple exceptions and group then together. This will allow you to apply multiple
        exceptions at once. On the compliance page, you can select the group of exceptions to apply.
      </Typography>

      <PostureExceptionPolicyGroupsTable
        exceptionGroups={exceptionGroups}
        kubeScapeNamespace={kubeScapeNamespace}
      />
    </Stack>
  );
}

function PostureExceptionPolicyGroupsTable(
  props: Readonly<{
    exceptionGroups: ExceptionPolicyGroup[];
    kubeScapeNamespace: string;
  }>
) {
  const { exceptionGroups, kubeScapeNamespace } = props;
  const { enqueueSnackbar } = useSnackbar();

  const handleDelete = async (exception: ExceptionPolicyGroup) => {
    await remove(
      `/api/v1/namespaces/${kubeScapeNamespace}/configmaps/${exception.configmapManifestName}`
    );

    enqueueSnackbar(`${exception.name} deleted successfully`, { variant: 'success' });
  };

  return (
    <HeadlampTable
      columns={[
        {
          id: 'name',
          header: 'Name',
          accessorKey: 'name',
          Cell: ({ cell, row }: any) => (
            <Link
              routeName={RoutingName.ExceptionGroupEdit}
              params={{
                name: row.original.configmapManifestName ?? row.original.name,
              }}
            >
              {cell.getValue()}
            </Link>
          ),
          gridTemplate: 'auto',
        },
        {
          header: 'Description',
          accessorKey: 'description',
          gridTemplate: 'auto',
        },
        {
          header: 'Exception Policies',
          accessorFn: (postureExceptionPolicyGroup: ExceptionPolicyGroup) =>
            postureExceptionPolicyGroup.exceptionPolicies.length,
        },
        {
          header: 'Actions',
          accessorFn: (postureExceptionPolicyGroup: ExceptionPolicyGroup) => (
            <IconButton onClick={() => handleDelete(postureExceptionPolicyGroup)}>
              <Icon icon="mdi:delete" />
            </IconButton>
          ),
          gridTemplate: 'min-content',
        },
      ]}
      data={exceptionGroups}
      initialState={{
        sorting: [
          {
            id: 'name',
            desc: false,
          },
        ],
      }}
    />
  );
}
