import {
  expiresAtToDate,
  matchLabelsToRows,
  rowsToMatchLabels,
  sanitizeName,
  toExpiresAt,
  toImageGlob,
} from './shared';

describe('sanitizeName', () => {
  it('turns a CVE and workload pair into a valid object name', () => {
    expect(sanitizeName('CVE-2024-1234-nginx')).toBe('cve-2024-1234-nginx');
  });

  it('collapses runs of separators and trims them from both ends', () => {
    expect(sanitizeName('__C-0034__/nginx__')).toBe('c-0034-nginx');
  });

  it('keeps the result within the 63 character limit and never ends in a dash', () => {
    const name = sanitizeName('a'.repeat(62) + '-' + 'b'.repeat(20));
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith('-')).toBe(false);
  });
});

describe('toImageGlob', () => {
  it('replaces the tag with a wildcard', () => {
    expect(toImageGlob('docker.io/library/nginx:1.25')).toBe('docker.io/library/nginx:*');
  });

  it('adds a wildcard tag when the reference has none', () => {
    expect(toImageGlob('docker.io/library/nginx')).toBe('docker.io/library/nginx:*');
  });

  it('strips a digest before computing the glob', () => {
    expect(toImageGlob('docker.io/library/nginx@sha256:abc')).toBe('docker.io/library/nginx:*');
    expect(toImageGlob('docker.io/library/nginx:1.25@sha256:abc')).toBe(
      'docker.io/library/nginx:*'
    );
  });

  it('is not confused by a registry port', () => {
    expect(toImageGlob('registry.local:5000/nginx')).toBe('registry.local:5000/nginx:*');
  });
});

describe('expiry helpers', () => {
  it('anchors a picked day to the end of that day so it is not already expired', () => {
    expect(toExpiresAt('2026-09-01')).toBe('2026-09-01T23:59:59Z');
    expect(new Date(toExpiresAt('2026-09-01')).getTime()).toBeGreaterThan(
      new Date('2026-09-01T00:00:00Z').getTime()
    );
  });

  it('round-trips back to the date shown in the picker', () => {
    expect(expiresAtToDate(toExpiresAt('2026-09-01'))).toBe('2026-09-01');
    expect(expiresAtToDate(undefined)).toBe('');
  });
});

describe('label row helpers', () => {
  it('round-trips matchLabels through the editor rows', () => {
    const labels = { app: 'nginx', tier: 'web' };
    expect(rowsToMatchLabels(matchLabelsToRows(labels))).toEqual(labels);
  });

  it('drops rows with no key', () => {
    expect(rowsToMatchLabels([{ key: '', value: 'x' }, { key: 'app', value: 'nginx' }])).toEqual({
      app: 'nginx',
    });
  });

  it('returns an empty object for an absent selector', () => {
    expect(matchLabelsToRows(undefined)).toEqual([]);
    expect(rowsToMatchLabels([])).toEqual({});
  });
});
