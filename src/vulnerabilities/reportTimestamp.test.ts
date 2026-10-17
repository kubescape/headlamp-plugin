import { getVulnerabilityReportCreatedAt } from './reportTimestamp';
import { manifest, T0, T1, T2 } from './testFixtures';

it.each([
  ['2026-10-17T10:00:00Z', T1],
  ['2026-10-17T15:30:00+05:30', T1],
  ['2026-10-17T10:00:00.123456789Z', '2026-10-17T10:00:00.123Z'],
  ['2024-02-29T12:00:00Z', '2024-02-29T12:00:00.000Z'],
  ['2000-02-29T12:00:00Z', '2000-02-29T12:00:00.000Z'],
])('normalizes RFC3339 %s', (value, expected) => {
  expect(getVulnerabilityReportCreatedAt(manifest(value))).toBe(expected);
});

it.each([
  '',
  'garbage',
  '2026-02-30T12:00:00Z',
  '2026-02-29T12:00:00Z',
  '1900-02-29T12:00:00Z',
  '2026-04-31T12:00:00Z',
  '2026-00-01T00:00:00Z',
  '2026-13-01T00:00:00Z',
  '2026-01-00T00:00:00Z',
  '2026-01-01T24:00:00Z',
  '2026-01-01T00:60:00Z',
  '2026-01-01T00:00:60Z',
  '2026-01-01T00:00:00+24:00',
  '2026-01-01T00:00:00+00:60',
  '2026-01-01',
  '2026-01-01T00:00:00',
  '0001-01-01T00:00:00Z',
  '0001-01-01T00:00:00.000Z',
  '0000-01-01T00:00:00Z',
])('rejects invalid or zero evaluation time %s', value => {
  expect(getVulnerabilityReportCreatedAt(manifest(value))).toBeUndefined();
});

it('handles every legacy shape without falling back to creation time', () => {
  const report = manifest();
  const specs = [
    { payload: report.spec.payload },
    { ...report.spec, metadata: {} },
    { ...report.spec, metadata: { report: {} } },
    { ...report.spec, metadata: { report: { createdAt: null } } },
  ];
  specs.forEach(spec => expect(getVulnerabilityReportCreatedAt({ spec })).toBeUndefined());
  expect(getVulnerabilityReportCreatedAt(null)).toBeUndefined();
  expect(getVulnerabilityReportCreatedAt()).toBeUndefined();
});

it('advances only the report date when an updated record is supplied', () => {
  const report = manifest();
  expect(getVulnerabilityReportCreatedAt(report)).toBe(T1);
  report.spec.metadata!.report!.createdAt = T2;
  expect(getVulnerabilityReportCreatedAt(report)).toBe(T2);
  expect(report.metadata.creationTimestamp).toBe(T0);
});
