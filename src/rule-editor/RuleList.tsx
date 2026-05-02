import { Icon } from '@iconify/react';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import { remove } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { Link, Table as HeadlampTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useHistory } from 'react-router-dom';
import { RoutingName } from '../index';
import { rulesClass } from '../model';

const { createRouteURL } = Router;

export function RuleList() {
  const [rulesCRDs] = rulesClass.useList() as any;
  const history = useHistory();
  const { enqueueSnackbar } = useSnackbar();

  const items =
    rulesCRDs?.map((crd: any) => ({
      crdName: crd.jsonData.metadata.name,
      namespace: crd.jsonData.metadata.namespace,
      ruleCount: crd.jsonData.spec?.rules?.length ?? 0,
    })) ?? [];

  const handleDelete = async (namespace: string, crdName: string) => {
    try {
      await remove(`/apis/kubescape.io/v1/namespaces/${namespace}/rules/${crdName}`);
      enqueueSnackbar(`${crdName} deleted`, { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message ?? `Failed to delete ${crdName}`, { variant: 'error' });
    }
  };

  return (
    <Stack direction="column" sx={{ mt: 2 }} spacing={0}>
      <Stack direction="row" alignItems="center" spacing={0}>
        <Typography variant="h4" sx={{ mr: 2, fontWeight: 'bold' }}>
          Rules
        </Typography>
        <Tooltip title="Add new rule">
          <IconButton onClick={() => history.push(createRouteURL(RoutingName.RuleNew))}>
            <Icon icon="mdi:add-circle" />
          </IconButton>
        </Tooltip>
      </Stack>

      <HeadlampTable
        columns={[
          {
            id: 'crdName',
            header: 'Name',
            accessorKey: 'crdName',
            Cell: ({ cell, row }: any) => (
              <Link
                routeName={RoutingName.RuleEdit}
                params={{ namespace: row.original.namespace, name: row.original.crdName }}
              >
                {cell.getValue()}
              </Link>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Rules',
            accessorKey: 'ruleCount',
            gridTemplate: 'min-content',
          },
          {
            header: 'Actions',
            accessorFn: (item: any) => (
              <IconButton onClick={() => handleDelete(item.namespace, item.crdName)}>
                <Icon icon="mdi:delete" />
              </IconButton>
            ),
            gridTemplate: 'min-content',
          },
        ]}
        data={items}
        initialState={{ sorting: [{ id: 'crdName', desc: false }] }}
      />
    </Stack>
  );
}
