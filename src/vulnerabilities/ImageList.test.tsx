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
