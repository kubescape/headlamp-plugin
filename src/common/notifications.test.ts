import { vi } from 'vitest';
import {
  alertNotifications,
  checkNotifications,
  expiryNotifications,
  readSent,
} from './notifications';

const mocks = vi.hoisted(() => ({
  setNotificationsInStore: vi.fn(),
  request: vi.fn(),
  fetchKubescapeAlerts: vi.fn(),
  config: {} as any,
  alertmanagerUrl: '/proxy' as string | undefined,
}));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Notification: { setNotificationsInStore: mocks.setNotificationsInStore },
  Router: {
    createRouteURL: (route: string, params: Record<string, string>) =>
      `/c/${params.cluster}/${route}${params.namespace ? `/${params.namespace}` : ''}${
        params.name ? `/${params.name}` : ''
      }`,
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({ getClusterGroup: () => [] }));
vi.mock('../index', () => ({
  RoutingName: {
    ApplicationProfiles: 'runtime',
    SecurityExceptionDetail: 'exception',
    SecurityExceptionClusterDetail: 'cluster-exception',
  },
}));
vi.mock('../runtimedetection/alertmanager', () => ({
  fetchKubescapeAlerts: mocks.fetchKubescapeAlerts,
}));
vi.mock('./config-store', () => ({
  getAlertmanagerUrl: () => mocks.alertmanagerUrl,
  kubescapeConfigStore: { get: () => mocks.config },
}));

const now = new Date('2026-10-30T12:00:00Z');

function alert(fingerprint: string, severity: string) {
  return {
    labels: {
      alertname: 'KubescapeRuleViolated',
      rule_name: 'Unexpected process launched',
      severity,
      namespace: 'shop',
      workload_name: 'web',
    },
    annotations: {},
    startsAt: '2026-10-30T11:00:00Z',
    endsAt: '',
    status: { state: 'active' },
    fingerprint,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.setNotificationsInStore.mockReset();
  mocks.request.mockReset().mockResolvedValue({ items: [] });
  mocks.fetchKubescapeAlerts.mockReset().mockResolvedValue([]);
  mocks.config = {};
  mocks.alertmanagerUrl = '/proxy';
});

it('notifies about each new critical alert', () => {
  const { notifications, ids } = alertNotifications(
    [alert('a', 'critical'), alert('b', 'high'), alert('c', 'Critical')],
    'cluster-a',
    id => !id.includes('-c-')
  );

  expect(ids).toEqual(['kubescape-alert-cluster-a-a-2026-10-30T11:00:00Z']);
  expect(notifications).toEqual([
    {
      id: 'kubescape-alert-cluster-a-a-2026-10-30T11:00:00Z',
      message: 'Critical Kubescape runtime alert: Unexpected process launched in shop/web',
      date: new Date('2026-10-30T11:00:00Z').getTime(),
      cluster: 'cluster-a',
      url: '/c/cluster-a/runtime',
    },
  ]);
});

it('reads the priority the node-agent sends as the severity', () => {
  const { ids } = alertNotifications(
    [alert('a', '10'), alert('b', '8'), alert('c', '5'), alert('d', '1')],
    'cluster-a',
    () => true
  );

  expect(ids).toEqual(['kubescape-alert-cluster-a-a-2026-10-30T11:00:00Z']);
});

it('notifies once about many new critical alerts', () => {
  const alerts = ['a', 'b', 'c', 'd'].map(fingerprint => alert(fingerprint, 'critical'));
  const { notifications, ids } = alertNotifications(alerts, 'cluster-a', () => true, 1000);

  expect(ids).toHaveLength(4);
  expect(notifications.map(notification => notification.message)).toEqual([
    '4 new critical Kubescape runtime alerts in cluster-a',
  ]);
});

it('notifies about exceptions that expire soon, and again when they expired', () => {
  const notifications = expiryNotifications(
    [
      {
        name: 'accept-cve',
        namespace: 'shop',
        cluster: 'cluster-a',
        expiresAt: '2026-11-02T00:00:00Z',
        expired: false,
      },
      { name: 'old', cluster: 'cluster-a', expiresAt: '2026-10-30T00:00:00Z', expired: true },
    ],
    () => true
  );

  expect(notifications.map(notification => [notification.message, notification.url])).toEqual([
    [
      `SecurityException shop/accept-cve expires on ${new Date(
        '2026-11-02T00:00:00Z'
      ).toLocaleDateString()}`,
      '/c/cluster-a/exception/shop/accept-cve',
    ],
    [
      `ClusterSecurityException old expired on ${new Date(
        '2026-10-30T00:00:00Z'
      ).toLocaleDateString()}; scans report its findings again`,
      '/c/cluster-a/cluster-exception/old',
    ],
  ]);
  expect(notifications[0].id).not.toBe(
    expiryNotifications([{ ...notifications[0], expired: true } as any], () => true)[0]?.id
  );
});

it('sends each notification once, and keeps what it sent for two months', async () => {
  mocks.fetchKubescapeAlerts.mockResolvedValue([alert('a', 'critical')]);
  mocks.request.mockImplementation(async (url: string) =>
    url.endsWith('/securityexceptions')
      ? {
          items: [
            {
              kind: 'SecurityException',
              metadata: { name: 'accept-cve', namespace: 'shop' },
              spec: { expiresAt: '2026-11-02T00:00:00Z' },
            },
            {
              kind: 'SecurityException',
              metadata: { name: 'later', namespace: 'shop' },
              spec: { expiresAt: '2026-12-31T00:00:00Z' },
            },
          ],
        }
      : { items: [] }
  );

  await checkNotifications(['cluster-a'], now);
  expect(mocks.setNotificationsInStore).toHaveBeenCalledTimes(1);
  const sent = mocks.setNotificationsInStore.mock.calls[0][0];
  expect(sent.map((notification: any) => notification.message)).toEqual([
    'Critical Kubescape runtime alert: Unexpected process launched in shop/web',
    `SecurityException shop/accept-cve expires on ${new Date(
      '2026-11-02T00:00:00Z'
    ).toLocaleDateString()}`,
  ]);
  expect(sent[0]).toMatchObject({ seen: false, deleted: false });
  expect(mocks.request).toHaveBeenCalledWith('/apis/kubescape.io/v1beta1/securityexceptions', {
    cluster: 'cluster-a',
  });

  // nothing new: Headlamp would mark the notifications unseen again if they were sent again
  await checkNotifications(['cluster-a'], now);
  expect(mocks.setNotificationsInStore).toHaveBeenCalledTimes(1);

  expect(Object.keys(readSent(now.getTime()))).toHaveLength(2);
  expect(readSent(now.getTime() + 61 * 24 * 60 * 60 * 1000)).toEqual({});
});

it('does nothing when turned off', async () => {
  mocks.config = { notifications: false };
  mocks.fetchKubescapeAlerts.mockResolvedValue([alert('a', 'critical')]);

  await checkNotifications(['cluster-a'], now);

  expect(mocks.fetchKubescapeAlerts).not.toHaveBeenCalled();
  expect(mocks.setNotificationsInStore).not.toHaveBeenCalled();
});

it('does not read alerts without Alertmanager, and survives clusters without Kubescape', async () => {
  mocks.alertmanagerUrl = undefined;
  mocks.request.mockRejectedValue(new Error('404'));

  await checkNotifications(['cluster-a'], now);

  expect(mocks.fetchKubescapeAlerts).not.toHaveBeenCalled();
  expect(mocks.setNotificationsInStore).not.toHaveBeenCalled();
});
