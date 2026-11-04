import { vi } from 'vitest';
import {
  artifactRegistryPackage,
  clearVersionCache,
  endOfLifeProduct,
  githubProject,
  lookupImageVersion,
  parseVersionCheckerMetrics,
  possiblyPrivatePermit,
  purlKey,
  stopPossiblyPrivateLookups,
  versionCheckerResults,
} from './imageVersionSources';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));

// the answers of the public services by URL; a function answers a request itself
type Answer = unknown | ((url: string) => Promise<Response> | Response);
let answers: Record<string, Answer> = {};
const fetchMock = vi.fn(async (url: string) => {
  const answer = answers[url];
  if (typeof answer === 'function') return answer(url);
  if (answer === undefined) return new Response('{"status":404}', { status: 404 });
  return new Response(JSON.stringify(answer), { status: 200 });
});

const quay = (repository: string, page = 1) =>
  `https://quay.io/api/v1/repository/${repository}/tag/?onlyActiveTags=true&limit=100&page=${page}`;
const jsdelivr = (project: string) => `https://data.jsdelivr.com/v1/packages/gh/${project}`;
const githubRepository = (project: string) => `https://api.github.com/repos/${project}`;
const endOfLife = (product: string) => `https://endoflife.date/api/v1/products/${product}/`;
const identifiers = 'https://endoflife.date/api/v1/identifiers/purl/';
const products = 'https://endoflife.date/api/v1/products/';
const officialImage = (name: string) =>
  `https://cdn.jsdelivr.net/gh/docker-library/official-images@master/library/${name}`;
const officialNames =
  'https://data.jsdelivr.com/v1/packages/gh/docker-library/official-images@master?structure=flat';
// the files of Docker's official images, as jsDelivr lists them
const officialFiles = (...names: string[]) => ({
  files: [
    { name: '/.bin/docker-buildx-ensure.sh' },
    ...names.map(name => ({ name: `/library/${name}` })),
  ],
});
const shields = (repository: string) =>
  `https://img.shields.io/docker/v/${repository}.json?sort=semver`;
const text = (body: string) => () => new Response(body, { status: 200 });
const artifactRegistry = (path: string) =>
  `https://artifactregistry.googleapis.com/v1/projects/${path}`;
const arTags = (...names: string[]) => ({
  tags: names.map(name => ({
    name: `projects/p/locations/us/repositories/r/packages/x/tags/${name}`,
  })),
});

const redisReleases = {
  result: {
    releases: [
      { name: '8.10', isEol: false, eolFrom: null, latest: { name: '8.10.3' } },
      { name: '7.0', isEol: true, eolFrom: '2024-07-29', latest: { name: '7.0.15' } },
      { name: '5.0', isEol: true, eolFrom: '2022-04-27', latest: { name: '5.0.14' } },
    ],
  },
};

beforeEach(() => {
  clearVersionCache();
  window.localStorage.clear();
  answers = {
    [identifiers]: { result: [] },
    [products]: { result: [] },
    [officialNames]: officialFiles('nginx', 'redis', 'varnish'),
  };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  mocks.request.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const requested = () => fetchMock.mock.calls.map(([url]) => url);
const requestedAt = (host: string) => requested().filter(url => url.startsWith(host));

describe('lookupImageVersion', () => {
  it('reads the tags of a quay.io image page by page', async () => {
    answers[quay('prometheus/prometheus')] = {
      tags: [{ name: 'main' }, { name: 'v3.15.1-distroless' }, { name: 'v3.15.1' }],
      has_additional: true,
    };
    answers[quay('prometheus/prometheus', 2)] = {
      tags: [{ name: 'v3.13.2-distroless' }],
      has_additional: false,
    };
    const found = await lookupImageVersion('quay.io/prometheus/prometheus:v3.13.2-distroless');
    expect(found.latest).toEqual({
      latest: 'v3.15.1-distroless',
      source: { name: 'Quay', url: 'https://quay.io/repository/prometheus/prometheus?tab=tags' },
    });
    expect(requestedAt('https://quay.io')).toEqual([
      quay('prometheus/prometheus'),
      quay('prometheus/prometheus', 2),
    ]);
  });

  it('says nothing about a tag that Quay no longer has', async () => {
    answers[quay('team/app')] = { tags: [{ name: 'v2.0.0-rc.1' }], has_additional: false };
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest).toBeUndefined();
  });

  it('reads the versions of the GitHub project of a ghcr.io image from jsDelivr with the opt-in', async () => {
    answers[jsdelivr('external-secrets/external-secrets')] = {
      versions: [{ version: '2.14.0' }, { version: 'helm-chart-2.14.0' }, { version: '2.8.0' }],
    };
    const found = await lookupImageVersion('ghcr.io/external-secrets/external-secrets:v2.8.0', {
      possiblyPrivate: possiblyPrivatePermit(),
    });
    expect(found.latest).toEqual({
      latest: '2.14.0',
      source: {
        name: 'GitHub',
        url: 'https://github.com/external-secrets/external-secrets/releases',
      },
    });
    expect(requested().filter(url => !url.startsWith('https://endoflife.date'))).toEqual([
      jsdelivr('external-secrets/external-secrets'),
    ]);
  });

  it('never sends the name of a ghcr.io image without the opt-in, even with a public repository of that name', async () => {
    // GitHub sets the visibility of a package apart from its repository: acme/app is a public
    // repository, while the package ghcr.io/acme/app is private
    answers[githubRepository('acme/app')] = { private: false };
    answers[jsdelivr('acme/app')] = { versions: [{ version: '1.3.0' }] };
    expect(await lookupImageVersion('ghcr.io/acme/app:v1.2.3')).toEqual({});
    // neither GitHub nor jsDelivr is asked; only the whole product lists of endoflife.date are read
    expect(requested()).toEqual([identifiers, products]);

    // unless the settings allow names of images that may be private
    const allowed = await lookupImageVersion('ghcr.io/acme/app:v1.2.3', {
      possiblyPrivate: possiblyPrivatePermit(),
    });
    expect(allowed.latest?.latest).toBe('1.3.0');
    expect(requested()).toContain(jsdelivr('acme/app'));
    expect(requestedAt('https://api.github.com')).toEqual([]);
  });

  it('reads the tags of an official Docker Hub image from the files Docker builds it from', async () => {
    answers[officialImage('nginx')] = text(
      [
        '# this file is generated via https://github.com/nginx/docker-nginx',
        'Tags: 1.31.8, mainline, 1, 1.31, latest',
        'Tags: 1.31.8-alpine, mainline-alpine, alpine, 1.31.8-alpine3.24, 1.31-alpine3.24',
        'SharedTags: 1.30.6-alpine3.24, stable-alpine3.24',
      ].join('\n')
    );
    const found = await lookupImageVersion('nginx:1.29.3-alpine3.24');
    expect(found.latest).toEqual({
      latest: '1.31.8-alpine3.24',
      source: { name: 'Docker Hub', url: 'https://hub.docker.com/_/nginx/tags' },
    });
    expect(requested()).not.toContain(shields('library/nginx'));
    // Amazon's mirror of the official images has the same tags
    expect(
      (await lookupImageVersion('public.ecr.aws/docker/library/nginx:1.31.3')).latest?.latest
    ).toBe('1.31.8');
    // the official images are listed once a day
    expect(requested().filter(url => url === officialNames)).toHaveLength(1);
  });

  it('reads the tags of gcr.io images from the API of Artifact Registry, page by page', async () => {
    const repository = 'example-project/locations/us/repositories/gcr.io';
    answers[artifactRegistry(repository)] = { name: 'repository', format: 'DOCKER' };
    answers[artifactRegistry(`${repository}/packages/tool/tags?pageSize=1000`)] = {
      ...arTags('4.0.0', '4.2.0'),
      nextPageToken: 'next',
    };
    answers[artifactRegistry(`${repository}/packages/tool/tags?pageSize=1000&pageToken=next`)] =
      arTags('4.6.0', 'latest');
    const found = await lookupImageVersion('gcr.io/example-project/tool:4.0.0');
    expect(found.latest).toEqual({
      latest: '4.6.0',
      source: {
        name: 'Artifact Registry',
        url: 'https://gcr.io/example-project/tool',
      },
    });
  });

  it('asks about a private repository of Artifact Registry once, not for each image', async () => {
    const repository = 'example-project/locations/us-central1/repositories/private';
    answers[artifactRegistry(repository)] = () =>
      new Response('{"error":{"code":403}}', { status: 403 });
    for (const image of ['app:1.0.0', 'api:2.3.1', 'worker:main-build-73']) {
      expect(
        await lookupImageVersion(`us-central1-docker.pkg.dev/example-project/private/${image}`)
      ).toEqual({});
    }
    expect(requestedAt('https://artifactregistry.googleapis.com')).toEqual([
      artifactRegistry(repository),
    ]);
  });

  it('reads the newest version of other Docker Hub images from shields.io when allowed', async () => {
    answers[shields('example/server')] = { label: 'version', value: 'v2026.2.1' };
    answers[shields('team/app')] = { label: 'version', value: 'v1.4.0' };
    answers[shields('team/tool')] = { label: 'version', value: 'invalid response data' };
    const possiblyPrivate = { possiblyPrivate: possiblyPrivatePermit() };
    expect(
      (await lookupImageVersion('example/server:2026.1.3-linux', possiblyPrivate)).latest
    ).toEqual({
      latest: '2026.2.1',
      source: {
        name: 'Docker Hub',
        url: 'https://hub.docker.com/r/example/server/tags',
      },
    });
    expect((await lookupImageVersion('team/app:v1.2.0', possiblyPrivate)).latest?.latest).toBe(
      'v1.4.0'
    );
    expect((await lookupImageVersion('team/tool:1.0.0', possiblyPrivate)).latest).toBeUndefined();
  });

  it('only asks about the Upbound packages of Upbound and the Crossplane community', async () => {
    answers[jsdelivr('crossplane-contrib/provider-upjet-gcp')] = {
      versions: [{ version: 'v2.1.0' }],
    };
    const provider = await lookupImageVersion(
      'xpkg.upbound.io/upbound/provider-gcp-secretmanager:v2.0.0'
    );
    expect(provider.latest?.latest).toBe('v2.1.0');
    answers[jsdelivr('crossplane-contrib/provider-kubernetes')] = {
      versions: [{ version: 'v1.2.0' }],
    };
    const contrib = await lookupImageVersion(
      'xpkg.upbound.io/crossplane-contrib/provider-kubernetes:v1.1.0'
    );
    expect(contrib.latest?.latest).toBe('v1.2.0');

    // others may be in private repositories of the Upbound marketplace
    await lookupImageVersion('xpkg.upbound.io/acme/configuration-platform:v1.0.0', {
      source: 'https://github.com/acme/platform',
    });
    expect(requestedAt('https://data.jsdelivr.com')).toEqual([
      jsdelivr('crossplane-contrib/provider-upjet-gcp'),
      jsdelivr('crossplane-contrib/provider-kubernetes'),
    ]);
  });

  it('never sends the name of a Docker Hub image that may be private to shields.io', async () => {
    // Docker Hub cannot be asked whether the repository is public
    answers[shields('acme/secret-app')] = { label: 'version', value: 'v1.4.0' };
    expect(await lookupImageVersion('acme/secret-app:v1.2.0')).toEqual({});
    expect(requested()).toEqual([identifiers, products]);
  });

  it('sends no more names that may be private once the setting is switched off', async () => {
    let answer!: () => void;
    const answered = new Promise<void>(resolve => (answer = resolve));
    const repositories = [1, 2, 3, 4, 5, 6, 7].map(n => `acme/private-${n}`);
    for (const repository of repositories) {
      answers[shields(repository)] = async () => {
        await answered;
        return new Response(JSON.stringify({ label: 'version', value: 'v1.4.0' }));
      };
    }
    const permit = possiblyPrivatePermit();
    const lookups = repositories.map(repository =>
      lookupImageVersion(`${repository}:v1.2.0`, { possiblyPrivate: permit })
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    // four requests at a time, so the others wait their turn
    const sent = requestedAt('https://img.shields.io');
    expect(sent).toHaveLength(4);

    stopPossiblyPrivateLookups();
    expect(permit.aborted).toBe(true);
    answer();
    const found = await Promise.all(lookups);
    expect(requestedAt('https://img.shields.io')).toEqual(sent);
    expect(found.filter(version => version.latest)).toHaveLength(4);
    // the requests after them still go out
    expect(requested()).toContain(products);

    // a stopped lookup is not kept as a failure, so it is asked again once the setting allows it
    const again = await lookupImageVersion('acme/private-7:v1.2.0', {
      possiblyPrivate: possiblyPrivatePermit(),
    });
    expect(again.latest?.latest).toBe('v1.4.0');
  });

  it('sends no name that may be private with a permit that was revoked', async () => {
    const permit = possiblyPrivatePermit();
    stopPossiblyPrivateLookups();
    answers[shields('acme/secret-app')] = { label: 'version', value: 'v1.4.0' };
    expect(await lookupImageVersion('acme/secret-app:v1.2.0', { possiblyPrivate: permit })).toEqual(
      {}
    );
    expect(requestedAt('https://img.shields.io')).toEqual([]);
  });

  it('reads the release line and the newest release of a well-known product', async () => {
    // redis is named by the image list of endoflife.date
    answers[identifiers] = {
      result: [{ identifier: 'pkg:docker/library/redis', product: { name: 'redis' } }],
    };
    answers[endOfLife('redis')] = redisReleases;
    const found = await lookupImageVersion('redis:5.0.7');
    expect(found).toEqual({
      latest: {
        latest: '8.10.3',
        source: { name: 'endoflife.date', url: 'https://endoflife.date/redis' },
      },
      line: {
        product: 'redis',
        name: '5.0',
        latest: '5.0.14',
        eol: true,
        eolFrom: '2022-04-27',
        url: 'https://endoflife.date/redis',
      },
    });
  });

  it('prefers the registry or project for the newest version and still reads the line', async () => {
    answers[jsdelivr('cloudnative-pg/postgresql')] = undefined;
    answers[products] = { result: [{ name: 'postgresql', aliases: ['postgres'] }] };
    answers[endOfLife('postgresql')] = {
      result: {
        releases: [
          { name: '18', isEol: false, eolFrom: '2030-11-14', latest: { name: '18.6' } },
          { name: '17', isEol: false, eolFrom: '2029-11-08', latest: { name: '17.11' } },
        ],
      },
    };
    // the project is not on jsDelivr, so the newest version comes from endoflife.date
    const found = await lookupImageVersion('ghcr.io/cloudnative-pg/postgresql:17.5', {
      possiblyPrivate: possiblyPrivatePermit(),
    });
    expect(found.latest?.latest).toBe('18.6');
    expect(found.line).toMatchObject({ name: '17', latest: '17.11', eolFrom: '2029-11-08' });
    expect(requested()).toContain(jsdelivr('cloudnative-pg/postgresql'));

    // as it does without the opt-in, which names no ghcr.io image
    fetchMock.mockClear();
    const withoutOptIn = await lookupImageVersion('ghcr.io/cloudnative-pg/postgresql:17.5');
    expect(withoutOptIn).toEqual(found);
    expect(requested()).not.toContain(jsdelivr('cloudnative-pg/postgresql'));
  });

  it('finds products by the image names that endoflife.date lists', async () => {
    answers[identifiers] = {
      result: [
        { identifier: 'pkg:docker/library/varnish', product: { name: 'vinyl-cache' } },
        { identifier: 'pkg:docker/argoproj/argocd', product: { name: 'argo-cd' } },
      ],
    };
    answers[endOfLife('vinyl-cache')] = {
      result: {
        releases: [{ name: '7.7', isEol: true, eolFrom: '2026-03-15', latest: { name: '7.7.3' } }],
      },
    };
    expect((await lookupImageVersion('varnish:7.7.1')).line?.product).toBe('vinyl-cache');
    expect(await endOfLifeProduct({ registry: 'quay.io', repository: 'argoproj/argocd' })).toEqual({
      product: 'argo-cd',
      byName: false,
    });
    expect(requested().filter(url => url === identifiers)).toHaveLength(1);
  });

  it('asks endoflife.date nothing when the end of life is switched off', async () => {
    answers[products] = { result: [{ name: 'redis', aliases: [] }] };
    answers[endOfLife('redis')] = redisReleases;
    answers[quay('team/redis')] = { tags: [{ name: 'v8.10.3' }], has_additional: false };
    const found = await lookupImageVersion('quay.io/team/redis:v8.2.0', { endOfLife: false });
    expect(found).toEqual({
      latest: {
        latest: 'v8.10.3',
        source: { name: 'Quay', url: 'https://quay.io/repository/team/redis?tab=tags' },
      },
      line: undefined,
    });
    expect(requestedAt('https://endoflife.date')).toEqual([]);

    // which it asks with the end of life, for the product only
    await lookupImageVersion('quay.io/team/redis:v8.2.0');
    expect(requestedAt('https://endoflife.date')).toEqual([
      identifiers,
      products,
      endOfLife('redis'),
    ]);
  });

  it('never sends the name of an image that no service knows', async () => {
    const found = await lookupImageVersion('registry.example.com/team/private/app:1.2.3');
    expect(found).toEqual({});
    // the product lists of endoflife.date are read whole and searched here
    expect(requested()).toEqual([identifiers, products]);
  });

  it('reads the releases of the GitHub project that the labels of a public image name', async () => {
    answers[shields('example/server')] = { label: 'version', value: 'v1.3.0' };
    answers[jsdelivr('example-org/server')] = {
      versions: [{ version: 'v1.4.1' }, { version: 'chart-2.0.0' }, { version: 'v1.2.0' }],
    };
    // shields.io knowing it shows that the image is public
    const found = await lookupImageVersion('example/server:v1.2.0', {
      source: 'https://github.com/example-org/server.git',
      possiblyPrivate: possiblyPrivatePermit(),
    });
    // the releases of the project go before shields.io
    expect(found.latest).toEqual({
      latest: 'v1.4.1',
      source: { name: 'GitHub', url: 'https://github.com/example-org/server/releases' },
    });
    // an image of a registry that only holds public images
    answers[jsdelivr('example-org/operator')] = { versions: [{ version: '3.2.0' }] };
    const operator = await lookupImageVersion('mcr.microsoft.com/example/operator:2.15.0', {
      source: 'https://github.com/example-org/operator/',
    });
    expect(operator.latest?.latest).toBe('3.2.0');
  });

  it('never asks about the project that the labels of a private image name', async () => {
    const source = 'https://github.com/team/secret-app';
    await lookupImageVersion('registry.example.com/team/app:1.2.0', { source });
    // a Docker Hub repository that shields.io does not know is private
    answers[shields('team/app')] = { label: 'version', value: 'repository or tag not found' };
    await lookupImageVersion('team/app:1.2.0', { source });
    await lookupImageVersion('team/app:1.2.0', {
      source,
      possiblyPrivate: possiblyPrivatePermit(),
    });
    // as is a repository of Artifact Registry that does not answer
    await lookupImageVersion('europe-docker.pkg.dev/team-project/images/app:1.2.0', { source });
    // and a ghcr.io image, whose visibility the browser cannot learn
    await lookupImageVersion('ghcr.io/team/app:1.2.0', { source });
    // and an image without a publisher that Docker does not build, such as one built locally,
    // whose name goes nowhere: only the list of official images is read
    await lookupImageVersion('app:1.2.0', { source });
    expect(requested()).toContain(officialNames);
    expect(requested().filter(url => url.includes('app') && !url.includes('team'))).toEqual([]);
    expect(requested()).not.toContain(jsdelivr('team/secret-app'));
    expect(requested()).not.toContain(jsdelivr('team/app'));
  });

  it('does not look up tags that are not versions', async () => {
    expect(await lookupImageVersion('nginx:latest')).toEqual({});
    expect(await lookupImageVersion('quay.io/team/app')).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the answers for a day, in localStorage', async () => {
    answers[quay('team/app')] = { tags: [{ name: 'v1.1.0' }, { name: 'v1.0.0' }] };
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.1.0');
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.1.0');
    expect(requestedAt('https://quay.io')).toEqual([quay('team/app')]);

    // a new window of Headlamp
    clearVersionCache();
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.1.0');
    expect(requestedAt('https://quay.io')).toEqual([quay('team/app')]);

    // a day later
    clearVersionCache();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 24 * 3600 * 1000 + 1);
    answers[quay('team/app')] = { tags: [{ name: 'v1.2.0' }, { name: 'v1.0.0' }] };
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.2.0');
  });

  it('ignores and removes the answers of an older version of the plugin', async () => {
    const old = 'kubescape-plugin.image-versions.latest|quay.io/team/app:v1.0.0';
    window.localStorage.setItem(old, JSON.stringify({ at: Date.now(), value: null }));
    answers[quay('team/app')] = { tags: [{ name: 'v1.1.0' }, { name: 'v1.0.0' }] };
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.1.0');
    expect(window.localStorage.getItem(old)).toBeNull();
  });

  it('asks a service that failed again after an hour', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    answers[quay('team/app')] = () => new Response('busy', { status: 503 });
    expect(await lookupImageVersion('quay.io/team/app:v1.0.0')).toEqual({});
    expect(await lookupImageVersion('quay.io/team/app:v1.0.0')).toEqual({});
    expect(requested().filter(url => url.startsWith('https://quay.io'))).toHaveLength(1);

    answers[quay('team/app')] = { tags: [{ name: 'v1.1.0' }, { name: 'v1.0.0' }] };
    clock.mockReturnValue(now + 3600 * 1000 + 1);
    expect((await lookupImageVersion('quay.io/team/app:v1.0.0')).latest?.latest).toBe('v1.1.0');
  });

  it('asks at most four requests at a time', async () => {
    let inFlight = 0;
    let most = 0;
    for (let i = 0; i < 8; i++) {
      answers[quay(`team/app${i}`)] = async () => {
        most = Math.max(most, ++inFlight);
        await new Promise(resolve => setTimeout(resolve, 10));
        inFlight--;
        return new Response('{"tags":[{"name":"v1.0.0"}]}');
      };
    }
    const found = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => lookupImageVersion(`quay.io/team/app${i}:v1.0.0`))
    );
    expect(found.map(version => version.latest?.latest)).toEqual(Array(8).fill('v1.0.0'));
    expect(most).toBe(4);
  });
});

describe('githubProject', () => {
  it('takes the project of a ghcr.io image from its path', () => {
    expect(
      githubProject({
        registry: 'ghcr.io',
        repository: 'open-telemetry/opentelemetry-operator/opentelemetry-operator',
      })
    ).toBe('open-telemetry/opentelemetry-operator');
  });

  it('takes the project of a Crossplane package from its path', () => {
    expect(
      githubProject({
        registry: 'xpkg.upbound.io',
        repository: 'example-org/function-example',
      })
    ).toBe('example-org/function-example');
    expect(
      githubProject({ registry: 'xpkg.upbound.io', repository: 'upbound/provider-aws-s3' })
    ).toBe('crossplane-contrib/provider-upjet-aws');
    // Docker Hub does not say; the labels of the image may
    expect(githubProject({ registry: 'docker.io', repository: 'velero/velero' })).toBeUndefined();
  });
});

describe('endOfLifeProduct', () => {
  beforeEach(() => {
    answers[identifiers] = {
      result: [{ identifier: 'pkg:github/example-org/logs', product: { name: 'example-logs' } }],
    };
    answers[products] = {
      result: [
        { name: 'tool', aliases: ['tool-server'] },
        { name: 'webapp', aliases: [] },
        { name: 'tracer', aliases: [] },
        { name: 'redis', aliases: [] },
        { name: 'postgresql', aliases: ['postgres'] },
      ],
    };
  });

  it('finds the product that lists the project of an image', async () => {
    expect(
      await endOfLifeProduct(
        { registry: 'docker.io', repository: 'example/logs' },
        'example-org/logs'
      )
    ).toEqual({ product: 'example-logs', byName: false });
  });

  it('finds a product by the name of the image or its project', async () => {
    const product = async (repository: string, project?: string) =>
      (await endOfLifeProduct({ registry: 'docker.io', repository }, project))?.product;
    expect(await product('library/postgres')).toBe('postgresql');
    expect(await product('example/tool3')).toBe('tool');
    expect(await product('example/webapp-controller', 'example-org/webapp')).toBe('webapp');
    // the start of a name counts only for images of the product's own publisher
    expect(await product('tracerproject/tracer-collector')).toBe('tracer');
    expect(await product('example/redis-exporter')).toBeUndefined();
  });

  it('leaves out a product found by name when the tag is not one of its versions', async () => {
    answers[endOfLife('redis')] = redisReleases;
    expect(await lookupImageVersion('example/redis:1.4.0')).toEqual({});
    expect((await lookupImageVersion('example/redis:7.0.12')).line?.name).toBe('7.0');
  });
});

describe('artifactRegistryPackage', () => {
  it('finds the Artifact Registry repository of an image', () => {
    expect(
      artifactRegistryPackage({
        registry: 'gcr.io',
        repository: 'google.com/cloudsdktool/google-cloud-cli',
      })
    ).toEqual({
      project: 'google.com:cloudsdktool',
      location: 'us',
      repository: 'gcr.io',
      package: 'google-cloud-cli',
    });
    expect(
      artifactRegistryPackage({ registry: 'eu.gcr.io', repository: 'project/team/app' })
    ).toEqual({
      project: 'project',
      location: 'europe',
      repository: 'eu.gcr.io',
      package: 'team/app',
    });
    expect(
      artifactRegistryPackage({
        registry: 'us-docker.pkg.dev',
        repository: 'example-project/containers/app',
      })
    ).toEqual({
      project: 'example-project',
      location: 'us',
      repository: 'containers',
      package: 'app',
    });
    expect(
      artifactRegistryPackage({
        registry: 'registry.k8s.io',
        repository: 'sig-storage/livenessprobe',
      })
    ).toMatchObject({
      project: 'k8s-artifacts-prod',
      repository: 'images',
      package: 'sig-storage/livenessprobe',
    });
  });

  it('has none for other registries', () => {
    expect(
      artifactRegistryPackage({ registry: 'gke.gcr.io', repository: 'gke-metrics-agent' })
    ).toBeUndefined();
    expect(artifactRegistryPackage({ registry: 'gcr.io', repository: 'project' })).toBeUndefined();
    expect(
      artifactRegistryPackage({ registry: 'docker.io', repository: 'library/nginx' })
    ).toBeUndefined();
  });
});

describe('purlKey', () => {
  it('reads the registry and path of the package URL of an image', () => {
    expect(purlKey('pkg:docker/library/redis')).toBe('*|library/redis');
    expect(purlKey('pkg:docker/redis@7.0')).toBe('*|library/redis');
    expect(purlKey('pkg:docker/linuxserver/wireshark?repository_url=lscr.io')).toBe(
      'lscr.io|linuxserver/wireshark'
    );
    expect(purlKey('pkg:oci/argocd?repository_url=quay.io/argoproj')).toBe(
      'quay.io|argoproj/argocd'
    );
  });

  it('reads the project of a GitHub package URL', () => {
    expect(purlKey('pkg:github/Grafana/Loki')).toBe('github|grafana/loki');
    expect(purlKey('pkg:npm/express')).toBeUndefined();
  });
});

const metrics = [
  '# HELP version_checker_is_latest_version Where the container in use is using the latest upstream registry version',
  '# TYPE version_checker_is_latest_version gauge',
  'version_checker_is_latest_version{container="web",container_type="container",current_version="1.25.0",image="nginx",latest_version="1.27.3",namespace="web",pod="web-1"} 0',
  'version_checker_is_latest_version{container="app",container_type="container",current_version="v1.2.0",image="quay.io/team/app",latest_version="v1.2.0",namespace="apps",pod="app-1"} 1',
  'version_checker_last_checked{image="nginx"} 1.7e+09',
].join('\n');

describe('version-checker', () => {
  it('reads the results of version-checker by image and tag', () => {
    expect([...parseVersionCheckerMetrics(metrics)]).toEqual([
      ['docker.io/library/nginx:1.25.0', { latest: '1.27.3', isLatest: false }],
      ['quay.io/team/app:v1.2.0', { latest: 'v1.2.0', isLatest: true }],
    ]);
  });

  it('reads its metrics through the service proxy of the cluster', async () => {
    mocks.request.mockImplementation(async (url: string) =>
      url.startsWith('/api/v1/services')
        ? {
            items: [
              {
                metadata: { name: 'version-checker', namespace: 'monitoring' },
                spec: { ports: [{ name: 'web', port: 8080 }] },
              },
            ],
          }
        : { text: async () => metrics }
    );
    const results = await versionCheckerResults('cluster-a');
    expect(results.get('docker.io/library/nginx:1.25.0')).toEqual({
      latest: '1.27.3',
      isLatest: false,
    });
    expect(mocks.request.mock.calls.map(([url, params]) => [url, params.cluster])).toEqual([
      [
        `/api/v1/services?labelSelector=${encodeURIComponent(
          'app.kubernetes.io/name=version-checker'
        )}`,
        'cluster-a',
      ],
      ['/api/v1/namespaces/monitoring/services/version-checker:8080/proxy/metrics', 'cluster-a'],
    ]);
    // kept for five minutes
    await versionCheckerResults('cluster-a');
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it('has no results where it does not run or cannot be read', async () => {
    mocks.request.mockResolvedValue({ items: [] });
    expect((await versionCheckerResults('cluster-a')).size).toBe(0);
    mocks.request.mockRejectedValue(new Error('forbidden'));
    expect((await versionCheckerResults('cluster-b')).size).toBe(0);
  });
});
