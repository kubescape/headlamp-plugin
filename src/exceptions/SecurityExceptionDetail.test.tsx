import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { vi } from 'vitest';
import { historyAnnotation } from './history';
import { SecurityExceptionDetail } from './SecurityExceptionDetail';

const mocks = vi.hoisted(() => ({ request: vi.fn(), exception: {} as any }));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../common/url', () => ({ getURLSegments: () => ['shop', 'web'] }));
vi.mock('../model', () => ({
  securityExceptionClass: {
    useApiGet: (setObject: (object: any) => void) =>
      useEffect(
        () => setObject({ metadata: mocks.exception.metadata, jsonData: mocks.exception }),
        []
      ),
  },
  clusterSecurityExceptionClass: {},
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  DateLabel: ({ date }: { date: string }) => <time>{date}</time>,
  SectionBox: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  NameValueTable: ({ rows }: any) => (
    <dl>
      {rows.map((row: any) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
  Table: ({ data = [], columns }: any) => (
    <table>
      <tbody>
        {data.map((item: any, i: number) => (
          <tr key={i}>
            {columns.map((column: any, j: number) => {
              const value = column.accessorFn?.(item) ?? item[column.accessorKey];
              return (
                <td key={j}>
                  {column.Cell ? column.Cell({ cell: { getValue: () => value } }) : value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

it('shows the author, the history and the findings the scanner suppressed', async () => {
  mocks.exception = {
    kind: 'SecurityException',
    metadata: {
      name: 'web',
      namespace: 'shop',
      creationTimestamp: '2026-10-30T10:00:00Z',
      annotations: {
        [historyAnnotation]: JSON.stringify([
          { action: 'created', user: 'alice@example.com', time: '2026-10-30T10:00:00Z' },
          { action: 'changed', user: 'bob@example.com', time: '2026-10-31T09:30:00Z' },
        ]),
      },
    },
    spec: { author: 'alice@example.com', reason: 'accepted risk' },
  };
  mocks.request.mockResolvedValue({
    items: [
      {
        reason: 'ExceptionMatched',
        message: 'Matched control C-0001 on Deployment/web in namespace shop',
        count: 3,
        lastTimestamp: '2026-10-31T10:00:00Z',
      },
    ],
  });

  render(<SecurityExceptionDetail />);

  const history = await screen.findByRole('region', { name: 'History' });
  const rows = within(history).getAllByRole('row');
  expect(rows.map(row => row.textContent)).toEqual([
    '2026-10-31T09:30:00ZChangedbob@example.com',
    '2026-10-30T10:00:00ZCreatedalice@example.com',
  ]);
  expect(screen.getByText('Author').nextElementSibling?.textContent).toBe('alice@example.com');

  const matches = screen.getByRole('region', { name: 'Applied by the scanner' });
  expect(
    await within(matches).findByText('Matched control C-0001 on Deployment/web in namespace shop')
  ).toBeTruthy();
  expect(mocks.request.mock.calls[0][0]).toMatch(/^\/api\/v1\/namespaces\/shop\/events\?/);
});
