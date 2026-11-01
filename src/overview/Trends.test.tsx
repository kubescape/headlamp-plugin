import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { TrendsSection } from './Trends';

const mocks = vi.hoisted(() => ({
  fetchTrends: vi.fn(),
  detectPrometheus: vi.fn(),
  update: vi.fn(),
  prometheusUrl: '/proxy' as string | undefined,
  clusters: ['cluster-a'],
}));
vi.mock('./prometheus', async importOriginal => ({
  ...(await importOriginal<typeof import('./prometheus')>()),
  fetchTrends: mocks.fetchTrends,
  detectPrometheus: mocks.detectPrometheus,
}));
vi.mock('../common/config-store', () => ({
  getPrometheusUrl: () => mocks.prometheusUrl,
  isValidAlertmanagerAddress: () => true,
  kubescapeConfigStore: { useConfig: () => () => ({}), update: mocks.update },
}));
vi.mock('../index', () => ({ useHLSelectedClusters: () => mocks.clusters }));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
// jsdom has no layout to draw charts in; the legend and table carry the values
vi.mock('recharts', () => {
  const Nothing = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: Nothing,
    CartesianGrid: Nothing,
    Line: Nothing,
    Tooltip: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
  };
});

const rows = [
  {
    time: new Date('2026-10-28T12:00:00').getTime(),
    controlsCritical: 4,
    controlsHigh: 20,
    cvesCritical: 9,
    cvesHigh: 120,
  },
  {
    time: new Date('2026-10-29T12:00:00').getTime(),
    controlsCritical: 2,
    controlsHigh: 18,
    cvesCritical: 7,
    cvesHigh: 1500,
  },
];

beforeEach(() => {
  mocks.fetchTrends.mockReset().mockResolvedValue(rows);
  mocks.detectPrometheus.mockReset().mockResolvedValue([]);
  mocks.update.mockReset();
  mocks.prometheusUrl = '/proxy';
  mocks.clusters = ['cluster-a'];
});
afterEach(cleanup);

it('shows the latest values and a table of the days', async () => {
  render(<TrendsSection />);

  const controls = (await screen.findByText('Failed controls')).parentElement!;
  expect(within(controls).getByText('2')).toBeTruthy();
  expect(within(controls).getByText('18')).toBeTruthy();
  expect(mocks.fetchTrends).toHaveBeenCalledWith('cluster-a', 30);

  fireEvent.click(screen.getByRole('button', { name: 'Show table' }));
  const tableRows = screen.getAllByRole('row');
  expect(tableRows).toHaveLength(3);
  // newest first
  expect(within(tableRows[1]).getByText((1500).toLocaleString())).toBeTruthy();
});

it('reads the chosen time range', async () => {
  render(<TrendsSection />);
  await screen.findByText('Failed controls');

  fireEvent.click(screen.getByRole('button', { name: 'Last 90 days' }));

  expect(mocks.fetchTrends).toHaveBeenLastCalledWith('cluster-a', 90);
});

it('explains how to get metrics when Prometheus has none', async () => {
  mocks.fetchTrends.mockResolvedValue([]);
  render(<TrendsSection />);

  expect(await screen.findByText(/prometheusExporter.serviceMonitor.enabled=true/)).toBeTruthy();
});

it('offers the Prometheus found in the cluster while none is configured', async () => {
  mocks.prometheusUrl = undefined;
  mocks.detectPrometheus.mockResolvedValue(['monitoring/prometheus:9090']);
  render(<TrendsSection />);

  fireEvent.click(await screen.findByText('Use monitoring/prometheus:9090'));

  expect(mocks.update).toHaveBeenCalledWith({ prometheusUrl: 'monitoring/prometheus:9090' });
  expect(mocks.fetchTrends).not.toHaveBeenCalled();
});

it('shows why the trends could not be read', async () => {
  mocks.fetchTrends.mockRejectedValue(new Error('503 Service Unavailable'));
  render(<TrendsSection />);

  expect(
    await screen.findByText('Unable to read the trends from Prometheus: 503 Service Unavailable')
  ).toBeTruthy();
});
