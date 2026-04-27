import { NameValueTable, SectionBox, Table } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Chip } from '@mui/material';
import { useState } from 'react';
import { getURLSegments } from '../common/url';
import { clusterSecurityExceptionClass, securityExceptionClass } from '../model';
import { VulnerabilityException } from '../softwarecomposition/SecurityException';

export function SecurityExceptionDetail() {
  const [namespace, name] = getURLSegments(-2, -1);
  const [obj, setObj] = useState<KubeObject | null>(null);

  securityExceptionClass.useApiGet(setObj, name, namespace);

  if (!obj) return <></>;
  return <SecurityExceptionView obj={obj} />;
}

export function ClusterSecurityExceptionDetail() {
  const [name] = getURLSegments(-1);
  const [obj, setObj] = useState<KubeObject | null>(null);

  clusterSecurityExceptionClass.useApiGet(setObj, name);

  if (!obj) return <></>;
  return <SecurityExceptionView obj={obj} isCluster />;
}

function SecurityExceptionView({
  obj,
  isCluster = false,
}: Readonly<{ obj: KubeObject; isCluster?: boolean }>) {
  const spec = obj.jsonData?.spec ?? {};

  const expiresAt = spec.expiresAt ? new Date(spec.expiresAt) : null;
  const expired = expiresAt ? expiresAt < new Date() : false;

  const overviewRows = [
    { name: 'Name', value: obj.metadata.name },
    {
      name: isCluster ? 'Scope' : 'Namespace',
      value: isCluster ? 'Cluster-scoped' : obj.metadata.namespace,
    },
    { name: 'Author', value: spec.author ?? '—' },
    { name: 'Reason', value: spec.reason ?? '—' },
    {
      name: 'Expires',
      value: expiresAt ? (
        <span style={expired ? { color: 'red', fontWeight: 'bold' } : {}}>
          {expiresAt.toISOString()} {expired ? '(expired)' : ''}
        </span>
      ) : (
        '—'
      ),
    },
  ];

  const matchRows = [
    {
      name: 'Resources',
      value:
        spec.match?.resources && spec.match.resources.length > 0
          ? spec.match.resources.map((r: any) => `${r.kind}/${r.name ?? '*'}`).join(', ')
          : '—',
    },
    {
      name: 'Images',
      value:
        spec.match?.images && spec.match.images.length > 0 ? spec.match.images.join(', ') : '—',
    },
    ...(isCluster && spec.match?.namespaceSelector
      ? [
          {
            name: 'Namespace selector',
            value: JSON.stringify(spec.match.namespaceSelector),
          },
        ]
      : []),
  ];

  return (
    <>
      <SectionBox title={obj.metadata.name} backLink>
        <NameValueTable rows={overviewRows} />
      </SectionBox>

      <SectionBox title="Match">
        <NameValueTable rows={matchRows} />
      </SectionBox>

      {spec.posture && spec.posture.length > 0 && (
        <SectionBox title="Posture Exceptions">
          <Table
            data={spec.posture}
            columns={[
              { header: 'Control ID', accessorKey: 'controlID' },
              { header: 'Framework', accessorKey: 'frameworkName' },
              {
                header: 'Action',
                accessorKey: 'action',
                Cell: ({ cell }: any) => (
                  <Chip
                    label={cell.getValue()}
                    size="small"
                    color={cell.getValue() === 'ignore' ? 'error' : 'warning'}
                  />
                ),
              },
            ]}
          />
        </SectionBox>
      )}

      {spec.vulnerabilities && spec.vulnerabilities.length > 0 && (
        <SectionBox title="Vulnerability Exceptions">
          <Table
            data={spec.vulnerabilities}
            columns={[
              {
                header: 'CVE ID',
                accessorFn: (v: VulnerabilityException) => v.vulnerability.id,
              },
              { header: 'Status', accessorKey: 'status' },
              { header: 'Justification', accessorKey: 'justification' },
              {
                header: 'Expired on Fix',
                accessorKey: 'expiredOnFix',
                Cell: ({ cell }: any) => (cell.getValue() ? 'Yes' : 'No'),
              },
              { header: 'Impact Statement', accessorKey: 'impactStatement' },
            ]}
          />
        </SectionBox>
      )}
    </>
  );
}
