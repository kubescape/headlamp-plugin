/* 
  Show container image scans. This view is part of the main Vulnerabilities page.  
*/
import {
  DateLabel,
  Link as HeadlampLink,
  SectionBox,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Stack, Tooltip } from '@mui/material';
import { RoutingName } from '../index';
import { ImageScan, WorkloadScan } from './fetch-vulnerabilities';

export default function ImageListView(props: Readonly<{ workloadScans: WorkloadScan[] | null }>) {
  const { workloadScans } = props;
  if (!workloadScans) {
    return <></>;
  }

  const imageScans = getImageScans(workloadScans);

  return (
    <>
      <h5>{imageScans.length} image scans</h5>
      <SectionBox>
        <HeadlampTable
          data={imageScans}
          columns={[
            {
              header: 'Image',
              accessorKey: 'manifestName',
              Cell: ({ cell, row }: any) => {
                return (
                  <HeadlampLink
                    routeName={RoutingName.ImageVulnerabilityDetails}
                    params={{
                      name: cell.getValue(),
                      namespace: row.original.namespace,
                    }}
                  >
                    {cell.getValue().split('@sha')[0]}
                  </HeadlampLink>
                );
              },
              gridTemplate: 'max-content',
            },
            {
              header: 'Workload',
              accessorFn: (imageScan: ImageScan) => {
                const workloads = workloadScans
                  .filter(scan => scan.imageScan?.manifestName === imageScan.manifestName)
                  .map(scan => scan.container);

                const uniqueWorkloads = [...new Set(workloads)];
                return <div style={{ whiteSpace: 'pre-line' }}>{uniqueWorkloads.join('\n')}</div>;
              },
              gridTemplate: 'max-content',
            },
            {
              header: 'Last scan',
              accessorFn: (imageScan: ImageScan) => (
                <DateLabel date={imageScan.creationTimestamp} />
              ),
              gridTemplate: 'max-content',
            },
            {
              id: 'Vulnerabilities',
              header: 'Vulnerabilities',
              accessorFn: (imageScan: ImageScan) => countImageScans(imageScan).join('.'),
              Cell: ({ row }: any) => resultStack(row.original),
            },
            {
              header: 'SBOM',
              accessorFn: (imageScan: ImageScan) => {
                return (
                  <HeadlampLink
                    routeName={RoutingName.KubescapeSBOMDetails}
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

function getImageScans(workloadScans: WorkloadScan[]): ImageScan[] {
  const imageScans = new Map<string, ImageScan>();

  workloadScans.forEach(w => {
    if (w.imageScan) imageScans.set(w.imageScan.manifestName, w.imageScan);
  });

  return Array.from(imageScans.values());
}
