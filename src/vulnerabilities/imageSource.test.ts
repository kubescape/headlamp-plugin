import { githubProjectOfSource, imageSourceLabel } from './imageSource';

// an image config as Grype records it in a report: base64 encoded JSON
function config(labels?: Record<string, string>) {
  const json = JSON.stringify({ architecture: 'amd64', config: { Labels: labels } });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

describe('imageSourceLabel', () => {
  it('reads the source repository from the labels of the image config', () => {
    expect(
      imageSourceLabel(
        config({
          'org.opencontainers.image.source': ' https://github.com/example-org/app ',
          'org.opencontainers.image.version': 'v1.21.1',
        })
      )
    ).toBe('https://github.com/example-org/app');
    expect(
      imageSourceLabel(config({ 'org.label-schema.vcs-url': 'https://github.com/team/tool.git' }))
    ).toBe('https://github.com/team/tool.git');
  });

  it('has none for images without the label or without a config', () => {
    expect(imageSourceLabel(config({ maintainer: 'someone' }))).toBeUndefined();
    expect(imageSourceLabel(config())).toBeUndefined();
    expect(imageSourceLabel(undefined)).toBeUndefined();
    expect(imageSourceLabel('not base64 JSON')).toBeUndefined();
  });
});

describe('githubProjectOfSource', () => {
  it('takes owner and name from the ways repositories are written', () => {
    expect(githubProjectOfSource('https://github.com/example-org/operator/')).toBe(
      'example-org/operator'
    );
    expect(githubProjectOfSource('https://github.com/team/tool.git')).toBe('team/tool');
    expect(githubProjectOfSource('git@github.com:team/tool.git')).toBe('team/tool');
    expect(
      githubProjectOfSource('https://github.com/example-org/proxy/archive/v1.33.6.tar.gz')
    ).toBe('example-org/proxy');
  });

  it('has none for other hosts', () => {
    expect(githubProjectOfSource('https://gitlab.com/team/tool')).toBeUndefined();
    expect(githubProjectOfSource('https://example.com/github.com/team/tool')).toBeUndefined();
    expect(githubProjectOfSource(undefined)).toBeUndefined();
  });
});
