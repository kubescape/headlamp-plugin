import { describe, expect, it } from 'vitest';
import { parseImageReference, registryPage } from './registry';

describe('parseImageReference', () => {
  it.each([
    ['nginx', 'docker.io', 'library/nginx'],
    ['nginx:1.27', 'docker.io', 'library/nginx'],
    ['docker.io/library/nginx:1.27@sha256:abc', 'docker.io', 'library/nginx'],
    ['docker.io/example/server:2026.1.3-linux', 'docker.io', 'example/server'],
    ['index.docker.io/bitnami/redis', 'docker.io', 'bitnami/redis'],
    ['bitnami/redis:7', 'docker.io', 'bitnami/redis'],
    ['quay.io/kubescape/kubevuln:v0.3.98', 'quay.io', 'kubescape/kubevuln'],
    ['localhost/app:dev', 'localhost', 'app'],
    ['registry.local:5000/team/app:v1', 'registry.local:5000', 'team/app'],
  ])('reads %s', (image, registry, repository) => {
    expect(parseImageReference(image)).toEqual({ registry, repository });
  });

  it('reads nothing from an empty reference', () => {
    expect(parseImageReference('')).toBeUndefined();
  });
});

describe('registryPage', () => {
  it.each([
    ['nginx:1.27', 'Docker Hub', 'https://hub.docker.com/_/nginx/tags'],
    [
      'docker.io/example/server:2026.1.3-linux',
      'Docker Hub',
      'https://hub.docker.com/r/example/server/tags',
    ],
    [
      'quay.io/prometheus/node-exporter:v1.8.2',
      'Quay',
      'https://quay.io/repository/prometheus/node-exporter?tab=tags',
    ],
    [
      'ghcr.io/fluxcd/source-controller:v1.4.1',
      'GitHub',
      'https://ghcr.io/fluxcd/source-controller',
    ],
    [
      'gcr.io/google-containers/pause:3.2',
      'Google Cloud',
      'https://gcr.io/google-containers/pause',
    ],
    [
      'us-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0',
      'Google Cloud',
      'https://us-docker.pkg.dev/google-samples/containers/gke/hello-app',
    ],
    [
      'mcr.microsoft.com/dotnet/runtime:8.0',
      'Microsoft Artifact Registry',
      'https://mcr.microsoft.com/en-us/artifact/mar/dotnet/runtime/tags',
    ],
    [
      'public.ecr.aws/nginx/nginx:stable',
      'Amazon ECR Public Gallery',
      'https://gallery.ecr.aws/nginx/nginx',
    ],
  ])('links %s to %s', (image, name, url) => {
    expect(registryPage(image)).toEqual({ name, url });
  });

  it('has no page for registries without one', () => {
    expect(registryPage('registry.k8s.io/pause:3.9')).toBeUndefined();
    expect(registryPage('registry.local:5000/team/app:v1')).toBeUndefined();
  });
});
