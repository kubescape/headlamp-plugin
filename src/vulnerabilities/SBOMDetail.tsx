import { Icon } from '@iconify/react';
import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Button, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { saveToFile } from '../common/filedialog';
import HeadlampTable from '../common/Table';
import { getURLSegments } from '../common/url';
import { newGuid } from '../common/uuid';
import { sbomSyftClass, sbomSyftFilteredClass } from '../model';
import { SBOMSyft } from '../softwarecomposition/SBOMSyft';
import { toCycloneDx, toSyftJson } from './sbomExport';

export default function SBOMDetail() {
  const [name, namespace] = getURLSegments(-1, -2);
  // The query is read from the router, as Headlamp desktop keeps it in the URL hash
  const urlParams = new URLSearchParams(useLocation().search);
  const filtered = urlParams.has('filtered');

  const [sbomSyftObject, setSbomSyftObject] = useState<KubeObject | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const sbomClass = filtered ? sbomSyftFilteredClass : sbomSyftClass;
  sbomClass.useApiGet(setSbomSyftObject, name, namespace);

  if (!sbomSyftObject) {
    return <></>;
  }

  const sbomSyft: SBOMSyft = sbomSyftObject.jsonData;
  const artifacts = sbomSyft.spec.syft.artifacts ?? [];
  const message = filtered ? 'Showing in use artifacts only' : 'Showing all artifacts';
  // the name of the SBOM is the image with its digest, made safe for file names
  const fileName = sbomSyft.metadata.name + (filtered ? '-in-use' : '');
  return (
    <>
      <SectionBox title={'SBOM' + (filtered ? ' Filtered' : '')} backLink>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:download" />}
            onClick={() =>
              saveToFile(toSyftJson(sbomSyft), `${fileName}.syft.json`, enqueueSnackbar)
            }
          >
            Download Syft JSON
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:download" />}
            onClick={() =>
              saveToFile(
                JSON.stringify(toCycloneDx(sbomSyft, newGuid()), null, 2),
                `${fileName}.cdx.json`,
                enqueueSnackbar
              )
            }
          >
            Download CycloneDX
          </Button>
        </Stack>
        <p>{message}</p>
        <NameValueTable
          rows={[
            {
              name: 'Image',
              value: sbomSyft.metadata.annotations['kubescape.io/image-tag'],
            },
            {
              name: 'Last scan',
              value: sbomSyft.spec.metadata.report.createdAt,
            },
            {
              name: 'Distro',
              value: sbomSyft.spec.syft.distro.name,
            },
            {
              name: 'Components',
              value: String(artifacts.length),
            },
          ]}
        />
      </SectionBox>

      <Artifacts artifacts={artifacts} fileName={fileName} />
    </>
  );
}

function licenses(artifact: SBOMSyft.Artifact) {
  return artifact.licenses?.map(license => license.value).join(', ');
}

function Artifacts(props: { artifacts: SBOMSyft.Artifact[]; fileName: string }) {
  const { artifacts, fileName } = props;

  return (
    <SectionBox title="Artifacts">
      <HeadlampTable
        csvExport={{
          fileName: `${fileName}-packages.csv`,
          header: ['Package', 'Name', 'Version', 'Type', 'Licenses'],
          rows: () =>
            artifacts.map(artifact => [
              artifact.purl,
              artifact.name,
              artifact.version,
              artifact.type,
              licenses(artifact),
            ]),
        }}
        data={artifacts}
        columns={[
          {
            header: 'Package',
            accessorKey: 'purl',
          },
          {
            header: 'Name',
            accessorKey: 'name',
          },
          {
            header: 'Version',
            accessorKey: 'version',
          },
          {
            header: 'Type',
            accessorKey: 'type',
          },
          {
            header: 'Licenses',
            accessorFn: licenses,
            gridTemplate: 0.5,
          },
        ]}
      />
    </SectionBox>
  );
}
