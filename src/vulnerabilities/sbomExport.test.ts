import { toCycloneDx, toSyftJson } from './sbomExport';
import { sbom as sbomFixture } from './testFixtures';

it('downloads the SBOM as Syft wrote it', () => {
  const sbom = sbomFixture();
  expect(JSON.parse(toSyftJson(sbom))).toEqual(sbom.spec.syft);
});

it('converts the SBOM to CycloneDX', () => {
  const bom: any = toCycloneDx(sbomFixture(), 'abc-123', new Date('2026-10-31T10:00:00Z'));

  expect(bom).toMatchObject({
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:abc-123',
    metadata: {
      timestamp: '2026-10-27T13:52:26Z',
      tools: { components: [{ name: 'syft', version: 'v1.42.3' }] },
      component: {
        type: 'container',
        name: 'docker.io/velero/velero:v1.18.1',
        version: '1145b55b90',
      },
    },
  });
  expect(bom.components).toEqual([
    {
      'bom-ref': 'os:ubuntu@22.04',
      type: 'operating-system',
      name: 'ubuntu',
      version: '22.04',
      description: 'Ubuntu 22.04.5 LTS',
    },
    {
      'bom-ref': 'aaa8',
      type: 'library',
      name: 'base-files',
      version: '12ubuntu4.7',
      purl: 'pkg:deb/ubuntu/base-files@12ubuntu4.7',
      cpe: 'cpe:2.3:a:base-files:base-files:12ubuntu4.7:*:*:*:*:*:*:*',
      licenses: [{ license: { name: 'GPL' } }],
      properties: [{ name: 'syft:package:type', value: 'deb' }],
    },
    {
      'bom-ref': 'bbb9',
      type: 'library',
      name: 'golang.org/x/net',
      version: 'v0.38.0',
      purl: 'pkg:golang/golang.org/x/net@v0.38.0',
      cpe: 'cpe:2.3:a:golang:net:v0.38.0:*:*:*:*:*:*:*',
      properties: [
        { name: 'syft:package:type', value: 'go-module' },
        { name: 'syft:package:language', value: 'go' },
      ],
    },
  ]);
});

it('converts an SBOM without packages', () => {
  const sbom = sbomFixture();
  sbom.spec.syft.artifacts = null;
  const bom: any = toCycloneDx(sbom, 'abc-123');
  expect(bom.components.map((component: any) => component.type)).toEqual(['operating-system']);
});
