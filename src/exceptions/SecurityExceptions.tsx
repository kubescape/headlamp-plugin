import { Icon } from '@iconify/react';
import { remove } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Link as HeadlampLink,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Button, IconButton, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { RoutingName } from '../index';
import { clusterSecurityExceptionClass, securityExceptionClass } from '../model';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { SecurityExceptionForm } from './SecurityExceptionForm';

interface Row {
  name: string;
  namespace: string;
  reason: string;
  expiresAt: string;
  postureCount: number;
  vulnCount: number;
  creationTimestamp: string;
  isCluster: boolean;
  obj: KubeObject;
}

function toRow(obj: KubeObject, isCluster: boolean): Row {
  const spec = obj.jsonData?.spec ?? {};
  return {
    name: obj.metadata.name,
    namespace: isCluster ? 'Cluster-scoped' : obj.metadata.namespace ?? '',
    reason: spec.reason ?? '',
    expiresAt: spec.expiresAt ?? '',
    postureCount: spec.posture?.length ?? 0,
    vulnCount: spec.vulnerabilities?.length ?? 0,
    creationTimestamp: obj.metadata.creationTimestamp ?? '',
    isCluster,
    obj,
  };
}

export function SecurityExceptions() {
  const [namespacedList, setNamespacedList] = useState<KubeObject[] | null>(null);
  const [clusterList, setClusterList] = useState<KubeObject[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editObj, setEditObj] = useState<KubeObject | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  securityExceptionClass.useApiList(setNamespacedList);
  clusterSecurityExceptionClass.useApiList(setClusterList);

  async function handleDelete(row: Row) {
    if (!window.confirm(`Delete security exception "${row.name}"?`)) return;
    try {
      if (row.isCluster) {
        await remove(`/apis/kubescape.io/v1beta1/clustersecurityexceptions/${row.name}`);
        setClusterList(prev => prev?.filter(o => o.metadata.name !== row.name) ?? null);
      } else {
        await remove(
          `/apis/kubescape.io/v1beta1/namespaces/${row.namespace}/securityexceptions/${row.name}`
        );
        setNamespacedList(
          prev =>
            prev?.filter(
              o => !(o.metadata.name === row.name && o.metadata.namespace === row.namespace)
            ) ?? null
        );
      }
      enqueueSnackbar('Security exception deleted', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(`Failed to delete: ${err?.message ?? err}`, { variant: 'error' });
    }
  }

  const rows: Row[] = [
    ...(namespacedList ?? []).map(o => toRow(o, false)),
    ...(clusterList ?? []).map(o => toRow(o, true)),
  ];

  return (
    <SectionBox
      title="Security Exceptions"
      headerProps={{
        actions: [
          <Button key="create" variant="contained" onClick={() => setFormOpen(true)}>
            Create
          </Button>,
        ],
      }}
    >
      <Table
        data={rows}
        columns={[
          {
            header: 'Name',
            accessorKey: 'name',
            Cell: ({ cell, row }: any) =>
              row.original.isCluster ? (
                <HeadlampLink
                  routeName={RoutingName.SecurityExceptionClusterDetail}
                  params={{ name: cell.getValue() }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ) : (
                <HeadlampLink
                  routeName={RoutingName.SecurityExceptionDetail}
                  params={{ namespace: row.original.namespace, name: cell.getValue() }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
          },
          {
            header: 'Namespace',
            accessorKey: 'namespace',
          },
          {
            header: 'Reason',
            accessorKey: 'reason',
          },
          {
            header: 'Expires',
            accessorKey: 'expiresAt',
            Cell: ({ cell }: any) => {
              const val = cell.getValue();
              if (!val) return '';
              const expired = new Date(val) < new Date();
              return (
                <span style={expired ? { color: 'red', fontWeight: 'bold' } : {}}>
                  {new Date(val).toLocaleDateString()}
                </span>
              );
            },
          },
          {
            header: 'Posture entries',
            accessorKey: 'postureCount',
          },
          {
            header: 'Vuln entries',
            accessorKey: 'vulnCount',
          },
          {
            header: 'Age',
            accessorKey: 'creationTimestamp',
            Cell: ({ cell }: any) => {
              const val = cell.getValue();
              if (!val) return '';
              const days = Math.floor(
                (Date.now() - new Date(val).getTime()) / (1000 * 60 * 60 * 24)
              );
              return days === 0 ? '<1d' : `${days}d`;
            },
          },
          {
            header: '',
            accessorFn: (row: Row) => (
              <>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => setEditObj(row.obj)}>
                    <Icon icon="mdi:pencil" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => handleDelete(row)}>
                    <Icon icon="mdi:delete" />
                  </IconButton>
                </Tooltip>
              </>
            ),
            gridTemplate: 'auto',
          },
        ]}
      />
      {formOpen && <SecurityExceptionForm onClose={() => setFormOpen(false)} />}
      {editObj && (
        <SecurityExceptionForm
          existing={editObj.jsonData as SecurityException | ClusterSecurityException}
          onClose={() => setEditObj(null)}
        />
      )}
    </SectionBox>
  );
}
