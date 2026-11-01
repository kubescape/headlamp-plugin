import { FrameWork } from '../rego';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { getImageScanKey, toImageScan, toWorkloadScan } from '../vulnerabilities/scanData';
import { manifest, match, summary } from '../vulnerabilities/testFixtures';
import { countCves, expiringExceptions, frameworkScores } from './summaries';

it('counts distinct CVEs per severity and those with a fix', () => {
  const image = toImageScan(manifest());
  const critical = (id: string, fixed: boolean) => {
    const m = match(id);
    m.vulnerability.severity = 'Critical';
    m.vulnerability.fix = fixed
      ? { state: 'fixed', versions: ['2.0'] }
      : { state: 'not-fixed', versions: [] };
    return m;
  };
  // CVE-1 is found in two packages, one of which has a fix
  image.matches = [critical('CVE-1', false), critical('CVE-1', true), critical('CVE-2', false)];
  image.matches.push(match('CVE-3'));
  const workloads = [toWorkloadScan(summary(), new Map([[getImageScanKey(image), image]]))];

  expect(countCves(workloads)).toEqual({
    Critical: { total: 2, fixable: 1 },
    High: { total: 1, fixable: 1 },
  });
});

it('scores the named frameworks that are known and have controls', () => {
  const control = (controlID: string) => ({ controlID } as FrameWork['controls'][number]);
  const frameworks = [
    { name: 'NSA', controls: [control('C-1'), control('C-2')] },
    { name: 'Empty', controls: [] },
  ] as unknown as FrameWork[];
  const scan = {
    metadata: { labels: {} },
    exceptedByPolicy: false,
    spec: {
      controls: {
        'C-1': { controlID: 'C-1', status: { status: 'passed' } },
        'C-2': { controlID: 'C-2', status: { status: 'failed' } },
      },
    },
  } as unknown as WorkloadConfigurationScanSummary;

  expect(frameworkScores([scan], frameworks, ['NSA', 'Empty', 'Unknown'])).toEqual([
    { name: 'NSA', score: 50 },
  ]);
});

it('lists expired exceptions and those expiring within two weeks, soonest first', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const namespaced = (name: string, expiresAt?: string): SecurityException => ({
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'SecurityException',
    metadata: { name, namespace: 'shop' },
    spec: { expiresAt },
  });
  const clusterWide: ClusterSecurityException = {
    apiVersion: 'kubescape.io/v1beta1',
    kind: 'ClusterSecurityException',
    metadata: { name: 'cluster-wide' },
    spec: { expiresAt: '2026-11-05T00:00:00Z' },
  };

  expect(
    expiringExceptions(
      {
        namespaced: [
          namespaced('no-expiry'),
          namespaced('later', '2026-12-31T00:00:00Z'),
          namespaced('expired', '2026-10-01T00:00:00Z'),
        ],
        cluster: [clusterWide],
      },
      'cluster-a',
      now
    )
  ).toEqual([
    {
      name: 'expired',
      namespace: 'shop',
      cluster: 'cluster-a',
      expiresAt: '2026-10-01T00:00:00Z',
      expired: true,
    },
    {
      name: 'cluster-wide',
      namespace: undefined,
      cluster: 'cluster-a',
      expiresAt: '2026-11-05T00:00:00Z',
      expired: false,
    },
  ]);
});
