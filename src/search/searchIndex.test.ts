import type { Control } from '../rego/Control';
import type { ImageScan, WorkloadScan } from '../vulnerabilities/scanData';
import { buildVulnerabilityIndex, matchScore, search } from './searchIndex';

function match(id: string, severity: string, artifact: string, related: string[] = []) {
  return {
    vulnerability: { id, severity },
    artifact: { name: artifact, version: '1.0' },
    relatedVulnerabilities: related.map(relatedId => ({ id: relatedId })),
  } as any;
}

function image(name: string, cluster: string, matches: any[]): ImageScan {
  return {
    manifestName: name.replace(/[^a-z0-9]+/g, '-'),
    namespace: 'kubescape',
    cluster,
    imageName: name,
    creationTimestamp: '2026-11-01T00:00:00Z',
    matches,
  };
}

function workload(name: string, imageScan: ImageScan): WorkloadScan {
  return {
    manifestName: `deployment-${name}-app`,
    name,
    kind: 'Deployment',
    container: 'app',
    namespace: 'web',
    cluster: imageScan.cluster,
    imageScan,
    relevant: undefined,
  };
}

const xz = match('CVE-2024-3094', 'Critical', 'xz-utils');
const openssl = match('GHSA-1234-abcd', 'High', 'openssl', ['CVE-2024-0727']);
const opensslLow = match('CVE-2023-0001', 'Low', 'openssl');
const nginx = image('docker.io/library/nginx:1.31.3', 'cluster-a', [xz, openssl, opensslLow]);
const redis = image('docker.io/library/redis:5.0.7', 'cluster-b', [xz]);
const scans = [workload('web', nginx), workload('proxy', nginx), workload('cache', redis)];
const controls = [
  { controlID: 'C-0017', name: 'Immutable container filesystem', description: '' },
  { controlID: 'C-0016', name: 'Allow privilege escalation', description: '' },
] as Control[];

describe('buildVulnerabilityIndex', () => {
  it('counts the images and workloads of each CVE across clusters', () => {
    const index = buildVulnerabilityIndex(scans);
    expect(index.cves.find(cve => cve.id === 'CVE-2024-3094')).toEqual({
      id: 'CVE-2024-3094',
      aliases: [],
      severity: 'Critical',
      packages: ['xz-utils'],
      images: 2,
      workloads: 3,
      clusters: ['cluster-a', 'cluster-b'],
    });
    expect(index.images.find(entry => entry.image.includes('nginx'))).toMatchObject({
      critical: 1,
      high: 1,
      workloads: 2,
    });
    expect(index.workloads).toHaveLength(3);
  });
});

describe('search', () => {
  const index = buildVulnerabilityIndex(scans);

  it('waits for two characters', () => {
    expect(search(index, controls, ' c ')).toBeNull();
  });

  it('finds a CVE by its id, an alias or its package', () => {
    expect(search(index, controls, 'cve-2024-3094')?.cves.items.map(cve => cve.id)).toEqual([
      'CVE-2024-3094',
    ]);
    // a GHSA finding is found by the CVE it is
    expect(search(index, controls, 'CVE-2024-0727')?.cves.items.map(cve => cve.id)).toEqual([
      'GHSA-1234-abcd',
    ]);
    // the most severe first
    expect(search(index, controls, 'openssl')?.cves.items.map(cve => cve.id)).toEqual([
      'GHSA-1234-abcd',
      'CVE-2023-0001',
    ]);
  });

  it('finds images, workloads and controls', () => {
    const results = search(index, controls, 'redis')!;
    expect(results.images.items.map(entry => entry.image)).toEqual([
      'docker.io/library/redis:5.0.7',
    ]);
    expect(search(index, controls, 'web/proxy')?.workloads.items.map(entry => entry.name)).toEqual([
      'proxy',
    ]);
    expect(search(index, controls, 'c-0017')?.controls.items.map(c => c.controlID)).toEqual([
      'C-0017',
    ]);
    expect(search(index, controls, 'privilege')?.controls.total).toBe(1);
  });

  it('shows the best matches and counts the rest', () => {
    // two CVEs, and the GHSA finding by its CVE alias
    const results = search(index, controls, 'cve-20', 1)!;
    expect(results.cves.items.map(cve => cve.id)).toEqual(['CVE-2024-3094']);
    expect(results.cves.total).toBe(3);
  });

  it('searches controls before the vulnerability reports are read', () => {
    const results = search(null, controls, 'C-0016')!;
    expect(results.cves.total).toBe(0);
    expect(results.controls.items.map(c => c.controlID)).toEqual(['C-0016']);
  });
});

describe('matchScore', () => {
  it('ranks exact matches over prefixes over the rest', () => {
    expect(matchScore('nginx', ['nginx'])).toBe(0);
    expect(matchScore('ngi', ['nginx'])).toBe(1);
    expect(matchScore('ginx', ['nginx'])).toBe(2);
    expect(matchScore('redis', ['nginx', undefined])).toBeUndefined();
  });
});
