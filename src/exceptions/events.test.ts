import { vi } from 'vitest';
import { fetchExceptionEvents } from './events';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

beforeEach(() => request.mockReset());

it('reads the matches the scanner reported for a namespaced exception, newest first', async () => {
  request.mockResolvedValue({
    items: [
      {
        message: 'Matched control C-0001 on Deployment/web',
        lastTimestamp: '2026-10-30T10:00:00Z',
      },
      { message: 'Matched control C-0002 on Deployment/web', eventTime: '2026-10-30T11:00:00Z' },
    ],
  });

  const events = await fetchExceptionEvents('SecurityException', 'web', 'shop');

  expect(events.map(event => event.message)).toEqual([
    'Matched control C-0002 on Deployment/web',
    'Matched control C-0001 on Deployment/web',
  ]);
  const [path, query] = request.mock.calls[0][0].split('?');
  expect(path).toBe('/api/v1/namespaces/shop/events');
  expect(new URLSearchParams(query).get('fieldSelector')).toBe(
    'involvedObject.kind=SecurityException,involvedObject.name=web,reason=ExceptionMatched'
  );
});

it('looks in all namespaces for a cluster-wide exception', async () => {
  request.mockResolvedValue({});
  expect(await fetchExceptionEvents('ClusterSecurityException', 'all-dev')).toEqual([]);
  expect(request.mock.calls[0][0]).toMatch(/^\/api\/v1\/events\?/);
});
