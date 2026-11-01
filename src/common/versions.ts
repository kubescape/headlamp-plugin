// Splits a version into runs of digits and runs of other characters, e.g. "1.10.0-r2"
// into [1, ".", 10, ".", 0, "-r", 2], ignoring a leading "v".
function versionTokens(version: string): Array<number | string> {
  return (version.replace(/^v(?=\d)/, '').match(/\d+|\D+/g) ?? []).map(token =>
    /^\d+$/.test(token) ? Number(token) : token
  );
}

/**
 * Compares package versions of the formats found in scan results (semver, Debian and Alpine
 * package versions): numbers compare as numbers and the rest as text. A version that is a
 * prefix of the other is the lower one.
 */
export function compareVersions(a: string, b: string): number {
  const [tokensA, tokensB] = [versionTokens(a), versionTokens(b)];
  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    const [x, y] = [tokensA[i], tokensB[i]];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y));
  }
  return tokensA.length - tokensB.length;
}
