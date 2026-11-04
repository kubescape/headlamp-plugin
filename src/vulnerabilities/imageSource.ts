/*
  The repository an image is built from, as the image says in its labels. Kubescape keeps the
  image config with the vulnerability report of the image, so the plugin reads the labels from
  there; the registries themselves do not allow other sites to read them.
*/

const sourceLabels = ['org.opencontainers.image.source', 'org.label-schema.vcs-url'];

/**
 * The source repository the labels of an image name, from the image config of its report: the
 * config as base64 encoded JSON, as Grype records it.
 */
export function imageSourceLabel(config?: string | null): string | undefined {
  if (!config) return undefined;
  try {
    const bytes = Uint8Array.from(atob(config), char => char.charCodeAt(0));
    const labels = JSON.parse(new TextDecoder().decode(bytes))?.config?.Labels ?? {};
    const source = sourceLabels
      .map(label => labels[label])
      .find(value => typeof value === 'string');
    return source?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The GitHub project of a source repository, as owner/name, such as example-org/app
 * for https://github.com/example-org/app or git@github.com:example-org/app.git.
 */
export function githubProjectOfSource(source?: string): string | undefined {
  const match = source
    ?.trim()
    .match(
      /^(?:git\+)?(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?(?:www\.)?github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:[/#?].*)?$/i
    );
  return match ? `${match[1]}/${match[2]}` : undefined;
}
