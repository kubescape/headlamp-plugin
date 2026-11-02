/*
  Where the newest version of an image is looked up. The plugin runs in the browser, which may
  only read services that allow other sites to: Docker Hub, GHCR, MCR, Amazon's public registry
  and Google's registries do not. So the tags of quay.io images come from Quay, those of gcr.io,
  *-docker.pkg.dev and registry.k8s.io images from the API of Google's Artifact Registry, those
  of the official images of Docker Hub from the library files Docker builds them from, the newest
  version of other Docker Hub images from shields.io, and the versions of GitHub projects from
  jsDelivr. The GitHub project of an image is the one its registry implies (ghcr.io, Crossplane
  packages) or the one its labels name (org.opencontainers.image.source). The release lines come
  from endoflife.date, whose products are found by the image, the project or the name. There is
  no list of known images: every image is looked up the same way. version-checker, when it runs
  in a cluster, checks every image there against its own registry.

  The name of an image only goes to its own registry, and to other services once it is known to
  be public: by its registry, which holds only public images (registry.k8s.io) or answers for it
  (Quay, Artifact Registry), as an official image of Docker Hub on the list that jsDelivr reads
  once a day without naming an image, or, for the project of a ghcr.io image, by GitHub, which
  runs ghcr.io and shows whether the project is public. Docker Hub cannot be asked from the
  browser, so the name of another Docker Hub image,
  which may be private, only goes to shields.io when the settings allow names that may be private
  (possiblyPrivate); so do the projects of ghcr.io images that GitHub does not show and of Upbound
  packages of other publishers than Upbound and the Crossplane community. Switching that setting
  off stops those requests that were not sent yet (possiblyPrivatePermit). The project an image's
  labels name is only asked about when the image is public. Answers are kept for a day, in
  localStorage where they are small.
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { githubProjectOfSource } from './imageSource';
import { ImageReference, imageTag, parseImageReference, registryPage } from './registry';
import { newestOfVersion, newestRelease, newestTag, parseVersion, releaseLineOf } from './versions';

export interface VersionSource {
  name: string;
  url?: string;
}

export interface LatestVersion {
  latest: string;
  source: VersionSource;
}

/** A release line of a product at endoflife.date, such as MongoDB 8.0. */
export interface ReleaseLine {
  product: string;
  name: string;
  // the newest version of the line
  latest?: string;
  // whether the line reached its end of life, and the date it does or did
  eol: boolean;
  eolFrom?: string;
  url: string;
}

export interface PublicVersion {
  latest?: LatestVersion;
  line?: ReleaseLine;
}

const day = 24 * 3600 * 1000;
// a service that failed is asked again after an hour
const retryAfter = 3600 * 1000;
const storageName = 'kubescape-plugin.image-versions.';
// raised when lookups change, so that answers of the old lookups are not used
const storageVersion = 7;
const storagePrefix = `${storageName}${storageVersion}.`;

const memory = new Map<string, { expires: number; value: Promise<unknown> }>();
let pruned = false;

export interface VersionCheckerResult {
  latest: string;
  isLatest: boolean;
}

const versionCheckers = new Map<
  string,
  { expires: number; value: Promise<Map<string, VersionCheckerResult>> }
>();

/** Forgets the answers kept in memory; the tests start from nothing. */
export function clearVersionCache() {
  memory.clear();
  versionCheckers.clear();
  pruned = false;
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function pruneStorage(now: number) {
  const store = storage();
  if (!store) return;
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key?.startsWith(storageName)) continue;
      const at = key.startsWith(storagePrefix) && JSON.parse(store.getItem(key) ?? '{}')?.at;
      if (typeof at !== 'number' || now - at >= day || at > now) store.removeItem(key);
    }
  } catch {
    // nothing to clean up in a full or blocked storage
  }
}

function readStored(key: string, now: number): { at: number; value: unknown } | undefined {
  try {
    const stored = JSON.parse(storage()?.getItem(storagePrefix + key) ?? 'null');
    if (typeof stored?.at !== 'number' || now - stored.at >= day || stored.at > now) {
      return undefined;
    }
    return { at: stored.at, value: stored.value ?? null };
  } catch {
    return undefined;
  }
}

function writeStored(key: string, value: unknown, now: number) {
  try {
    storage()?.setItem(storagePrefix + key, JSON.stringify({ at: now, value }));
  } catch {
    // the answer is still kept in memory
  }
}

/**
 * The answer of a lookup, kept a day: in memory, and in localStorage when it is small. A lookup
 * that throws keeps throwing for an hour, without asking the service again, so that lookups
 * built on it are not stored either.
 */
export function cached<T>(
  key: string,
  load: () => Promise<T | null>,
  options: { persist?: boolean; now?: number } = {}
): Promise<T | null> {
  const now = options.now ?? Date.now();
  const entry = memory.get(key);
  if (entry && now < entry.expires) return entry.value as Promise<T | null>;
  if (options.persist) {
    if (!pruned) {
      pruned = true;
      pruneStorage(now);
    }
    const stored = readStored(key, now);
    if (stored) {
      const value = Promise.resolve(stored.value as T | null);
      memory.set(key, { expires: stored.at + day, value });
      return value;
    }
  }
  const value = load().then(
    result => {
      if (options.persist) writeStored(key, result ?? null, now);
      return result ?? null;
    },
    error => {
      if (error instanceof LookupStopped) {
        // nothing failed, so the next lookup asks again
        if (memory.get(key)?.value === value) memory.delete(key);
      } else {
        // the failure is not stored, nor an answer built on it
        memory.set(key, { expires: now + retryAfter, value });
      }
      throw error;
    }
  );
  value.catch(() => {});
  memory.set(key, { expires: now + day, value });
  return value;
}

/*
  The names of images that may be private are only sent with a permit, which switching the setting
  off revokes: the requests that wait their turn and those that lookups have yet to make are then
  not sent.
*/
let privateNames = new AbortController();

/** The permit to send the names of images that may be private, while the settings allow it. */
export function possiblyPrivatePermit(): AbortSignal {
  return privateNames.signal;
}

/** Revokes the permit, when the settings no longer allow names that may be private. */
export function stopPossiblyPrivateLookups() {
  privateNames.abort();
  privateNames = new AbortController();
}

/** A request that was not sent, as its permit was revoked. */
class LookupStopped extends Error {}

// at most four requests at a time, so that a list of images does not flood the services
const maxRequests = 4;
let running = 0;
const waiting: Array<() => void> = [];

/** Waits for a free request; a revoked permit takes the request out of the queue. */
function waitTurn(permit?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const stop = () => {
      const index = waiting.indexOf(turn);
      if (index >= 0) waiting.splice(index, 1);
      reject(new LookupStopped());
    };
    const turn = () => {
      permit?.removeEventListener('abort', stop);
      resolve();
    };
    if (permit?.aborted) return stop();
    waiting.push(turn);
    permit?.addEventListener('abort', stop, { once: true });
  });
}

/**
 * The JSON of a public service; null for a repository it does not know or may not show, which it
 * says with one of the missing statuses. A request with a permit is only sent while it holds.
 */
async function fetchBody(
  url: string,
  as: 'json' | 'text',
  missing: number[] = [401, 403, 404],
  permit?: AbortSignal
): Promise<any> {
  while (running >= maxRequests) {
    await waitTurn(permit);
  }
  if (permit?.aborted) {
    // the turn goes to the next request
    waiting.shift()?.();
    throw new LookupStopped();
  }
  running++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (missing.includes(response.status)) return null;
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return as === 'json' ? await response.json() : await response.text();
  } finally {
    clearTimeout(timer);
    running--;
    waiting.shift()?.();
  }
}

function fetchJson(url: string, permit?: AbortSignal): Promise<any> {
  return fetchBody(url, 'json', undefined, permit);
}

function strings(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

/** The active tags of a quay.io repository, the most recent first. */
function quayTags(repository: string) {
  return cached<string[]>(`quay|${repository}`, async () => {
    const tags: string[] = [];
    // the newest versions are among the tags pushed last
    for (let page = 1; page <= 5; page++) {
      const body = await fetchJson(
        `https://quay.io/api/v1/repository/${repository}/tag/?onlyActiveTags=true&limit=100&page=${page}`
      );
      if (!body) return page === 1 ? null : tags;
      tags.push(...strings((body.tags ?? []).map((tag: any) => tag?.name)));
      if (!body.has_additional) break;
    }
    return tags;
  });
}

/** The versions of a GitHub project, from the tags jsDelivr reads; GitHub's own API allows only
 * 60 requests an hour from an address. A project that may be private is asked with a permit. */
function githubVersions(project: string, permit?: AbortSignal) {
  return cached<string[]>(`github|${project}`, async () => {
    const body = await fetchJson(`https://data.jsdelivr.com/v1/packages/gh/${project}`, permit);
    return body ? strings((body.versions ?? []).map((version: any) => version?.version)) : null;
  });
}

/**
 * Whether a GitHub project is public, asked of GitHub, which runs ghcr.io and so knows the names
 * of its images already. GitHub answers 60 of these requests an hour from an address and says 403
 * after that, so the answers are kept a day, and a refusal is asked again after an hour.
 */
function isPublicGithubProject(project: string) {
  return cached<boolean>(
    `github-project|${project}`,
    async () => {
      const body = await fetchBody(`https://api.github.com/repos/${project}`, 'json', [404]);
      return body?.private === false;
    },
    { persist: true }
  );
}

interface Release {
  name: string;
  latest?: string;
  isEol: boolean;
  eolFrom?: string;
}

function endOfLifeReleases(product: string) {
  return cached<Release[]>(
    `eol|${product}`,
    async () => {
      const body = await fetchJson(
        `https://endoflife.date/api/v1/products/${encodeURIComponent(product)}/`
      );
      if (!body) return null;
      return (body.result?.releases ?? [])
        .filter((release: any) => typeof release?.name === 'string')
        .map((release: any) => ({
          name: release.name,
          latest: typeof release.latest?.name === 'string' ? release.latest.name : undefined,
          isEol: release.isEol === true,
          eolFrom: typeof release.eolFrom === 'string' ? release.eolFrom : undefined,
        }));
    },
    { persist: true }
  );
}

const dockerHubHosts = [
  'docker.io',
  'index.docker.io',
  'registry-1.docker.io',
  'registry.hub.docker.com',
];

/**
 * The key of a package URL that names an image or a GitHub project, as endoflife.date lists them:
 * registry|path for an image, with * for a pkg:docker URL that names no registry, such as
 * *|library/redis for pkg:docker/library/redis and quay.io|argoproj/argocd for
 * pkg:oci/argocd?repository_url=quay.io/argoproj, and github|owner/name for pkg:github/owner/name.
 */
export function purlKey(purl: string): string | undefined {
  const docker = purl.match(/^pkg:docker\/([^@?#]+)(?:@[^?#]*)?(?:\?([^#]*))?/);
  if (docker) {
    let path = decodeURIComponent(docker[1]).toLowerCase();
    if (!path.includes('/')) path = `library/${path}`;
    const registry = new URLSearchParams(docker[2] ?? '').get('repository_url')?.toLowerCase();
    const host = registry && (dockerHubHosts.includes(registry) ? 'docker.io' : registry);
    return `${host || '*'}|${path}`;
  }
  const oci = purl.match(/^pkg:oci\/([^@?#/]+)(?:@[^?#]*)?\?([^#]*)/);
  if (oci) {
    const url = new URLSearchParams(oci[2]).get('repository_url')?.toLowerCase();
    const [host, ...path] = url?.replace(/^https?:\/\//, '').split('/') ?? [];
    if (!host) return undefined;
    const registry = dockerHubHosts.includes(host) ? 'docker.io' : host;
    return `${registry}|${[...path, decodeURIComponent(oci[1]).toLowerCase()].join('/')}`;
  }
  const github = purl.match(/^pkg:github\/([^/@?#]+)\/([^/@?#]+)/);
  return github ? `github|${github[1]}/${github[2]}`.toLowerCase() : undefined;
}

/** The products of endoflife.date by the package URLs of their images and projects. */
function endOfLifeIdentifiers() {
  return cached<Record<string, string>>(
    'eol-identifiers',
    async () => {
      const body = await fetchJson('https://endoflife.date/api/v1/identifiers/purl/');
      if (!body) return null;
      const products: Record<string, string> = {};
      for (const entry of body.result ?? []) {
        const key = typeof entry?.identifier === 'string' && purlKey(entry.identifier);
        if (key && typeof entry.product?.name === 'string') products[key] = entry.product.name;
      }
      return products;
    },
    { persist: true }
  );
}

/** The products of endoflife.date by their names and aliases, in lower case. */
function endOfLifeNames() {
  return cached<Record<string, string>>(
    'eol-names',
    async () => {
      const body = await fetchJson('https://endoflife.date/api/v1/products/');
      if (!body) return null;
      const products: Record<string, string> = {};
      const list: any[] = (body.result ?? []).filter((p: any) => typeof p?.name === 'string');
      // a name of a product goes before the same alias of another one
      for (const product of list) products[product.name.toLowerCase()] = product.name;
      for (const product of list) {
        for (const alias of strings(product.aliases ?? [])) {
          products[alias.toLowerCase()] ??= product.name;
        }
      }
      return products;
    },
    { persist: true }
  );
}

// Amazon's public gallery mirrors the official images of Docker Hub
function canonical(reference: ImageReference): ImageReference {
  const mirrored = reference.repository.match(/^docker\/(library\/[^/]+)$/);
  return reference.registry === 'public.ecr.aws' && mirrored
    ? { registry: 'docker.io', repository: mirrored[1] }
    : reference;
}

/** A product of endoflife.date, and whether it was found by name only. */
export interface EndOfLifeMatch {
  product: string;
  byName: boolean;
}

/**
 * The endoflife.date product of an image: the product that lists the image or the GitHub project
 * it is built from, or else the product with the name of the image (tool for tool3), of its
 * project, or of the start of its name when its publisher carries that name too (tracer for
 * tracerproject/tracer-collector). A product found by name only counts when the tag of the image
 * is one of its versions.
 */
export async function endOfLifeProduct(
  reference: ImageReference,
  project?: string
): Promise<EndOfLifeMatch | undefined> {
  const { registry, repository } = canonical(reference);
  const path = repository.toLowerCase();
  const identifiers = await endOfLifeIdentifiers();
  const identified =
    identifiers?.[`${registry}|${path}`] ??
    identifiers?.[`*|${path}`] ??
    (project ? identifiers?.[`github|${project.toLowerCase()}`] : undefined);
  if (identified) return { product: identified, byName: false };

  const names = await endOfLifeNames();
  if (!names) return undefined;
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const publisher = segments.length > 1 ? segments[segments.length - 2] : '';
  const candidates = [name, name.replace(/\d+$/, ''), project?.split('/')[1]?.toLowerCase()];
  const named = candidates.find(candidate => candidate && names[candidate]);
  if (named) return { product: names[named], byName: true };
  const start = name.split('-')[0];
  if (start !== name && names[start] && publisher.includes(start)) {
    return { product: names[start], byName: true };
  }
  return undefined;
}

/**
 * The GitHub project an image is built from, as its registry implies it: ghcr.io images and the
 * packages of Crossplane's registries are named after their project.
 */
export function githubProject(reference: ImageReference): string | undefined {
  const { registry, repository } = reference;
  const [owner, name] = repository.split('/');
  if (registry === 'ghcr.io') return owner && name ? `${owner}/${name}` : undefined;
  if (registry === 'xpkg.upbound.io' || registry === 'xpkg.crossplane.io') {
    // Upbound publishes the providers of crossplane-contrib, one package per service
    const provider = repository.match(/^upbound\/provider-(?:family-)?(aws|azure|gcp)\b/);
    if (provider) return `crossplane-contrib/provider-upjet-${provider[1]}`;
    return owner && name ? `${owner}/${name}` : undefined;
  }
  return undefined;
}

// Registries that only hold public images, so that the project an image names may be asked about
const publicRegistries = [
  'registry.k8s.io',
  'public.ecr.aws',
  'mcr.microsoft.com',
  'docker.elastic.co',
  'xpkg.crossplane.io',
];

// The publishers of the Upbound marketplace whose packages are public: Upbound and the Crossplane
// community, whose names tell nothing about the cluster that runs them
const upboundPublishers = ['upbound/', 'crossplane-contrib/'];

/**
 * Whether an image is public by its name: it is in a registry that only holds public images, or
 * it is a package of a publisher of the Upbound marketplace whose packages are public; others may
 * have private repositories there.
 */
function isPublicByName({ registry, repository }: ImageReference) {
  return (
    publicRegistries.includes(registry) ||
    (registry === 'xpkg.upbound.io' &&
      upboundPublishers.some(publisher => repository.startsWith(publisher)))
  );
}

/**
 * The GitHub project the registry of an image implies, when its name may go to jsDelivr: the image
 * is public or the settings allow names that may be private (mayName), or GitHub shows the project
 * of a ghcr.io image as public.
 */
async function impliedProject(reference: ImageReference, mayName: boolean) {
  const project = githubProject(reference);
  if (!project || mayName) return project;
  if (reference.registry === 'ghcr.io' && (await isPublicGithubProject(project))) return project;
  return undefined;
}

/**
 * The names of Docker's official images: the library files that Docker builds them from, listed
 * by jsDelivr in one request a day, which names no image.
 */
function officialImageNames() {
  return cached<string[]>(
    'official-names',
    async () => {
      const body = await fetchJson(
        'https://data.jsdelivr.com/v1/packages/gh/docker-library/official-images@master?structure=flat'
      );
      if (!body) return null;
      return strings((body.files ?? []).map((file: any) => file?.name)).flatMap(
        file => file.match(/^\/library\/([^/]+)$/)?.[1] ?? []
      );
    },
    { persist: true }
  );
}

/**
 * The tags of an official image of Docker Hub, from the library files that Docker builds them
 * from, read through jsDelivr: every tag that is maintained.
 */
function officialImageTags(name: string) {
  return cached<string[]>(`official|${name}`, async () => {
    const text = await fetchBody(
      `https://cdn.jsdelivr.net/gh/docker-library/official-images@master/library/${name}`,
      'text'
    );
    if (typeof text !== 'string') return null;
    return text
      .split('\n')
      .flatMap(line => line.match(/^(?:Shared)?Tags:(.*)$/)?.[1].split(',') ?? [])
      .map(tag => tag.trim())
      .filter(Boolean);
  });
}

/**
 * The newest version of an image of Docker Hub as shields.io, which makes the version badges of
 * projects, reads it. It sorts the most recent tags by their version and adds a v to the version.
 */
function dockerHubVersion(repository: string, permit: AbortSignal) {
  return cached<string>(`shields|${repository}`, async () => {
    const body = await fetchJson(
      `https://img.shields.io/docker/v/${repository}.json?sort=semver`,
      permit
    );
    return typeof body?.value === 'string' ? body.value : null;
  });
}

/** An image in Google's Artifact Registry. */
export interface ArtifactRegistryPackage {
  project: string;
  location: string;
  repository: string;
  package: string;
}

const gcrLocations: Record<string, string> = {
  '': 'us',
  'us.': 'us',
  'eu.': 'europe',
  'asia.': 'asia',
};

/**
 * Where an image of gcr.io, a *-docker.pkg.dev registry or registry.k8s.io is in Artifact
 * Registry, whose API, unlike the registries, allows other sites to read public repositories.
 */
export function artifactRegistryPackage(
  reference: ImageReference
): ArtifactRegistryPackage | undefined {
  const parts = reference.repository.split('/');
  const gcr = reference.registry.match(/^((?:us|eu|asia)\.)?gcr\.io$/);
  if (gcr) {
    // the project of a domain, such as google.com:cloudsdktool, is written google.com/cloudsdktool
    const domain = parts[0].includes('.') ? 1 : 0;
    const name = parts.slice(1 + domain).join('/');
    if (!name) return undefined;
    return {
      project: domain ? `${parts[0]}:${parts[1]}` : parts[0],
      location: gcrLocations[gcr[1] ?? ''],
      repository: reference.registry,
      package: name,
    };
  }
  const pkgDev = reference.registry.match(/^([a-z0-9-]+)-docker\.pkg\.dev$/);
  if (pkgDev && parts.length >= 3) {
    return {
      project: parts[0],
      location: pkgDev[1],
      repository: parts[1],
      package: parts.slice(2).join('/'),
    };
  }
  // registry.k8s.io sends clients to copies of this repository in many regions
  if (reference.registry === 'registry.k8s.io') {
    return {
      project: 'k8s-artifacts-prod',
      location: 'us-central1',
      repository: 'images',
      package: reference.repository,
    };
  }
  return undefined;
}

/**
 * Whether anyone may read a repository of Artifact Registry. Private repositories are asked
 * about once a day, rather than for each of their images.
 */
function isPublicRepository(url: string) {
  return cached<boolean>(`ar-repository|${url}`, async () => !!(await fetchJson(url)), {
    persist: true,
  });
}

/** The tags of an image of Artifact Registry, in the order of their names. */
function artifactRegistryTags(image: ArtifactRegistryPackage) {
  const repositoryUrl = `https://artifactregistry.googleapis.com/v1/projects/${image.project}/locations/${image.location}/repositories/${image.repository}`;
  return cached<string[]>(`ar|${repositoryUrl}|${image.package}`, async () => {
    if (!(await isPublicRepository(repositoryUrl))) return null;
    const tags: string[] = [];
    let pageToken = '';
    // versions come before names such as latest; images with many builds have thousands of tags
    for (let page = 1; page <= 5; page++) {
      const body = await fetchJson(
        `${repositoryUrl}/packages/${encodeURIComponent(image.package)}/tags?pageSize=1000${
          pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
        }`
      );
      if (!body) return page === 1 ? null : tags;
      for (const entry of body.tags ?? []) {
        const name = typeof entry?.name === 'string' ? entry.name.split('/tags/')[1] : undefined;
        if (name) tags.push(decodeURIComponent(name));
      }
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
      if (!pageToken) break;
    }
    return tags;
  });
}

/** The newest of the tags of a registry, or nothing when the registry no longer has the tag. */
function newestListedTag(tag: string, tags: string[] | null) {
  const newest = tags && newestTag(tag, tags);
  return newest && (newest !== tag || tags.includes(tag)) ? newest : undefined;
}

/**
 * The newest version from the registry of the image or the GitHub project it is built from: the
 * project its registry implies, or the one its labels name (sourceProject) when the image is
 * public, which its registry or shields.io knowing it shows. shields.io and the implied project
 * of an image not known to be public are only asked about when possiblyPrivate allows it.
 */
function registryOrProjectLatest(
  reference: ImageReference,
  tag: string,
  sourceProject: string | undefined,
  possiblyPrivate: AbortSignal | undefined
) {
  return cached<LatestVersion>(
    `latest|${reference.registry}/${reference.repository}:${tag}|${sourceProject ?? ''}|${
      possiblyPrivate ? 'any' : 'public'
    }`,
    async () => {
      let isPublic = isPublicByName(reference);
      if (reference.registry === 'quay.io') {
        const tags = await quayTags(reference.repository);
        isPublic = tags !== null;
        const newest = newestListedTag(tag, tags);
        if (newest) {
          return {
            latest: newest,
            source: { name: 'Quay', url: registryPage(`quay.io/${reference.repository}`)?.url },
          };
        }
      }
      const googleImage = artifactRegistryPackage(reference);
      if (googleImage) {
        // none for a private repository
        const tags = await artifactRegistryTags(googleImage);
        isPublic = tags !== null;
        const newest = newestListedTag(tag, tags);
        if (newest) {
          return {
            latest: newest,
            source: {
              name: 'Artifact Registry',
              url: registryPage(`${reference.registry}/${reference.repository}`)?.url,
            },
          };
        }
      }
      const dockerHub = canonical(reference);
      const dockerHubPage = registryPage(`docker.io/${dockerHub.repository}`);
      const official =
        dockerHub.registry === 'docker.io' && dockerHub.repository.match(/^library\/([^/]+)$/);
      if (official) {
        // an image without a publisher may also be one built locally, so only the names of
        // Docker's official images are asked about
        const names = await officialImageNames();
        const tags = names?.includes(official[1]) ? await officialImageTags(official[1]) : null;
        isPublic = tags !== null;
        const newest = newestListedTag(tag, tags);
        if (newest)
          return { latest: newest, source: { name: 'Docker Hub', url: dockerHubPage?.url } };
      }
      let dockerHubNewest: string | undefined;
      // Docker Hub cannot be asked whether a repository is public, and shields.io learns the name
      if (dockerHub.registry === 'docker.io' && !official && possiblyPrivate) {
        const version = await dockerHubVersion(dockerHub.repository, possiblyPrivate);
        // shields.io only sees public repositories; it says so for others. It also answers
        // "invalid response data" for some public ones, and writes 2026.2.1 as v2026.2.1
        if (version && !/not found/i.test(version)) isPublic = true;
        dockerHubNewest =
          (version &&
            newestOfVersion(tag, /^v/i.test(tag) ? version : version.replace(/^v/, ''))) ||
          undefined;
      }
      // the releases of the project go before shields.io, which sorts the tags loosely
      const project =
        (await impliedProject(reference, isPublic || !!possiblyPrivate)) ??
        (isPublic ? sourceProject : undefined);
      if (project) {
        // the project of an image not known to be public is only named with the permit
        const versions = await githubVersions(project, isPublic ? undefined : possiblyPrivate);
        const newest = versions && newestRelease(tag, versions);
        if (newest) {
          return {
            latest: newest,
            source: { name: 'GitHub', url: `https://github.com/${project}/releases` },
          };
        }
      }
      if (dockerHubNewest) {
        return { latest: dockerHubNewest, source: { name: 'Docker Hub', url: dockerHubPage?.url } };
      }
      return null;
    },
    { persist: true }
  );
}

async function endOfLifeOf(
  reference: ImageReference,
  tag: string,
  project?: string
): Promise<{ line?: ReleaseLine; newest?: LatestVersion }> {
  const match = await endOfLifeProduct(reference, project);
  const releases = match ? await endOfLifeReleases(match.product) : null;
  if (!match || !releases?.length) return {};
  const { product } = match;
  const url = `https://endoflife.date/${product}`;
  const line = releaseLineOf(tag, releases);
  // a product with the name of the image may be another one, unless the tag is one of its lines
  if (!line && match.byName) return {};
  const newest = newestRelease(
    tag,
    releases.map(release => release.latest ?? release.name)
  );
  return {
    line: line && {
      product,
      name: line.name,
      latest: line.latest,
      eol: line.isEol,
      eolFrom: line.eolFrom,
      url,
    },
    newest: newest ? { latest: newest, source: { name: 'endoflife.date', url } } : undefined,
  };
}

/**
 * The newest version of a public image and the release line of its tag. Images whose tag is not
 * a version, such as latest, are not looked up.
 */
export async function lookupImageVersion(
  image: string,
  options: {
    // false when version-checker already knows the newest version
    latest?: boolean;
    // the source repository the labels of the image name (imageSourceLabel)
    source?: string;
    // the permit to send the names of images that may be private to shields.io and jsDelivr
    // (possiblyPrivatePermit), when the settings allow it
    possiblyPrivate?: AbortSignal;
  } = {}
): Promise<PublicVersion> {
  const reference = parseImageReference(image);
  const tag = imageTag(image);
  if (!reference || !tag || !parseVersion(tag)) return {};
  const sourceProject = githubProjectOfSource(options.source);
  // a service that fails leaves out what it would tell
  const [latest, endOfLife] = await Promise.all([
    options.latest === false
      ? null
      : registryOrProjectLatest(reference, tag, sourceProject, options.possiblyPrivate).catch(
          () => null
        ),
    endOfLifeOf(reference, tag, githubProject(reference) ?? sourceProject).catch(
      () => ({} as Awaited<ReturnType<typeof endOfLifeOf>>)
    ),
  ]);
  return { latest: latest ?? endOfLife.newest, line: endOfLife.line };
}

/** The key of an image for version-checker's results: registry/repository:tag. */
export function imageVersionKey(image: string): string | undefined {
  const reference = parseImageReference(image);
  const tag = imageTag(image);
  return reference && tag ? `${reference.registry}/${reference.repository}:${tag}` : undefined;
}

function unescapeLabel(value: string) {
  return value.replace(/\\(["\\n])/g, (_, char) => (char === 'n' ? '\n' : char));
}

/** version-checker's results, by imageVersionKey, from its Prometheus metrics. */
export function parseVersionCheckerMetrics(text: string): Map<string, VersionCheckerResult> {
  const results = new Map<string, VersionCheckerResult>();
  for (const line of text.split('\n')) {
    const match = line.match(/^version_checker_is_latest_version\{(.*)\}\s+(\S+)/);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const [, name, value] of match[1].matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)) {
      labels[name] = unescapeLabel(value);
    }
    const key =
      labels.image && labels.current_version
        ? imageVersionKey(`${labels.image}:${labels.current_version}`)
        : undefined;
    if (key && labels.latest_version) {
      results.set(key, { latest: labels.latest_version, isLatest: Number(match[2]) === 1 });
    }
  }
  return results;
}

/**
 * The results of version-checker in a cluster, read from its metrics through the API server's
 * service proxy; empty when it does not run there. Kept for five minutes.
 */
export function versionCheckerResults(
  cluster: string,
  now: number = Date.now()
): Promise<Map<string, VersionCheckerResult>> {
  const entry = versionCheckers.get(cluster);
  if (entry && now < entry.expires) return entry.value;
  const value = (async () => {
    const services = await request(
      `/api/v1/services?labelSelector=${encodeURIComponent(
        'app.kubernetes.io/name=version-checker'
      )}`,
      { cluster, autoLogoutOnAuthError: false }
    );
    const service = services?.items?.[0];
    const ports: Array<{ name?: string; port: number }> = service?.spec?.ports ?? [];
    const port = ports.find(p => p.name === 'web') ?? ports[0];
    if (!service || !port) return new Map<string, VersionCheckerResult>();
    const response = await request(
      `/api/v1/namespaces/${service.metadata.namespace}/services/${service.metadata.name}:${port.port}/proxy/metrics`,
      { cluster, isJSON: false, autoLogoutOnAuthError: false }
    );
    return parseVersionCheckerMetrics(await response.text());
  })().catch(() => new Map<string, VersionCheckerResult>());
  versionCheckers.set(cluster, { expires: now + 5 * 60 * 1000, value });
  return value;
}
