import {
  isNewer,
  newestOfVersion,
  newestRelease,
  newestTag,
  parseVersion,
  releaseLineOf,
} from './versions';

describe('parseVersion', () => {
  it('splits a tag into its prefix, numbers and variant', () => {
    expect(parseVersion('v3.13.2-distroless')).toEqual({
      prefix: 'v',
      numbers: [3, 13, 2],
      suffix: '-distroless',
      shape: '-distroless',
      suffixNumbers: [],
    });
    expect(parseVersion('distroless-v1.38.4')?.prefix).toBe('distroless-v');
    expect(parseVersion('1.31.3-alpine3.24')).toMatchObject({
      numbers: [1, 31, 3],
      shape: '-alpine#.#',
      suffixNumbers: [3, 24],
    });
    expect(parseVersion('26.7.0.124771-community')?.numbers).toEqual([26, 7, 0, 124771]);
    expect(parseVersion('8')?.numbers).toEqual([8]);
  });

  it('does not take names, commit hashes or variants for versions', () => {
    for (const tag of ['latest', 'slim', 'alpine', '1f4ea68e', 'alpine3.24', 'sha256-abc']) {
      expect(parseVersion(tag)).toBeUndefined();
    }
  });
});

// tags of quay.io/prometheus/prometheus, the most recent first
const prometheusTags = [
  'main-busybox',
  'main-distroless',
  'main',
  'v3-distroless',
  'latest-distroless',
  'v3',
  'latest',
  'v3.15.1-distroless',
  'v3.15.1',
  'v3.15.1-busybox',
  'v3.13.5-distroless',
  'v3.13.5',
  'v3.15.0-rc.1-distroless',
  'v3.15.0-rc.1',
  'v3.13.2-distroless',
];

describe('newestTag', () => {
  it('finds the newest tag of the same variant', () => {
    expect(newestTag('v3.13.2-distroless', prometheusTags)).toBe('v3.15.1-distroless');
    expect(newestTag('v3.13.2', prometheusTags)).toBe('v3.15.1');
    expect(newestTag('v3.15.1', prometheusTags)).toBe('v3.15.1');
  });

  it('follows a pre-release to its release', () => {
    expect(newestTag('v3.15.0-rc.1', prometheusTags)).toBe('v3.15.1');
  });

  it('compares the version in a variant', () => {
    expect(newestTag('1.31.3-alpine3.24', ['1.31.3-alpine3.25', '1.31.2-alpine3.26'])).toBe(
      '1.31.3-alpine3.25'
    );
  });

  it('has nothing for a tag that is not a version', () => {
    expect(newestTag('latest', prometheusTags)).toBeUndefined();
  });
});

describe('newestRelease', () => {
  it('skips tags of other artifacts and pre-releases', () => {
    // tags of Helm charts, merge builds and pre-releases next to the releases
    expect(newestRelease('v0.8.7', ['chart-3.0.0', '0.8.9-rc1', '0.8.8', '0.8.7'])).toBe('0.8.8');
    expect(newestRelease('v1.4.19', ['merge-1263', '2.0.0-beta.2', '1.4.23'])).toBe('1.4.23');
    expect(newestRelease('2.15.0', ['3.6.0-bc2', '3.5.0'])).toBe('3.5.0');
    expect(newestRelease('1.25.3.1-alpine-apk', ['1.29.8.1rc1', '1.27.1.2'])).toBe('1.27.1.2');
  });

  it('counts pre-releases for a tag that is one', () => {
    expect(newestRelease('v0.8.9-rc1', ['chart-3.0.0', '0.8.9-rc1', '0.8.8'])).toBe('0.8.9-rc1');
    expect(newestRelease('v0.8.9-rc1', ['0.8.9-rc2', '0.8.9'])).toBe('0.8.9');
  });

  it('takes numbered builds for releases', () => {
    // versions with a build number, as endoflife.date lists some products
    expect(newestRelease('3.95.0', ['3.95.4-01', '3.97.2-02', '3.96.4-01'])).toBe('3.97.2-02');
  });
});

describe('newestOfVersion', () => {
  it('takes a newer version of the same format or a release', () => {
    expect(newestOfVersion('2026.1.3-linux', '2026.2.1')).toBe('2026.2.1');
    expect(newestOfVersion('5.0.3-main', '5.0.4-main')).toBe('5.0.4-main');
  });

  it('keeps the tag when the version is not newer', () => {
    expect(newestOfVersion('5.0.3-main', '5.0.3-main')).toBe('5.0.3-main');
    expect(newestOfVersion('v1.18.4', '1.18.1')).toBe('v1.18.4');
  });

  it('ignores names and variants of other formats', () => {
    // what shields.io answers for nginx, as it sorts tags such as stable-alpine3.24 too
    expect(newestOfVersion('1.31.3-alpine3.24', 'stable-alpine3.24')).toBeUndefined();
    expect(newestOfVersion('1.31.3', '1.31.8-perl')).toBeUndefined();
    expect(newestOfVersion('8.21.0', 'invalid response data')).toBeUndefined();
  });
});

describe('isNewer', () => {
  it('compares the numbers whatever the prefix or variant', () => {
    expect(isNewer('v2.8.0', '2.14.0')).toBe(true);
    expect(isNewer('1.31.3-alpine3.24', '1.31.8')).toBe(true);
    expect(isNewer('1.31.8-alpine3.24', '1.31.8')).toBe(false);
    expect(isNewer('v1.12.1-distroless', 'v1.12.1-distroless')).toBe(false);
    expect(isNewer('1.31.3-alpine3.24', '1.31.3-alpine3.25')).toBe(true);
  });

  it('only counts a newer line for a tag that follows its line', () => {
    expect(isNewer('8', '8.39.0')).toBe(false);
    expect(isNewer('3.4-alpine', '3.4.7')).toBe(false);
    expect(isNewer('1.29', '1.31.8')).toBe(true);
  });

  it('takes a release for newer than its pre-release', () => {
    expect(isNewer('0.28.0-alpha3', '0.28.0')).toBe(true);
    expect(isNewer('0.28.0', '0.28.0-alpha3')).toBe(false);
  });

  it('is false when either is not a version', () => {
    expect(isNewer('latest', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', 'main')).toBe(false);
  });
});

describe('releaseLineOf', () => {
  const lines = (...names: string[]) => names.map(name => ({ name }));

  it('finds the most specific line of a tag', () => {
    expect(releaseLineOf('8.0.29', lines('9.0', '8.2', '8.0', '8'))?.name).toBe('8.0');
    expect(releaseLineOf('17.5', lines('18', '17'))?.name).toBe('17');
    expect(releaseLineOf('18.4-standard-trixie', lines('18', '17'))?.name).toBe('18');
    expect(releaseLineOf('1.53.0', lines('2', '1'))?.name).toBe('1');
    expect(releaseLineOf('3.4-alpine', lines('3.4', '3.3'))?.name).toBe('3.4');
  });

  it('has none for an unknown line or a tag that is not a version', () => {
    expect(releaseLineOf('5.1.0', lines('5.0', '6.0'))).toBeUndefined();
    expect(releaseLineOf('8', lines('8.0'))).toBeUndefined();
    expect(releaseLineOf('latest', lines('1'))).toBeUndefined();
  });
});
