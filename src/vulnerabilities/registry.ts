/*
  The web page of the registry of an image, where its newer tags are listed.
*/

export interface ImageReference {
  registry: string;
  // the path of the image in the registry, without tag or digest
  repository: string;
}

const dockerHubHosts = new Set([
  'docker.io',
  'index.docker.io',
  'registry-1.docker.io',
  'registry.hub.docker.com',
]);

/**
 * Splits an image reference like Docker does: the first component is the registry when it
 * looks like a host, and Docker Hub otherwise.
 */
export function parseImageReference(image: string): ImageReference | undefined {
  const withoutDigest = image.trim().split('@')[0];
  const withoutTag = withoutDigest.replace(/:[^/:]*$/, '');
  const components = withoutTag.split('/').filter(Boolean);
  if (components.length === 0) return undefined;
  const [first, ...rest] = components;
  const isHost = rest.length > 0 && (/[.:]/.test(first) || first === 'localhost');
  const registry = isHost ? first.toLowerCase() : 'docker.io';
  const path = isHost ? rest : components;
  if (path.length === 0) return undefined;
  const repository =
    dockerHubHosts.has(registry) && path.length === 1 ? `library/${path[0]}` : path.join('/');
  return { registry: dockerHubHosts.has(registry) ? 'docker.io' : registry, repository };
}

/** The tag of an image reference, without its digest; undefined when it names none. */
export function imageTag(image: string): string | undefined {
  return image
    .trim()
    .split('@')[0]
    .match(/:([^/:]+)$/)?.[1];
}

export interface RegistryPage {
  // the name of the registry, such as Docker Hub
  name: string;
  url: string;
}

/** The page of the registry that lists the tags of the image, for registries that have one. */
export function registryPage(image: string): RegistryPage | undefined {
  const reference = parseImageReference(image);
  if (!reference) return undefined;
  const { registry, repository } = reference;
  if (registry === 'docker.io') {
    const officialImage = repository.match(/^library\/([^/]+)$/);
    return {
      name: 'Docker Hub',
      url: officialImage
        ? `https://hub.docker.com/_/${officialImage[1]}/tags`
        : `https://hub.docker.com/r/${repository}/tags`,
    };
  }
  if (registry === 'quay.io') {
    return { name: 'Quay', url: `https://quay.io/repository/${repository}?tab=tags` };
  }
  // GitHub redirects to the page of the package
  if (registry === 'ghcr.io') {
    return { name: 'GitHub', url: `https://ghcr.io/${repository}` };
  }
  // Google redirects to the repository in the Cloud console
  if (
    registry === 'gcr.io' ||
    registry.endsWith('.gcr.io') ||
    registry.endsWith('-docker.pkg.dev')
  ) {
    return { name: 'Google Cloud', url: `https://${registry}/${repository}` };
  }
  if (registry === 'mcr.microsoft.com') {
    return {
      name: 'Microsoft Artifact Registry',
      url: `https://mcr.microsoft.com/en-us/artifact/mar/${repository}/tags`,
    };
  }
  if (registry === 'public.ecr.aws') {
    return { name: 'Amazon ECR Public Gallery', url: `https://gallery.ecr.aws/${repository}` };
  }
  return undefined;
}
