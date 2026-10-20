import {
  getImageScanKey,
  getImageScans,
  getManifestReferenceKey,
  toImageScan,
  WorkloadScan,
} from './scanData';
import { manifest, T0, T1, T2 } from './testFixtures';

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
