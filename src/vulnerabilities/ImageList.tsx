/* 
  Show container image scans. This view is part of the main Vulnerabilities page.  
*/
import {
  DateLabel,
  Link as HeadlampLink,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Stack, Tooltip } from '@mui/material';
import HeadlampTable from '../common/Table';
import { RoutingName } from '../index';
import { getImageScanKey, getImageScans, ImageScan, WorkloadScan } from './scanData';

export default function ImageListView(props: Readonly<{ workloadScans: WorkloadScan[] | null }>) {
  const { workloadScans } = props;
  if (!workloadScans) {
    return <></>;
  }

  const imageScans = getImageScans(workloadScans);

  // recent kubevuln versions only record when they scanned the workloads that run an image
  const scannedAt = new Map<string, string>();
  for (const workloadScan of workloadScans) {
    if (!workloadScan.imageScan || !workloadScan.scannedAt) continue;
    const key = getImageScanKey(workloadScan.imageScan);
    const latest = scannedAt.get(key);
    if (!latest || workloadScan.scannedAt > latest) scannedAt.set(key, workloadScan.scannedAt);
  }
  const evaluatedAt = (imageScan: ImageScan) =>
    imageScan.reportCreatedAt ?? scannedAt.get(getImageScanKey(imageScan));

  return (
    <>
      <h5>{imageScans.length} image scans</h5>
      <SectionBox>
        <HeadlampTable
          csvExport={{
            fileName: 'kubescape-images.csv',
            header: [
              'Image',
              'Cluster',
              'Workloads',
              'Last evaluated',
              'Critical',
              'High',
              'Medium',
              'Low',
              'Total',
            ],
            rows: () =>
              imageScans.map(imageScan => [
                imageScan.imageName,
                imageScan.cluster,
                imageWorkloads(workloadScans, imageScan).join('; '),
                evaluatedAt(imageScan),
                ...countImageScans(imageScan),
                imageScan.matches.length,
              ]),
          }}
          data={imageScans}
          columns={[
            {
              header: 'Image',
              accessorKey: 'manifestName',
              Cell: ({ cell, row }: any) => {
                return (
                  <HeadlampLink
                    routeName={RoutingName.ImageVulnerabilityDetails}
                    activeCluster={row.original.cluster}
                    params={{
                      name: cell.getValue(),
                      namespace: row.original.namespace,
                    }}
                  >
                    {row.original.imageName}
                  </HeadlampLink>
                );
              },
              gridTemplate: 'auto',
            },
            {
              header: 'Workload',
              accessorFn: (imageScan: ImageScan) => (
                <div style={{ whiteSpace: 'pre-line' }}>
                  {imageWorkloads(workloadScans, imageScan).join('\n')}
                </div>
              ),
              gridTemplate: 'auto',
            },
            {
              id: 'Last evaluated',
              header: 'Last evaluated',
              accessorFn: evaluatedAt,
              sortingFn: 'basic',
              sortUndefined: 'last',
              sortDescFirst: false,
              Cell: ({ cell }: any) =>
                cell.getValue() ? <DateLabel date={cell.getValue()} /> : 'Unknown',
              gridTemplate: 'auto',
            },
            {
              header: 'Scan record created',
              accessorFn: (imageScan: ImageScan) => (
                <DateLabel date={imageScan.creationTimestamp} />
              ),
              gridTemplate: 'auto',
            },
            {
              id: 'Vulnerabilities',
              header: 'Vulnerabilities',
              accessorFn: (imageScan: ImageScan) => countImageScans(imageScan).join('.'),
              Cell: ({ row }: any) => resultStack(row.original),
              gridTemplate: 'auto',
            },
            {
              header: 'SBOM',
              accessorFn: (imageScan: ImageScan) => {
                return (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeSBOMDetails}
                    activeCluster={imageScan.cluster}
                    params={{
                      name: imageScan.manifestName,
                      namespace: imageScan.namespace,
                    }}
                  >
                    SBOM
                  </HeadlampLink>
                );
              },
              gridTemplate: 'min-content',
            },
          ]}
          initialState={{
            sorting: [
              {
                id: 'Vulnerabilities',
                desc: true,
              },
            ],
          }}
          reflectInURL="images"
        />
      </SectionBox>
    </>
  );
}

function resultStack(imageScan: ImageScan) {
  function box(color: string, severity: string) {
    return (
      <Box
        sx={{
          borderLeft: 2,
          borderTop: 1,
          borderRight: 1,
          borderBottom: 1,
          borderColor: `gray gray gray ${color}`,
          textAlign: 'center',
          width: 25,
        }}
      >
        <Tooltip title={cveList(imageScan, severity)}>
          <Box>
            {imageScan.matches.filter(match => match.vulnerability.severity === severity).length}
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {box('purple', 'Critical')}
      {box('red', 'High')}
      {box('orange', 'Medium')}
      {box('yellow', 'Low')}
    </Stack>
  );
}

// The workload containers that run the image, as "workload/container"
function imageWorkloads(workloadScans: WorkloadScan[], imageScan: ImageScan): string[] {
  const workloads = workloadScans
    .filter(
      scan => scan.imageScan && getImageScanKey(scan.imageScan) === getImageScanKey(imageScan)
    )
    .map(scan => `${scan.name}/${scan.container}`);
  return [...new Set(workloads)];
}

function countImageScans(imageScan: ImageScan) {
  const counters: number[] = [];
  const severities = ['Critical', 'High', 'Medium', 'Low'];

  severities.forEach(severity => {
    const count = imageScan.matches.filter(
      match => match.vulnerability.severity === severity
    ).length;
    counters.push(count);
  });

  return counters;
}

function cveList(imageScan: ImageScan, severity: string) {
  const cves = imageScan.matches
    .filter(match => match.vulnerability.severity === severity)
    .map(match => match.vulnerability.id);

  if (cves.length > 0) {
    return (
      <>
        <div style={{ fontSize: 'smaller' }}>{severity}</div>
        <br />
        <div style={{ whiteSpace: 'normal', textAlign: 'left', fontSize: 'small' }}>
          <Stack spacing={1}>
            {cves.map(cve => (
              <div key={cve}>{cve} </div>
            ))}
          </Stack>
        </div>
      </>
    );
  }
}
