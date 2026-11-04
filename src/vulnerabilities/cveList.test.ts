import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { getCVEList } from './cveList';
import { ImageScan, WorkloadScan } from './scanData';
import { match } from './testFixtures';

function image(name: string, ids: string[]): ImageScan {
  return {
    manifestName: name,
    namespace: 'kubescape',
    cluster: 'cluster-a',
    imageName: `${name}:1.0`,
    creationTimestamp: '',
    matches: ids.map(id => {
      const m: VulnerabilityManifest.Match = match(id);
      m.artifact = { name: `pkg-${id}`, version: '1.0' };
      return m;
    }),
  };
}

function workload(name: string, imageScan: ImageScan, relevantIds?: string[]): WorkloadScan {
  return {
    manifestName: name,
    name,
    kind: 'Deployment',
    container: 'app',
    namespace: 'shop',
    cluster: 'cluster-a',
    imageScan,
    relevant: relevantIds ? image(`${name}-relevant`, relevantIds) : undefined,
  };
}

it('lists each CVE once with all its workloads and images', () => {
  const web = image('web', ['CVE-1', 'CVE-2']);
  const db = image('db', ['CVE-2']);

  const cves = getCVEList([workload('web', web), workload('api', web), workload('db', db)]);

  expect(cves.map(cve => cve.CVE)).toEqual(['CVE-1', 'CVE-2']);
  expect([...cves[1].workloads]).toEqual(['web/app', 'api/app', 'db/app']);
  expect([...cves[1].images]).toEqual(['web:1.0', 'db:1.0']);
});

it('finds a CVE relevant when any workload with relevancy data uses it', () => {
  const web = image('web', ['CVE-1', 'CVE-2', 'CVE-3']);

  const cves = getCVEList([
    // the first workload that has a CVE decides as much as the others
    workload('web', web, ['CVE-1']),
    workload('api', web, ['CVE-2']),
    workload('batch', web),
  ]);

  expect(cves.map(cve => [cve.CVE, cve.relevant])).toEqual([
    ['CVE-1', true],
    ['CVE-2', true],
    ['CVE-3', false],
  ]);
});

it('does not know the relevance without relevancy data', () => {
  const cves = getCVEList([workload('web', image('web', ['CVE-1']))]);
  expect(cves[0].relevant).toBeUndefined();
});
