import { vi } from 'vitest';
import {
  configurationScanCommand,
  getOperatorCommandStatus,
  sendOperatorCommand,
  vulnerabilityScanCommand,
  waitForOperatorCommand,
} from './operatorCommands';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  request: vi.fn(),
  getKubescapeNamespace: vi.fn(),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  post: mocks.post,
  request: mocks.request,
}));
vi.mock('../custom-objects/api-queries', () => ({
  getKubescapeNamespace: mocks.getKubescapeNamespace,
}));

const commandsPath = '/apis/kubescape.io/v1alpha1/namespaces/kubescape/operatorcommands';
const ref = { cluster: 'cluster-a', namespace: 'kubescape', name: 'headlamp-x7k2p' };

beforeEach(() => {
  mocks.post.mockReset();
  mocks.request.mockReset();
  mocks.getKubescapeNamespace.mockReset();
  mocks.getKubescapeNamespace.mockResolvedValue({ kubeScapeNamespace: 'kubescape', error: null });
});

it('creates an OperatorCommand that the operator picks up, with the command as body', async () => {
  mocks.post.mockResolvedValue({ metadata: { name: 'headlamp-x7k2p' } });

  expect(await sendOperatorCommand('cluster-a', configurationScanCommand)).toEqual(ref);

  const [path, object, , options] = mocks.post.mock.calls[0];
  expect(path).toBe(commandsPath);
  expect(options).toEqual({ cluster: 'cluster-a' });
  expect(object.metadata).toEqual({
    generateName: 'headlamp-',
    namespace: 'kubescape',
    labels: { 'kubescape.io/app-name': 'operator' },
  });
  expect(object.spec.commandType).toBe('OperatorAPI');
  expect(object.spec.guid).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.parse(atob(object.spec.body))).toEqual({
    commandName: 'kubescapeScan',
    args: { scanV1: { submit: true } },
  });
  expect(mocks.getKubescapeNamespace).toHaveBeenCalledWith('cluster-a');
});

it('scans the pods of a workload, which the operator selects by namespace and labels', async () => {
  mocks.request.mockResolvedValue({
    spec: { template: { metadata: { labels: { app: 'web', tier: 'front' } } } },
  });

  // a wlid alone fails in the operator with "failed to get container for image"
  expect(
    await vulnerabilityScanCommand('wlid://cluster-prod/namespace-shop/deployment-web-api', 'c-a')
  ).toEqual({
    commandName: 'scan',
    wildWlid: 'wlid://cluster-prod/namespace-shop',
    args: { labels: { app: 'web', tier: 'front' } },
  });
  expect(mocks.request).toHaveBeenCalledWith('/apis/apps/v1/namespaces/shop/deployments/web-api', {
    cluster: 'c-a',
  });
});

it('scans the pods of a CronJob by the labels of its job template', async () => {
  mocks.request.mockResolvedValue({
    spec: { jobTemplate: { spec: { template: { metadata: { labels: { job: 'backup' } } } } } },
  });

  const command = await vulnerabilityScanCommand(
    'wlid://cluster-prod/namespace-ops/cronjob-backup',
    'c-a'
  );

  expect(command.args).toEqual({ labels: { job: 'backup' } });
  expect(mocks.request.mock.calls[0][0]).toBe('/apis/batch/v1/namespaces/ops/cronjobs/backup');
});

it('scans a bare pod by its name', async () => {
  expect(
    await vulnerabilityScanCommand('wlid://cluster-prod/namespace-shop/pod-debug', 'c-a')
  ).toEqual({
    commandName: 'scan',
    wildWlid: 'wlid://cluster-prod/namespace-shop',
    args: { fieldSelector: { 'metadata.name': 'debug' } },
  });
  expect(mocks.request).not.toHaveBeenCalled();
});

it('does not scan a whole namespace for a workload without pod labels', async () => {
  mocks.request.mockResolvedValue({ spec: { template: { metadata: {} } } });

  await expect(
    vulnerabilityScanCommand('wlid://cluster-prod/namespace-shop/deployment-web', 'c-a')
  ).rejects.toThrow('have no labels');
  await expect(vulnerabilityScanCommand('not-a-wlid', 'c-a')).rejects.toThrow('cannot rescan');
});

it('does not send a command without the operator namespace', async () => {
  mocks.getKubescapeNamespace.mockResolvedValue({
    kubeScapeNamespace: undefined,
    error: 'Kubescape operator namespace not found.',
  });

  await expect(sendOperatorCommand('cluster-a', configurationScanCommand)).rejects.toThrow(
    'Kubescape operator namespace not found.'
  );
  expect(mocks.post).not.toHaveBeenCalled();
});

it('reads the status the operator reports', async () => {
  mocks.request.mockResolvedValueOnce({ status: { started: true, completed: false } });
  expect(await getOperatorCommandStatus(ref)).toEqual({
    started: true,
    completed: false,
    error: undefined,
  });
  expect(mocks.request).toHaveBeenCalledWith(`${commandsPath}/headlamp-x7k2p`, {
    cluster: 'cluster-a',
  });

  mocks.request.mockResolvedValueOnce({
    status: { started: true, completed: true, error: { message: 'kubescape not reachable' } },
  });
  expect((await getOperatorCommandStatus(ref)).error).toBe('kubescape not reachable');
});

it('waits until the operator completes the command, or gives up', async () => {
  mocks.request
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ status: { started: true } })
    .mockResolvedValueOnce({ status: { started: true, completed: true } });
  expect(await waitForOperatorCommand(ref, { interval: 1, timeout: 1000 })).toEqual({
    started: true,
    completed: true,
    error: undefined,
    timedOut: false,
  });
  expect(mocks.request).toHaveBeenCalledTimes(3);

  mocks.request.mockReset().mockResolvedValue({});
  expect((await waitForOperatorCommand(ref, { interval: 1, timeout: 20 })).timedOut).toBe(true);
});
