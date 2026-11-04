import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  changeImageVersionSetting,
  EndOfLifeLabel,
  ImageVersion,
  imageVersionRows,
  useImageVersion,
  useImageVersionSettings,
} from './ImageVersion';
import { possiblyPrivatePermit } from './imageVersionSources';

const mocks = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
  lookup: vi.fn(),
  checked: new Map<string, { latest: string; isLatest: boolean }>(),
}));
vi.mock('../common/config-store', () => ({
  kubescapeConfigStore: { useConfig: () => () => mocks.config },
}));
vi.mock('./imageVersionSources', async importOriginal => ({
  ...(await importOriginal<typeof import('./imageVersionSources')>()),
  lookupImageVersion: mocks.lookup,
  versionCheckerResults: async () => mocks.checked,
}));

const line = {
  product: 'nginx',
  name: '1.29',
  latest: '1.29.8',
  eol: false,
  eolFrom: '2026-12-01',
  url: 'https://endoflife.date/nginx',
};

// both are off until they are switched on
const switchedOn = { imageVersions: true, endOfLife: true };

beforeEach(() => {
  mocks.config = switchedOn;
  mocks.checked = new Map();
  mocks.lookup.mockReset();
  mocks.lookup.mockResolvedValue({
    latest: { latest: '1.31.8', source: { name: 'endoflife.date', url: line.url } },
    line,
  });
});
afterEach(cleanup);

function Details({ image }: { image: string }) {
  const version = useImageVersion(image, 'cluster-a');
  const rows = imageVersionRows(version, useImageVersionSettings());
  return (
    <dl>
      {rows.map(row => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

it('takes the newest version from version-checker when it runs in the cluster', async () => {
  mocks.checked = new Map([
    ['docker.io/library/nginx:1.29.3', { latest: '1.31.9', isLatest: false }],
  ]);
  render(<Details image="nginx:1.29.3" />);
  await waitFor(() => expect(screen.getByText('1.31.9')).toBeTruthy());
  expect(screen.getByText(/version-checker has 1.31.9, which is newer than 1.29.3/)).toBeTruthy();
  // only the end of life is looked up elsewhere
  expect(mocks.lookup).toHaveBeenCalledWith('nginx:1.29.3', {
    latest: false,
    endOfLife: true,
    possiblyPrivate: undefined,
  });
  expect(screen.getByText('End of life')).toBeTruthy();
});

it('looks up images that may be private only when the settings allow it', async () => {
  const view = render(<Details image="team/app:1.2.0" />);
  await waitFor(() => expect(screen.getByText('Latest version')).toBeTruthy());
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
  expect(mocks.lookup).toHaveBeenLastCalledWith('team/app:1.2.0', {
    latest: true,
    endOfLife: true,
    possiblyPrivate: undefined,
  });

  // switching the setting on looks the image up again
  mocks.config = { ...switchedOn, possiblyPrivateImages: true };
  view.rerender(<Details image="team/app:1.2.0" />);
  await waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(2));
  expect(mocks.lookup).toHaveBeenLastCalledWith('team/app:1.2.0', {
    latest: true,
    endOfLife: true,
    possiblyPrivate: expect.any(AbortSignal),
  });

  // and it counts for nothing while the newest versions are switched off
  mocks.config = { imageVersions: false, possiblyPrivateImages: true };
  view.rerender(<Details image="team/app:1.2.0" />);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(mocks.lookup).toHaveBeenCalledTimes(2);
});

it('stops the lookups of images that may be private once the settings no longer allow them', () => {
  const permit = possiblyPrivatePermit();
  expect(changeImageVersionSetting({ pageSize: 50 }, 'possiblyPrivateImages', true)).toEqual({
    pageSize: 50,
    possiblyPrivateImages: true,
  });
  expect(permit.aborted).toBe(false);

  expect(
    changeImageVersionSetting({ possiblyPrivateImages: true }, 'possiblyPrivateImages', false)
  ).toEqual({ possiblyPrivateImages: false });
  expect(permit.aborted).toBe(true);

  // as does switching off the newest versions altogether, with a new permit
  const next = possiblyPrivatePermit();
  expect(next.aborted).toBe(false);
  changeImageVersionSetting({ possiblyPrivateImages: true }, 'imageVersions', false);
  expect(next.aborted).toBe(true);
});

it('neither shows nor asks endoflife.date when the end of life is not switched on', async () => {
  mocks.config = { imageVersions: true };
  render(<Details image="nginx:1.29.3" />);
  await waitFor(() => expect(screen.getByText('Latest version')).toBeTruthy());
  expect(screen.queryByText('End of life')).toBeNull();
  expect(mocks.lookup).toHaveBeenCalledWith('nginx:1.29.3', {
    latest: true,
    endOfLife: false,
    possiblyPrivate: undefined,
  });
});

it('looks nothing up until the newest versions are switched on', async () => {
  for (const config of [{}, { imageVersions: false, endOfLife: true }]) {
    mocks.config = config;
    const view = render(<Details image="nginx:1.29.3" />);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(screen.queryByText('Latest version')).toBeNull();
    view.unmount();
  }
});

it('marks a release line that ends within 90 days', () => {
  const view = render(<EndOfLifeLabel line={line} now={new Date('2026-10-31')} />);
  expect(screen.getByRole('img', { name: 'End of life soon' })).toBeTruthy();
  expect(screen.getByRole('link').textContent).toBe('2026-12-01');
  view.unmount();

  render(<EndOfLifeLabel line={line} now={new Date('2026-06-01')} detailed />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('nginx 1.29 is supported until 2026-12-01.')).toBeTruthy();
});

it('says when a release line has no announced end', () => {
  render(<EndOfLifeLabel line={{ ...line, eolFrom: undefined }} detailed />);
  expect(screen.getByRole('link').textContent).toBe('No date announced');
  expect(screen.getByText('nginx 1.29 has no announced end of life.')).toBeTruthy();
});

it('shows a tag that is up to date', () => {
  const version: ImageVersion = {
    tag: '8',
    latest: { latest: '8.39.0', source: { name: 'GitHub' } },
    newer: false,
  };
  const rows = imageVersionRows(version, { endOfLife: true });
  render(<>{rows[0].value}</>);
  expect(screen.getByRole('img', { name: 'Up to date' })).toBeTruthy();
  expect(screen.getByText('8 is up to date: the newest version at GitHub is 8.39.0.')).toBeTruthy();
  expect(rows).toHaveLength(1);
});
