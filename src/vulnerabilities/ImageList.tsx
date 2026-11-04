/* 
  Show container image scans. This view is part of the main Vulnerabilities page.  
*/
import {
  DateLabel,
  Link as HeadlampLink,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Stack } from '@mui/material';
import { useMemo } from 'react';
import { severityColors, SeverityCountStack } from '../common/SeverityCountBox';
import HeadlampTable from '../common/Table';
import { RoutingName } from '../index';
import {
  EndOfLifeLabel,
  ImageVersion,
  imageVersionMapKey,
  latestRank,
  LatestVersionLabel,
  useImageVersions,
  useImageVersionSettings,
} from './ImageVersion';
import { imageTag } from './registry';
import { getImageScanKey, getImageScans, ImageScan, WorkloadScan } from './scanData';

type ImageRow = ImageScan & { version?: ImageVersion };

export default function ImageListView(props: Readonly<{ workloadScans: WorkloadScan[] | null }>) {
  const { workloadScans } = props;
  const imageScans = useMemo(
    () => (workloadScans ? getImageScans(workloadScans) : []),
    [workloadScans]
  );
  const settings = useImageVersionSettings();
  const images = useMemo(
    () =>
      imageScans.map(scan => ({
        image: scan.imageName,
        cluster: scan.cluster,
        source: scan.source,
      })),
    [imageScans]
  );
  const versions = useImageVersions(images);
  // the table reads the values of a row again only when the rows change, so the versions that
  // are found are part of the rows
  const rows = useMemo<ImageRow[]>(
    () =>
      imageScans.map(scan => ({
        ...scan,
        version: versions.get(imageVersionMapKey({ image: scan.imageName, cluster: scan.cluster })),
      })),
    [imageScans, versions]
  );

  if (!workloadScans) {
    return <></>;
  }

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
              ...(settings.enabled ? ['Tag', 'Latest version', 'Newer version available'] : []),
              ...(settings.endOfLife ? ['End of life'] : []),
              'Last evaluated',
              ...Object.keys(severityColors),
              'Total',
            ],
            rows: () =>
              rows.map(imageScan => {
                const version = imageScan.version;
                return [
                  imageScan.imageName,
                  imageScan.cluster,
                  imageWorkloads(workloadScans, imageScan).join('; '),
                  ...(settings.enabled
                    ? [
                        imageTag(imageScan.imageName),
                        version?.latest?.latest,
                        version?.latest ? (version.newer ? 'yes' : 'no') : undefined,
                      ]
                    : []),
                  ...(settings.endOfLife
                    ? [
                        version?.line &&
                          (version.line.eol
                            ? `ended ${version.line.eolFrom ?? ''}`.trim()
                            : version.line.eolFrom),
                      ]
                    : []),
                  evaluatedAt(imageScan),
                  ...countImageScans(imageScan),
                  imageScan.matches.length,
                ];
              }),
          }}
          data={rows}
          // a cell keeps what it showed for the row it first showed
          getRowId={getImageScanKey}
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
            ...(settings.enabled
              ? [
                  {
                    id: 'Tag',
                    header: 'Tag',
                    accessorFn: (imageScan: ImageScan) => imageTag(imageScan.imageName) ?? '',
                    gridTemplate: 'auto',
                  },
                  {
                    id: 'Latest',
                    header: 'Latest',
                    // the value changes when the version is found, which redraws the cell
                    accessorFn: (row: ImageRow) => row.version?.latest?.latest ?? '',
                    sortingFn: (a: any, b: any) =>
                      latestRank(a.original.version) - latestRank(b.original.version),
                    sortDescFirst: true,
                    Cell: ({ row }: any) => <LatestVersionLabel version={row.original.version} />,
                    gridTemplate: 'auto',
                  },
                ]
              : []),
            ...(settings.endOfLife
              ? [
                  {
                    id: 'End of life',
                    header: 'End of life',
                    // released lines without an announced end sort after the dated ones
                    accessorFn: (row: ImageRow) => {
                      const line = row.version?.line;
                      return line ? line.eolFrom ?? (line.eol ? '0' : 'none') : undefined;
                    },
                    sortUndefined: 'last' as const,
                    Cell: ({ row }: any) => <EndOfLifeLabel line={row.original.version?.line} />,
                    gridTemplate: 'auto',
                  },
                ]
              : []),
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
  return (
    <SeverityCountStack
      count={severity =>
        imageScan.matches.filter(match => match.vulnerability.severity === severity).length
      }
      tooltip={severity => cveList(imageScan, severity)}
      link={{
        routeName: RoutingName.ImageVulnerabilityDetails,
        params: { name: imageScan.manifestName, namespace: imageScan.namespace },
        activeCluster: imageScan.cluster,
      }}
    />
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
