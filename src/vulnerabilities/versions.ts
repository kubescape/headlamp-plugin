/*
  Version tags of images: which tags have the same format as the tag of an image, and which
  version is the newest. Tags are not semver: they carry prefixes (v, distroless-v), variants
  (-alpine3.24, -distroless, -linux) and floating release lines (8, 3.4-alpine).
*/

export interface ParsedVersion {
  // the text before the numbers, lower case, such as v or distroless-v
  prefix: string;
  numbers: number[];
  // the text after the numbers, such as -alpine3.24
  suffix: string;
  // the suffix with its numbers replaced by #, which tags of the same variant share
  shape: string;
  suffixNumbers: number[];
}

// words before the numbers end with - or _, and the text after them starts with a separator, so
// commit hashes such as 1f4ea68e and names such as alpine3.24 are not versions
const versionPattern = /^((?:[a-z]+[-_])*v?)(\d+(?:\.\d+)*)((?:[-_+.~][0-9a-z][0-9a-z._+~-]*)?)$/i;

const prereleasePattern =
  /(?:^|[-_.+~])(?:alpha|beta|rc|pre|preview|dev|snapshot|nightly|canary|unstable)(?:[-_.]?\d+)*(?=$|[-_.+~])/i;

/** The parts of a version tag, or undefined for tags such as latest, slim or a commit hash. */
export function parseVersion(tag: string): ParsedVersion | undefined {
  const match = tag.trim().match(versionPattern);
  if (!match) return undefined;
  const [, prefix, numbers, suffix] = match;
  return {
    prefix: prefix.toLowerCase(),
    numbers: numbers.split('.').map(Number),
    suffix,
    shape: suffix.toLowerCase().replace(/\d+/g, '#'),
    suffixNumbers: (suffix.match(/\d+/g) ?? []).map(Number),
  };
}

export function isPrerelease(version: ParsedVersion) {
  return prereleasePattern.test(version.suffix);
}

function compareNumbers(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Orders versions by their numbers, a release after its pre-releases, then by variant. */
export function compareVersions(a: ParsedVersion, b: ParsedVersion) {
  return (
    compareNumbers(a.numbers, b.numbers) ||
    Number(!isPrerelease(a)) - Number(!isPrerelease(b)) ||
    compareNumbers(a.suffixNumbers, b.suffixNumbers)
  );
}

function sameFormat(tag: ParsedVersion, candidate: ParsedVersion) {
  if (candidate.prefix !== tag.prefix || candidate.numbers.length !== tag.numbers.length) {
    return false;
  }
  // a pre-release is followed by the release
  return candidate.shape === tag.shape || (isPrerelease(tag) && candidate.shape === '');
}

/**
 * The newest of the tags of a registry in the format of the tag, so that v3.13.2-distroless is
 * compared with v3.15.1-distroless and not with v3.15.1 or main. The tag itself when it is the
 * newest, and undefined when the tag is not a version.
 */
export function newestTag(tag: string, tags: string[]): string | undefined {
  const current = parseVersion(tag);
  if (!current) return undefined;
  let newest = { tag, version: current };
  for (const candidate of tags) {
    const version = parseVersion(candidate);
    if (version && sameFormat(current, version) && compareVersions(version, newest.version) > 0) {
      newest = { tag: candidate, version };
    }
  }
  return newest.tag;
}

/**
 * Whether a version counts as a release of the project: its numbers, perhaps after a v. Projects
 * tag other artifacts too (chart-3.0.0, merge-1263), and letters after the numbers mark a
 * pre-release (3.6.0-bc2), where 3.97.2-02 is a release.
 */
function isRelease(version: ParsedVersion, current: ParsedVersion) {
  if (version.prefix !== '' && version.prefix !== 'v') return false;
  if (!/[a-z]/i.test(version.suffix)) return true;
  return isPrerelease(current) && isPrerelease(version);
}

/**
 * The newest release of a project, such as its GitHub releases, for an image tag: releases are
 * compared by their numbers, and pre-releases only count for a tag that is one.
 */
export function newestRelease(tag: string, releases: string[]): string | undefined {
  const current = parseVersion(tag);
  if (!current) return undefined;
  let newest: { release: string; version: ParsedVersion } | undefined;
  for (const release of releases) {
    const version = parseVersion(release);
    if (!version || !isRelease(version, current)) continue;
    if (!newest || compareVersions(version, newest.version) > 0) newest = { release, version };
  }
  return newest?.release;
}

/**
 * The newer of a tag and a version that a service names for its image, when that version has the
 * format of the tag or is a release: the tag itself when it is not older.
 */
export function newestOfVersion(tag: string, version: string): string | undefined {
  const current = parseVersion(tag);
  const candidate = parseVersion(version);
  if (!current || !candidate) return undefined;
  if (!sameFormat(current, candidate) && !isRelease(candidate, current)) return undefined;
  return compareVersions(candidate, current) > 0 ? version : tag;
}

/**
 * Whether a version is newer than the tag of an image. A tag with fewer numbers, such as 8 or
 * 3.4-alpine, follows its release line, so only a newer line counts.
 */
export function isNewer(tag: string, latest: string): boolean {
  const current = parseVersion(tag);
  const candidate = parseVersion(latest);
  if (!current || !candidate) return false;
  const difference = compareNumbers(
    current.numbers,
    candidate.numbers.slice(0, current.numbers.length)
  );
  if (difference !== 0) return difference < 0;
  if (candidate.numbers.length > current.numbers.length) return false;
  if (isPrerelease(current) && !isPrerelease(candidate)) return true;
  return (
    current.shape === candidate.shape &&
    compareNumbers(current.suffixNumbers, candidate.suffixNumbers) < 0
  );
}

/**
 * The release line of a tag among the lines of a product, named by their leading numbers such as
 * 8.0 or 17: the most specific line whose numbers start the numbers of the tag.
 */
export function releaseLineOf<T extends { name: string }>(tag: string, lines: T[]): T | undefined {
  const current = parseVersion(tag);
  if (!current) return undefined;
  let found: { line: T; length: number } | undefined;
  for (const line of lines) {
    const numbers = line.name
      .match(/\d+(?:\.\d+)*/)?.[0]
      .split('.')
      .map(Number);
    if (
      numbers &&
      numbers.length <= current.numbers.length &&
      numbers.every((number, i) => number === current.numbers[i]) &&
      (!found || numbers.length > found.length)
    ) {
      found = { line, length: numbers.length };
    }
  }
  return found?.line;
}
