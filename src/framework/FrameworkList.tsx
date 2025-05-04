import { Icon } from '@iconify/react';
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import { remove } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link,
  Table as HeadlampTable,
  TableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useHistory } from 'react-router-dom';
import { ErrorMessage } from '../common/ErrorMessage';
import { RoutingName } from '../index';
import { customObjectLabel } from '../model';
import { controls, FrameWork, frameworks } from '../rego';

const { createRouteURL } = Router;

export function FrameworksPage() {
  const [customFrameworkConfigmaps] = K8s.ResourceClasses.ConfigMap.useList({
    labelSelector: `${customObjectLabel}=framework`,
  });
  const history = useHistory();

  const customFrameworks =
    customFrameworkConfigmaps?.map((configMap: any) => {
      const controlsIDs: string[] = JSON.parse(configMap.jsonData.data.controlsIDs) ?? [];
      return {
        name: configMap?.jsonData.data.name,
        description: configMap.jsonData.data.description,
        controls: controls.filter(c => controlsIDs?.some(controlID => controlID === c.controlID)),
        configmapManifestName: configMap.metadata.name,
      } as FrameWork;
    }) ?? [];

  const [kubescapeOperator, error] = K8s.ResourceClasses.Pod.useList({
    labelSelector: 'app.kubernetes.io/name=kubescape-operator,app.kubernetes.io/instance=kubescape',
  });

  if (error) return <ErrorMessage error={error} />;

  const kubeScapeNamespace = kubescapeOperator?.[0]?.metadata.namespace ?? '';

  return (
    <Stack direction="column" sx={{ marginTop: '20px' }} spacing={0}>
      <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
        Default Frameworks
      </Typography>
      <FrameworksTable
        frameworks={frameworks}
        routeName={RoutingName.FrameworkControls}
        kubeScapeNamespace={kubeScapeNamespace}
        allowDelete={false}
      />

      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Custom Frameworks
        </Typography>
        <Tooltip title="Add custom framework">
          <IconButton onClick={() => history.push(createRouteURL(RoutingName.FrameworkNew))}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
      </Stack>
      <FrameworksTable
        frameworks={customFrameworks}
        routeName={RoutingName.FrameworkEdit}
        kubeScapeNamespace={kubeScapeNamespace}
        allowDelete
      />
    </Stack>
  );
}

function FrameworksTable(
  props: Readonly<{
    frameworks: FrameWork[];
    routeName: string;
    kubeScapeNamespace: string;
    allowDelete: boolean;
  }>
) {
  const { frameworks, routeName, kubeScapeNamespace, allowDelete } = props;
  const { enqueueSnackbar } = useSnackbar();

  const handleDelete = async (framework: FrameWork) => {
    await remove(
      `/api/v1/namespaces/${kubeScapeNamespace}/configmaps/${framework.configmapManifestName}`
    );

    enqueueSnackbar(`${framework.name} deleted successfully`, { variant: 'success' });
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
              routeName={routeName}
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
          header: 'Controls',
          accessorFn: (framework: FrameWork) => framework.controls.length,
        },
        allowDelete
          ? {
              header: 'Actions',
              accessorFn: (framework: FrameWork) => (
                <IconButton onClick={() => handleDelete(framework)}>
                  <Icon icon="mdi:delete" />
                </IconButton>
              ),
              gridTemplate: 'min-content',
            }
          : ({} as TableColumn<FrameWork>),
      ]}
      data={frameworks}
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
