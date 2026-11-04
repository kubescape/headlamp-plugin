import { Icon } from '@iconify/react';
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import { remove } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { Link, TableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ConfirmDeleteDialog } from '../common/ConfirmDeleteDialog';
import { frameworkCheck, PermittedIconButton } from '../common/permissions';
import HeadlampTable from '../common/Table';
import { getKubescapeNamespace, useKubescapeNamespace } from '../custom-objects/api-queries';
import { RoutingName } from '../index';
import { customObjectLabel } from '../model';
import { FrameWork, useRegoData } from '../rego';

const { createRouteURL } = Router;

export function FrameworksPage() {
  const [customFrameworkConfigmaps] = K8s.ResourceClasses.ConfigMap.useList({
    labelSelector: `${customObjectLabel}=framework`,
  });
  const history = useHistory();
  const { controls, frameworks } = useRegoData();
  // where the ConfigMaps of the custom frameworks are written
  const { kubeScapeNamespace } = useKubescapeNamespace();

  const customFrameworks =
    customFrameworkConfigmaps?.map((configMap: any) => {
      const controlsIDs: string[] = JSON.parse(configMap.jsonData.data.controlsIDs ?? '[]') ?? [];
      return {
        name: configMap?.jsonData.data.name,
        description: configMap.jsonData.data.description,
        controls: controls.filter(c => controlsIDs?.some(controlID => controlID === c.controlID)),
        configmapManifestName: configMap.metadata.name,
      } as FrameWork;
    }) ?? [];

  return (
    <Stack direction="column" sx={{ marginTop: '20px' }} spacing={0}>
      <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
        Default Frameworks
      </Typography>
      <FrameworksTable
        frameworks={frameworks}
        routeName={RoutingName.FrameworkControls}
        allowDelete={false}
      />

      <Stack direction="row" sx={{ marginTop: '20px' }} spacing={0}>
        <Typography variant="h4" sx={{ marginRight: 4, fontWeight: 'bold' }}>
          Custom Frameworks
        </Typography>
        <PermittedIconButton
          check={frameworkCheck('create', kubeScapeNamespace)}
          title="Add custom framework"
          size="medium"
          onClick={() => history.push(createRouteURL(RoutingName.FrameworkNew))}
        >
          <Icon icon="mdi:add-circle" />
        </PermittedIconButton>
      </Stack>
      <FrameworksTable
        frameworks={customFrameworks}
        routeName={RoutingName.FrameworkEdit}
        allowDelete
        namespace={kubeScapeNamespace}
      />
    </Stack>
  );
}

function FrameworksTable(
  props: Readonly<{
    frameworks: FrameWork[];
    routeName: string;
    allowDelete: boolean;
    // the Kubescape namespace, which holds the ConfigMaps of the custom frameworks
    namespace?: string;
  }>
) {
  const { frameworks, routeName, allowDelete, namespace } = props;
  const { enqueueSnackbar } = useSnackbar();
  // the framework to delete once the user confirms, with the namespace of its ConfigMap
  const [deleting, setDeleting] = useState<{ framework: FrameWork; namespace: string } | null>(
    null
  );

  const askToDelete = async (framework: FrameWork) => {
    const { kubeScapeNamespace, error } = await getKubescapeNamespace();
    if (!kubeScapeNamespace) {
      enqueueSnackbar(error ?? 'Kubescape namespace not found', { variant: 'error' });
      return;
    }
    setDeleting({ framework, namespace: kubeScapeNamespace });
  };

  // The list is watched, so a successful delete removes the row without a reload.
  const deleteFramework = async ({
    framework,
    namespace,
  }: {
    framework: FrameWork;
    namespace: string;
  }) => {
    await remove(`/api/v1/namespaces/${namespace}/configmaps/${framework.configmapManifestName}`);
    enqueueSnackbar(`${framework.name} deleted successfully`, { variant: 'success' });
  };

  return (
    <>
      {deleting && (
        <ConfirmDeleteDialog
          target={{
            kind: 'custom framework',
            name: deleting.framework.name,
            namespace: deleting.namespace,
            cluster: getCluster() ?? undefined,
          }}
          consequence={`Its ConfigMap ${deleting.framework.configmapManifestName} is deleted, and the Compliance page no longer offers it.`}
          onDelete={() => deleteFramework(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
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
                  <PermittedIconButton
                    check={frameworkCheck('delete', namespace, framework.configmapManifestName)}
                    title="Delete"
                    ariaLabel={`Delete ${framework.name}`}
                    size="medium"
                    onClick={() => askToDelete(framework)}
                  >
                    <Icon icon="mdi:delete" />
                  </PermittedIconButton>
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
    </>
  );
}
