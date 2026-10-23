import { beforeEach, expect, it, vi } from 'vitest';
import { discoverProfileResource } from './profileApi';

const request = vi.hoisted(() => vi.fn());
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));

const discoveryPath = '/apis/spdx.softwarecomposition.kubescape.io/v1beta1';

beforeEach(() => {
  request.mockReset();
});

it('prefers the unified ContainerProfile resource for both profile views', async () => {
  request.mockResolvedValue({
    resources: [
      { name: 'applicationprofiles' },
      { name: 'networkneighborhoods' },
      { name: 'containerprofiles' },
    ],
  });
  await expect(discoverProfileResource('behavior')).resolves.toEqual({
    plural: 'containerprofiles',
    modern: true,
  });
  await expect(discoverProfileResource('network')).resolves.toEqual({
    plural: 'containerprofiles',
    modern: true,
  });
  expect(request).toHaveBeenCalled();
  expect(request.mock.calls.every(([url]) => url === discoveryPath)).toBe(true);
});

it('selects view-specific legacy APIs on older Storage installations', async () => {
  request.mockResolvedValue({
    resources: [
      { name: 'applicationprofiles' },
      { name: 'networkneighborhoods' },
      { name: 'containerprofiles/status' },
    ],
  });
  await expect(discoverProfileResource('behavior')).resolves.toEqual({
    plural: 'applicationprofiles',
    modern: false,
  });
  await expect(discoverProfileResource('network')).resolves.toEqual({
    plural: 'networkneighborhoods',
    modern: false,
  });
});

it('rejects a valid discovery response with no compatible profile resource', async () => {
  request.mockResolvedValue({ resources: [{ name: 'unrelatedprofiles' }] });
  await expect(discoverProfileResource('behavior')).rejects.toThrow();
  await expect(discoverProfileResource('network')).rejects.toThrow();
});

it('does not treat a failed or malformed discovery request as proof of an older API', async () => {
  request.mockRejectedValueOnce(new Error('Forbidden'));
  await expect(discoverProfileResource('behavior')).rejects.toThrow('Forbidden');

  request.mockResolvedValueOnce({ resources: null });
  await expect(discoverProfileResource('network')).rejects.toThrow();
});
