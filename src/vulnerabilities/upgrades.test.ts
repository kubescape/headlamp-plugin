import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { getImageScanKey, toImageScan, toWorkloadScan, WorkloadScan } from './scanData';
import { manifest, match, summary } from './testFixtures';
import { countBySeverity, getImageUpgrades, getPackageUpgrades } from './upgrades';

function finding(
  id: string,
  severity: string,
  pkg: string,
  installed: string,
  fixVersions: string[] | null
): VulnerabilityManifest.Match {
  const m = match(id);
  m.artifact = { name: pkg, version: installed };
  m.vulnerability.severity = severity;
  m.vulnerability.fix = fixVersions
    ? { state: 'fixed', versions: fixVersions }
    : { state: 'not-fixed', versions: [] };
  return m;
}

function workloadWith(
  matches: VulnerabilityManifest.Match[],
  relevantIds?: string[]
): WorkloadScan[] {
  const image = toImageScan(manifest());
  image.matches = matches;
  const images = new Map([[getImageScanKey(image), image]]);
  const s = summary();
  if (relevantIds) {
    const relevant = toImageScan(manifest());
    relevant.manifestName = 'relevant-123';
    relevant.namespace = 'relevant-reports';
    relevant.matches = matches.filter(m => relevantIds.includes(m.vulnerability.id));
    images.set(getImageScanKey(relevant), relevant);
  } else {
    s.spec.vulnerabilitiesRef.relevant = undefined;
  }
  return [toWorkloadScan(s, images)];
}

it('groups fixable CVEs by package with the version that fixes all of them', () => {
  const upgrades = getPackageUpgrades(
    workloadWith([
      finding('CVE-1', 'High', 'openssl', '3.0.11', ['3.0.13']),
      finding('CVE-2', 'Critical', 'openssl', '3.0.11', ['3.0.12']),
      finding('CVE-3', 'Low', 'zlib', '1.2.13', ['1.3.1']),
      finding('CVE-4', 'Critical', 'curl', '8.0.0', null),
    ])
  );

  expect(upgrades.map(u => [u.packageName, u.installedVersion, u.fixVersion])).toEqual([
    ['openssl', '3.0.11', '3.0.13'],
    ['zlib', '1.2.13', '1.3.1'],
  ]);
  expect(countBySeverity(upgrades[0], 'Critical')).toBe(1);
  expect(countBySeverity(upgrades[0], 'High')).toBe(1);
  expect(upgrades[0].workloads).toEqual(['workload/app']);
});

it('uses the fix for the installed release line when several are listed', () => {
  const [upgrade] = getPackageUpgrades(
    workloadWith([finding('CVE-1', 'High', 'lib', '2.4.1', ['1.9.8', '2.4.3', '3.0.1'])])
  );
  expect(upgrade.fixVersion).toBe('2.4.3');
});

it('orders upgrades by the most critical CVEs they fix', () => {
  const upgrades = getPackageUpgrades(
    workloadWith([
      finding('CVE-1', 'High', 'a', '1.0', ['1.1']),
      finding('CVE-2', 'High', 'a', '1.0', ['1.1']),
      finding('CVE-3', 'Critical', 'b', '1.0', ['1.1']),
      finding('CVE-4', 'High', 'c', '1.0', ['1.1']),
      finding('CVE-5', 'High', 'c', '1.0', ['1.1']),
      finding('CVE-6', 'High', 'c', '1.0', ['1.1']),
    ])
  );
  expect(upgrades.map(u => u.packageName)).toEqual(['b', 'c', 'a']);
});

it('counts only relevant CVEs when asked, unless the image has no relevancy data', () => {
  const findings = [
    finding('CVE-1', 'High', 'a', '1.0', ['1.1']),
    finding('CVE-2', 'Critical', 'b', '1.0', ['1.1']),
  ];
  expect(
    getPackageUpgrades(workloadWith(findings, ['CVE-1']), true).map(u => u.packageName)
  ).toEqual(['a']);
  expect(getPackageUpgrades(workloadWith(findings), true).map(u => u.packageName)).toEqual([
    'b',
    'a',
  ]);
});

it('groups the upgrades of an image and counts a CVE that several packages fix once', () => {
  const scans = workloadWith([
    finding('CVE-1', 'Critical', 'lfs', '1.0', ['2.0']),
    finding('CVE-1', 'Critical', 'jsch', '1.0', ['2.0']),
    finding('CVE-2', 'High', 'jsch', '1.0', ['2.0']),
    finding('CVE-3', 'Low', 'zlib', '1.0', null),
  ]);

  const images = getImageUpgrades(scans);

  expect(images).toHaveLength(1);
  expect([...images[0].cves.keys()].sort()).toEqual(['CVE-1', 'CVE-2']);
  // the package that fixes the most first
  expect(images[0].packages.map(upgrade => upgrade.packageName)).toEqual(['jsch', 'lfs']);
});

it('orders images by the most critical CVEs their upgrades fix', () => {
  const few = workloadWith([finding('CVE-1', 'High', 'a', '1.0', ['2.0'])]);
  const many = workloadWith([
    finding('CVE-2', 'Critical', 'b', '1.0', ['2.0']),
    finding('CVE-3', 'Critical', 'c', '1.0', ['2.0']),
  ]);
  many[0].imageScan!.manifestName = 'image-456';
  many[0].imageScan!.imageName = 'other:1.0';

  expect(getImageUpgrades([...few, ...many]).map(image => image.imageScan.imageName)).toEqual([
    'other:1.0',
    'example:latest',
  ]);
});
