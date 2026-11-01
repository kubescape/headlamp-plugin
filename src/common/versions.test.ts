import { compareVersions } from './versions';

it.each([
  ['1.2.10', '1.2.9'],
  ['2.0.0', '1.99.99'],
  ['v1.3.0', '1.2.0'],
  ['1.2.3-r2', '1.2.3-r1'],
  ['1:2.0-1', '1:1.9-4'],
  ['3.0.13-0+deb12u1', '3.0.11-1~deb12u2'],
  ['1.2.4', '1.2'],
])('orders %s above %s', (higher, lower) => {
  expect(compareVersions(higher, lower)).toBeGreaterThan(0);
  expect(compareVersions(lower, higher)).toBeLessThan(0);
});

it('treats a leading v as part of the version syntax', () => {
  expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
});
