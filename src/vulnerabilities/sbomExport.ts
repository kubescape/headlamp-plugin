/*
  The SBOM of an image as a file: the Syft JSON document that Kubescape stores, or CycloneDX
  for tools that import that, such as Dependency-Track.
*/
import { SBOMSyft } from '../softwarecomposition/SBOMSyft';

/** The SBOM as Syft wrote it, which `syft convert` and Grype read. */
export function toSyftJson(sbom: SBOMSyft): string {
  return JSON.stringify(sbom.spec.syft, null, 2);
}

// Syft has written a CPE as a string and, in later schemas, as an object with its source
function firstCpe(artifact: SBOMSyft.Artifact): string | undefined {
  const cpe = artifact.cpes?.[0];
  return typeof cpe === 'string' ? cpe : cpe?.cpe;
}

function licensesOf(artifact: SBOMSyft.Artifact) {
  const names = [
    ...new Set((artifact.licenses ?? []).map(license => license.value).filter(Boolean)),
  ];
  return names.map(name => ({ license: { name } }));
}

/**
 * The SBOM in CycloneDX 1.5 JSON: the image as the subject, and a component for each package
 * and for the operating system of the image.
 */
export function toCycloneDx(
  sbom: SBOMSyft,
  serialNumber: string,
  now: Date = new Date()
): Record<string, unknown> {
  const syft = sbom.spec.syft;
  const imageTag = sbom.metadata.annotations?.['kubescape.io/image-tag'];
  const imageId = syft.source?.id ?? sbom.metadata.annotations?.['kubescape.io/image-id'];
  const digest = imageId?.includes('@') ? imageId.slice(imageId.indexOf('@') + 1) : undefined;

  const packages = (syft.artifacts ?? []).map(artifact => {
    const cpe = firstCpe(artifact);
    const licenses = licensesOf(artifact);
    return {
      'bom-ref': artifact.id,
      type: 'library',
      name: artifact.name,
      ...(artifact.version && { version: artifact.version }),
      ...(artifact.purl && { purl: artifact.purl }),
      ...(cpe && { cpe }),
      ...(licenses.length > 0 && { licenses }),
      properties: [
        { name: 'syft:package:type', value: artifact.type },
        ...(artifact.language ? [{ name: 'syft:package:language', value: artifact.language }] : []),
      ],
    };
  });
  const distro = syft.distro?.id
    ? [
        {
          'bom-ref': `os:${syft.distro.id}@${syft.distro.versionID ?? ''}`,
          type: 'operating-system',
          name: syft.distro.id,
          ...(syft.distro.versionID && { version: syft.distro.versionID }),
          ...(syft.distro.prettyName && { description: syft.distro.prettyName }),
        },
      ]
    : [];

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${serialNumber}`,
    version: 1,
    metadata: {
      timestamp: sbom.spec.metadata?.report?.createdAt || now.toISOString(),
      tools: {
        components: [
          {
            type: 'application',
            author: 'anchore',
            name: syft.descriptor?.name ?? 'syft',
            ...(syft.descriptor?.version && { version: syft.descriptor.version }),
          },
        ],
      },
      component: {
        'bom-ref': imageId ?? imageTag ?? sbom.metadata.name,
        type: 'container',
        name: imageTag ?? imageId ?? sbom.metadata.name,
        ...(digest && { version: digest }),
      },
    },
    components: [...distro, ...packages],
  };
}
