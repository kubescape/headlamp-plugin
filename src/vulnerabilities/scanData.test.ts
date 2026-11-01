import {
  getImageScanKey,
  getImageScans,
  getManifestReferenceKey,
  ImageScan,
  toImageScan,
  toWorkloadScan,
  WorkloadScan,
} from './scanData';
import { manifest, summary, T0, T1, T2 } from './testFixtures';

it('maps timestamps without changing identity or findings', () => {
  const report = manifest();
  const scan = toImageScan(report);
  expect(scan).toEqual({
    manifestName: 'image-123',
    namespace: 'reports',
    cluster: 'cluster-a',
    imageName: 'example:latest',
    creationTimestamp: T0,
    reportCreatedAt: T1,
    matches: report.spec.payload.matches,
  });
  expect(scan.matches).toBe(report.spec.payload.matches);
});

it('maps legacy and empty/missing findings without manufacturing an evaluation time', () => {
  const report = manifest();
  delete report.spec.metadata;
  report.spec.payload.matches = [];
  expect(toImageScan(report).reportCreatedAt).toBeUndefined();
  expect(toImageScan(report).matches).toEqual([]);
  Reflect.deleteProperty(report.spec.payload, 'matches');
  expect(toImageScan(report).matches).toEqual([]);
});

it('finds the reports in the operator namespace when the summary refers to the workload namespace', () => {
  // as Kubescape stores them: all reports in the operator namespace
  const report = (cluster: string, name: string, namespace = 'kubescape') => {
    const scan = toImageScan(manifest());
    return { ...scan, cluster, namespace, manifestName: name };
  };
  const images = new Map<string, ImageScan>(
    [
      report('cluster-a', 'image-123'),
      report('cluster-a', 'relevant-123'),
      report('cluster-b', 'other-image'),
    ].map(scan => [getImageScanKey(scan), scan])
  );
  const s = summary();
  s.spec.vulnerabilitiesRef.all = {
    kind: 'vulnerabilitymanifests',
    name: 'image-123',
    namespace: 'workloads',
  };
  s.spec.vulnerabilitiesRef.relevant = {
    kind: 'vulnerabilitymanifests',
    name: 'relevant-123',
    namespace: 'workloads',
  };

  const workload = toWorkloadScan(s, images);

  expect(workload.imageScan?.manifestName).toBe('image-123');
  expect(workload.relevant?.manifestName).toBe('relevant-123');

  // a report of the same name in another cluster is not the one
  s.metadata.cluster = 'cluster-b';
  expect(toWorkloadScan(s, images).imageScan).toBeUndefined();

  // the referenced report wins when it exists where the summary says
  const exact = report('cluster-a', 'image-123', 'workloads');
  images.set(getImageScanKey(exact), exact);
  s.metadata.cluster = 'cluster-a';
  expect(toWorkloadScan(s, images).imageScan).toBe(exact);
});

it('uses cluster and referenced namespace in keys, with the legacy namespace default', () => {
  expect(getManifestReferenceKey('cluster-a', { name: 'image-123', namespace: 'reports' })).toBe(
    getImageScanKey(toImageScan(manifest()))
  );
  expect(getManifestReferenceKey('cluster-a', { name: 'image-123' })).toBe(
    JSON.stringify(['cluster-a', 'kubescape', 'image-123'])
  );
  expect(getManifestReferenceKey('cluster-a')).toBeUndefined();
  expect(getManifestReferenceKey('cluster-a', { name: '' })).toBeUndefined();
});

it('deduplicates only the same cluster/namespace/name tuple', () => {
  const a = toImageScan(manifest());
  const b = { ...a, cluster: 'cluster-b', reportCreatedAt: T2 };
  const c = { ...a, namespace: 'other-reports' };
  const workloads = [a, a, b, c].map(imageScan => ({ imageScan } as WorkloadScan));
  expect(getImageScans(workloads)).toEqual([a, b, c]);
});
