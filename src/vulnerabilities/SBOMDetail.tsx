import {
  NameValueTable,
  SectionBox,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { useState } from 'react';
import { getURLSegments } from '../common/url';
import { sbomSyftClass, sbomSyftFilteredClass } from '../model';
import { SBOMSyft } from '../softwarecomposition/SBOMSyft';

export default function SBOMDetail() {
  const [name, namespace] = getURLSegments(-1, -2);
  const urlParams = new URLSearchParams(window.location.search);
  const filtered = urlParams.has('filtered');

  const [sbomSyftObject, setSbomSyftObject] = useState<KubeObject | null>(null);

  const sbomClass = filtered ? sbomSyftFilteredClass : sbomSyftClass;
  sbomClass.useApiGet(setSbomSyftObject, name, namespace);

  if (!sbomSyftObject) {
    return <></>;
  }

  const sbomSyft: SBOMSyft = sbomSyftObject.jsonData;
  const message = filtered ? 'Showing in use artifacts only' : 'Showing all artifacts';
  return (
    <>
      <SectionBox title={'SBOM' + (filtered ? ' Filtered' : '')}>
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
              value: String(sbomSyft.spec.syft.artifacts.length),
            },
          ]}
        />
      </SectionBox>

      <Artifacts artifacts={sbomSyft.spec.syft.artifacts} />
    </>
  );
}

function Artifacts(props: { artifacts: SBOMSyft.Artifact[] }) {
  const { artifacts } = props;

  return (
    <SectionBox title="Artifacts">
      <HeadlampTable
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
            accessorFn: (artifact: SBOMSyft.Artifact) => {
              return artifact.licenses?.map(license => license.value).join(', ');
            },
            gridTemplate: 0.5,
          },
        ]}
      />
    </SectionBox>
  );
}
