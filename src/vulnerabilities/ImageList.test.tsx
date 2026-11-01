import { theme } from '@kinvolk/headlamp-plugin/lib/components/TestHelpers/theme';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { vi } from 'vitest';
import ImageList from './ImageList';
import { toImageScan, WorkloadScan } from './scanData';
import { manifest, T1, T2 } from './testFixtures';

const request = vi.hoisted(() => vi.fn());
const versions = vi.hoisted(() => ({ config: {} as Record<string, unknown>, lookup: vi.fn() }));
vi.mock('../common/config-store', () => ({
  kubescapeConfigStore: { useConfig: () => () => versions.config },
}));
vi.mock('./imageVersionSources', async importOriginal => ({
  ...(await importOriginal<typeof import('./imageVersionSources')>()),
  lookupImageVersion: versions.lookup,
  versionCheckerResults: async () => new Map(),
}));
vi.mock('../index', () => ({
  RoutingName: { ImageVulnerabilityDetails: 'image', KubescapeSBOMDetails: 'sbom' },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));
vi.mock('@kinvolk/headlamp-plugin/lib/components/App/Settings/hook', () => ({
  useSettings: () => [20, 50, 100],
}));
vi.mock('@kinvolk/headlamp-plugin/lib/lib/useShortcut', () => ({ useShortcut: () => {} }));
vi.mock('@kinvolk/headlamp-plugin/lib/lib/util', () => ({
  useURLState: (_key: string, options: { defaultValue: unknown }) => useState(options.defaultValue),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/components/resourceMap/useQueryParamsState', () => ({
  useQueryParamsState: (_key: string, initial: unknown) => useState(initial),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (value: string) => value, i18n: { language: 'en' } }),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', async () => {
  const { default: Table } = await vi.importActual<
    typeof import('@kinvolk/headlamp-plugin/lib/components/common/Table/Table')
  >('@kinvolk/headlamp-plugin/lib/components/common/Table/Table');
  return {
    Table,
    DateLabel: ({ date }: { date: string }) => <time dateTime={date}>{date}</time>,
    SectionBox: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    Link: ({ children, activeCluster, params }: any) => (
      <a href={`/${activeCluster}/${params.namespace}/${params.name}`}>{children}</a>
    ),
  };
});
const tableTheme = createTheme(theme, { palette: { tables: { head: { borderColor: '#ddd' } } } });
afterEach(cleanup);
beforeEach(() => {
  versions.config = {};
  versions.lookup.mockReset();
  versions.lookup.mockResolvedValue({});
});

function workload(name: string, createdAt?: string): WorkloadScan {
  const image = manifest();
  image.metadata.name = name;
  image.metadata.annotations['kubescape.io/image-tag'] = name;
  image.spec.metadata = createdAt ? { report: { createdAt } } : undefined;
  return { imageScan: toImageScan(image), name, container: 'app' } as WorkloadScan;
}

function imageOrder() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('link')[0].textContent);
}

it('passes date sorting through Headlamp and keeps Unknown last in both directions without fetching', async () => {
  render(
    <ThemeProvider theme={tableTheme}>
      <ImageList
        workloadScans={[workload('unknown'), workload('later', T2), workload('earlier', T1)]}
      />
    </ThemeProvider>
  );
  expect(screen.getByRole('columnheader', { name: /Scan record created/ })).toBeTruthy();
  expect(
    screen.getByRole('columnheader', { name: /Vulnerabilities/ }).getAttribute('aria-sort')
  ).toBe('descending');
  const header = screen.getByRole('columnheader', { name: /Last evaluated/ });
  fireEvent.click(within(header).getByRole('button', { name: /Last evaluated/ }));
  await waitFor(() => expect(header.getAttribute('aria-sort')).toBe('ascending'));
  expect(imageOrder()).toEqual(['earlier', 'later', 'unknown']);
  fireEvent.click(within(header).getByRole('button', { name: /Last evaluated/ }));
  await waitFor(() => expect(header.getAttribute('aria-sort')).toBe('descending'));
  expect(imageOrder()).toEqual(['later', 'earlier', 'unknown']);
  expect(screen.getByText('Unknown')).toBeTruthy();
  expect(screen.getByText(T1).getAttribute('datetime')).toBe(T1);
  expect(request).not.toHaveBeenCalled();
});

function renderImages(workloadScans: WorkloadScan[]) {
  return render(
    <ThemeProvider theme={tableTheme}>
      <ImageList workloadScans={workloadScans} />
    </ThemeProvider>
  );
}

function cellOf(image: string, column: string) {
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
  const row = screen.getByText(image, { selector: 'a' }).closest('tr')!;
  return within(row).getAllByRole('cell')[headers.findIndex(h => h?.startsWith(column))];
}

it('shows the tag, the newest version and the end of life of each image', async () => {
  versions.lookup.mockImplementation(async (image: string) => {
    if (image === 'quay.io/team/app:v1.0.0') {
      return {
        latest: {
          latest: 'v1.2.0',
          source: { name: 'Quay', url: 'https://quay.io/repository/team/app?tab=tags' },
        },
      };
    }
    if (image === 'redis:5.0.7') {
      return {
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
      };
    }
    if (image === 'quay.io/team/current:v2.0.0') {
      return { latest: { latest: 'v2.0.0', source: { name: 'Quay' } } };
    }
    return {};
  });
  renderImages([
    workload('quay.io/team/app:v1.0.0'),
    workload('redis:5.0.7'),
    workload('quay.io/team/current:v2.0.0'),
    workload('registry.example/private:main'),
  ]);

  await waitFor(() =>
    expect(cellOf('redis:5.0.7', 'End of life').textContent).toBe('Ended 2022-04-27')
  );
  expect(cellOf('quay.io/team/app:v1.0.0', 'Tag').textContent).toBe('v1.0.0');
  expect(cellOf('quay.io/team/app:v1.0.0', 'Latest').textContent).toBe('v1.2.0');
  expect(
    within(cellOf('quay.io/team/app:v1.0.0', 'Latest')).getByLabelText('Newer version available')
  ).toBeTruthy();
  expect(
    within(cellOf('quay.io/team/current:v2.0.0', 'Latest')).getByLabelText('Up to date')
  ).toBeTruthy();
  expect(within(cellOf('redis:5.0.7', 'End of life')).getByLabelText('End of life')).toBeTruthy();
  expect(cellOf('registry.example/private:main', 'Tag').textContent).toBe('main');
  expect(cellOf('registry.example/private:main', 'Latest').textContent).toBe('');
  expect(versions.lookup).toHaveBeenCalledTimes(4);

  // images with a newer version first
  const header = screen.getByRole('columnheader', { name: /Latest/ });
  fireEvent.click(within(header).getByRole('button', { name: /Latest/ }));
  await waitFor(() => expect(header.getAttribute('aria-sort')).toBe('descending'));
  expect(imageOrder().slice(0, 2).sort()).toEqual(['quay.io/team/app:v1.0.0', 'redis:5.0.7']);
  expect(imageOrder()[2]).toBe('quay.io/team/current:v2.0.0');
});

it('leaves out the end of life, or all version columns, as the settings say', async () => {
  versions.config = { endOfLife: false };
  const view = renderImages([workload('redis:5.0.7')]);
  expect(screen.getByRole('columnheader', { name: /Latest/ })).toBeTruthy();
  expect(screen.queryByRole('columnheader', { name: /End of life/ })).toBeNull();
  await waitFor(() => expect(versions.lookup).toHaveBeenCalled());
  view.unmount();

  versions.lookup.mockClear();
  versions.config = { imageVersions: false, endOfLife: true };
  renderImages([workload('redis:5.0.7')]);
  expect(screen.queryByRole('columnheader', { name: /Tag/ })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: /Latest/ })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: /End of life/ })).toBeNull();
  expect(versions.lookup).not.toHaveBeenCalled();
});
