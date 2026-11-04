import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

export type ProfileView = 'behavior' | 'network';

export interface ProfileResource {
  plural: 'containerprofiles' | 'applicationprofiles' | 'networkneighborhoods';
  modern: boolean;
}

const apiVersionPath = '/apis/spdx.softwarecomposition.kubescape.io/v1beta1';

/**
 * Prefer the unified API while retaining the documented older Storage releases.
 * @param cluster - The cluster to look in, the current cluster by default.
 */
export async function discoverProfileResource(
  view: ProfileView,
  cluster?: string
): Promise<ProfileResource> {
  const discovery = await request(apiVersionPath, cluster ? { cluster } : {});
  if (!Array.isArray(discovery?.resources)) {
    throw new Error('Storage returned invalid software composition API discovery');
  }

  const names = new Set(discovery.resources.map((resource: { name?: string }) => resource.name));
  if (names.has('containerprofiles')) return { plural: 'containerprofiles', modern: true };

  const legacy = view === 'behavior' ? 'applicationprofiles' : 'networkneighborhoods';
  if (names.has(legacy)) return { plural: legacy, modern: false };

  throw new Error(`Storage does not serve ContainerProfiles or ${legacy}`);
}
