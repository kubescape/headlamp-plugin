import { vi } from 'vitest';
import { SeccompProfile } from '../softwarecomposition/SeccompProfile';
import {
  allowedSyscalls,
  discoverSeccompProfileClass,
  localhostProfile,
  profileContainers,
  securityContextYaml,
  toSeccompJson,
} from './seccomp';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  seccompProfileClass: { pluralName: 'seccompprofiles', backend: 'crd' },
  seccompProfileStorageClass: { pluralName: 'seccompprofiles', backend: 'storage' },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: mocks.request }));
vi.mock('../model', () => ({
  seccompProfileClass: mocks.seccompProfileClass,
  seccompProfileStorageClass: mocks.seccompProfileStorageClass,
}));

const served = (...names: string[]) => ({ resources: names.map(name => ({ name })) });

beforeEach(() => mocks.request.mockReset());

describe('discoverSeccompProfileClass', () => {
  it('prefers the SeccompProfile CRD, the default backend', async () => {
    mocks.request.mockResolvedValue(served('rules', 'seccompprofiles'));
    expect(await discoverSeccompProfileClass('cluster-a')).toBe(mocks.seccompProfileClass);
    expect(mocks.request).toHaveBeenCalledWith('/apis/kubescape.io/v1', { cluster: 'cluster-a' });
  });

  it('falls back to the Kubescape storage', async () => {
    mocks.request.mockImplementation(async (url: string) =>
      url === '/apis/kubescape.io/v1' ? served('rules') : served('seccompprofiles')
    );
    expect(await discoverSeccompProfileClass()).toBe(mocks.seccompProfileStorageClass);
    expect(mocks.request).toHaveBeenLastCalledWith(
      '/apis/spdx.softwarecomposition.kubescape.io/v1beta1',
      {}
    );
  });

  it('explains that the capability may be disabled when neither serves profiles', async () => {
    mocks.request.mockRejectedValueOnce(new Error('not found')).mockResolvedValue(served());
    await expect(discoverSeccompProfileClass()).rejects.toThrow('seccompProfileService');
  });
});

const spec: SeccompProfile.Spec = {
  defaultAction: 'SCMP_ACT_ERRNO',
  baseProfileName: 'runc-v1.1.0',
  architectures: ['SCMP_ARCH_X86_64'],
  syscalls: [
    { names: ['read', 'write'], action: 'SCMP_ACT_ALLOW' },
    { names: ['ptrace'], action: 'SCMP_ACT_ERRNO', errnoRet: 1 },
    { names: ['write', 'openat'], action: 'SCMP_ACT_ALLOW' },
  ],
};

const profile: SeccompProfile = {
  metadata: { name: 'deployment-web', namespace: 'shop' },
  spec: {
    containers: [{ name: 'web', spec }],
    initContainers: [{ name: 'migrate', spec }],
  },
  status: {
    containers: {
      web: { status: 'Installed', localhostProfile: 'kubescape/shop/deployment-web/web.json' },
    },
  },
};

it('lists the distinct allowed syscalls in order', () => {
  expect(allowedSyscalls(spec)).toEqual(['openat', 'read', 'write']);
  expect(allowedSyscalls(undefined)).toEqual([]);
});

it('lists the containers of all kinds', () => {
  expect(profileContainers(profile).map(c => c.name)).toEqual(['web', 'migrate']);
  expect(profileContainers({ metadata: profile.metadata })).toEqual([]);
});

it('returns where the profile is installed on the nodes, once it is', () => {
  const [web, migrate] = profileContainers(profile);
  expect(localhostProfile(profile, web)).toBe('kubescape/shop/deployment-web/web.json');
  expect(localhostProfile(profile, migrate)).toBeUndefined();
  expect(securityContextYaml('kubescape/shop/deployment-web/web.json')).toBe(
    [
      'securityContext:',
      '  seccompProfile:',
      '    type: Localhost',
      '    localhostProfile: kubescape/shop/deployment-web/web.json',
    ].join('\n')
  );
});

it('writes the profile in the seccomp format of the OCI runtime, without Kubescape fields', () => {
  expect(JSON.parse(toSeccompJson(spec))).toEqual({
    defaultAction: 'SCMP_ACT_ERRNO',
    architectures: ['SCMP_ARCH_X86_64'],
    syscalls: [
      { names: ['read', 'write'], action: 'SCMP_ACT_ALLOW' },
      { names: ['ptrace'], action: 'SCMP_ACT_ERRNO', errnoRet: 1 },
      { names: ['write', 'openat'], action: 'SCMP_ACT_ALLOW' },
    ],
  });
});
