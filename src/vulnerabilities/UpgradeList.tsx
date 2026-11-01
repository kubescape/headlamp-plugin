/*
  Package upgrades that fix CVEs, the most effective first. This view is part of the main
  Vulnerabilities page.
*/
import { Link as HeadlampLink, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { FormControlLabel, Switch, Typography } from '@mui/material';
import { useMemo } from 'react';
import { KubescapeSettings, useSessionStorage } from '../common/sessionStorage';
import { severityColors, SeverityCountStack } from '../common/SeverityCountBox';
import HeadlampTable from '../common/Table';
import { RoutingName } from '../index';
import { WorkloadScan } from './scanData';
import { countBySeverity, getPackageUpgrades, PackageUpgrade } from './upgrades';

export default function UpgradeListView(props: Readonly<{ workloadScans: WorkloadScan[] }>) {
  const { workloadScans } = props;
  const [relevantOnly, setRelevantOnly] = useSessionStorage<boolean>(
    KubescapeSettings.RelevantCVEs,
    false
  );
  const upgrades = useMemo(
    () => getPackageUpgrades(workloadScans, relevantOnly),
    [workloadScans, relevantOnly]
  );

  return (
    <>
      <h5>{upgrades.length} package upgrades fix CVEs</h5>
      <Typography variant="body2" color="text.secondary">
        Upgrading a package to the fix version removes the listed CVEs from the image. The upgrades
        that remove the most critical and high CVEs come first.
      </Typography>
      <SectionBox>
        <HeadlampTable
          toolbarStart={
            <FormControlLabel
              checked={relevantOnly}
              control={<Switch color="primary" />}
              label="Relevant"
              onChange={(event: any, checked: boolean) => setRelevantOnly(checked)}
            />
          }
          csvExport={{
            fileName: 'kubescape-upgrades.csv',
            header: [
              'Image',
              'Cluster',
              'Package',
              'Installed version',
              'Fix version',
              ...Object.keys(severityColors),
              'CVEs',
              'Workloads',
            ],
            rows: () =>
              upgrades.map(upgrade => [
                upgrade.imageScan.imageName,
                upgrade.imageScan.cluster,
                upgrade.packageName,
                upgrade.installedVersion,
                upgrade.fixVersion,
                ...Object.keys(severityColors).map(severity => countBySeverity(upgrade, severity)),
                [...upgrade.cves.keys()].join('; '),
                upgrade.workloads.join('; '),
              ]),
          }}
          data={upgrades}
          columns={[
            {
              header: 'Image',
              accessorFn: (upgrade: PackageUpgrade) => upgrade.imageScan.imageName,
              Cell: ({ row }: any) => (
                <HeadlampLink
                  routeName={RoutingName.ImageVulnerabilityDetails}
                  activeCluster={row.original.imageScan.cluster}
                  params={{
                    name: row.original.imageScan.manifestName,
                    namespace: row.original.imageScan.namespace,
                  }}
                >
                  {row.original.imageScan.imageName}
                </HeadlampLink>
              ),
              gridTemplate: 'auto',
            },
            {
              header: 'Package',
              accessorKey: 'packageName',
              gridTemplate: 'auto',
            },
            {
              header: 'Installed',
              accessorKey: 'installedVersion',
              gridTemplate: 'auto',
            },
            {
              header: 'Fix version',
              accessorKey: 'fixVersion',
              gridTemplate: 'auto',
            },
            {
              id: 'Fixes',
              header: 'Fixes',
              // sorts like the list: by critical, then high, ... CVEs fixed
              accessorFn: (upgrade: PackageUpgrade) =>
                Object.keys(severityColors)
                  .map(severity => String(countBySeverity(upgrade, severity)).padStart(5, '0'))
                  .join('.'),
              Cell: ({ row }: any) => (
                <SeverityCountStack
                  count={severity => countBySeverity(row.original, severity)}
                  tooltip={severity => cveList(row.original, severity)}
                />
              ),
              gridTemplate: 'auto',
            },
            {
              header: 'Workloads',
              accessorFn: (upgrade: PackageUpgrade) => upgrade.workloads.join('\n'),
              Cell: ({ cell }: any) => (
                <div style={{ whiteSpace: 'pre-line' }}>{cell.getValue()}</div>
              ),
              gridTemplate: 'auto',
            },
          ]}
          initialState={{ sorting: [{ id: 'Fixes', desc: true }] }}
          reflectInURL="upgrades"
        />
      </SectionBox>
    </>
  );
}

function cveList(upgrade: PackageUpgrade, severity: string) {
  const cves = [...upgrade.cves.entries()].filter(([, s]) => s === severity).map(([id]) => id);
  if (cves.length === 0) return severity;
  return (
    <div>
      <div style={{ fontSize: 'smaller' }}>{severity}</div>
      {cves.map(cve => (
        <div key={cve}>{cve}</div>
      ))}
    </div>
  );
}
