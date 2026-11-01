import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { useEffect, useState } from 'react';
import {
  getItemFromSessionStorage,
  KubescapeSettings,
  setItemInSessionStorage,
} from '../common/sessionStorage';
import { customObjectLabel } from '../model';

export async function checkUniqueness(name: string, uid: string | undefined, customObject: string) {
  const queryParams = new URLSearchParams();
  let ok = true;
  queryParams.append('labelSelector', `${customObjectLabel}=${customObject}`);
  await request(`api/v1/configmaps?${queryParams.toString()}`).then(response => {
    response.items.forEach((kubernetesObject: KubeConfigMap) => {
      if (kubernetesObject.metadata.uid === uid) {
        return;
      }
      if (kubernetesObject.data.name === name) {
        ok = false;
      }
    });
  });
  return ok;
}

type KubescapeNamespaceResult = {
  kubeScapeNamespace: string | undefined;
  error: string | null;
};

/**
 * Return the namespace of the Kubescape operator in the given cluster.
 * The namespace is read from SessionStorage, where it is cached per cluster. If not found,
 * it is determined by looking for a pod with labels
 * app.kubernetes.io/name=kubescape-operator and app.kubernetes.io/component=kubescape.
 * @param cluster - The cluster to look in, the current cluster by default.
 * @returns An object with a namespace and an error.
 *          If the namespace is found, the error is null.
 *          If the namespace is not found, the namespace is undefined and the error says why.
 */
export async function getKubescapeNamespace(
  cluster: string | null = getCluster()
): Promise<KubescapeNamespaceResult> {
  const cacheKey = cluster ?? '';
  const cached = getItemFromSessionStorage<Record<string, string> | string>(
    KubescapeSettings.KubescapeNamespace
  );
  // Older plugin versions cached a single namespace for all clusters, which is ignored.
  const namespaces = cached && typeof cached === 'object' ? cached : {};
  if (namespaces[cacheKey]) {
    return { kubeScapeNamespace: namespaces[cacheKey], error: null };
  }

  const queryParams = new URLSearchParams();
  queryParams.append(
    'labelSelector',
    'app.kubernetes.io/name=kubescape-operator,app.kubernetes.io/component=kubescape'
  );
  let namespace: string | undefined;
  try {
    const response = await request(
      `api/v1/pods?${queryParams.toString()}`,
      cluster ? { cluster } : {}
    );
    namespace = response.items[0]?.metadata?.namespace;
  } catch (error: any) {
    return {
      kubeScapeNamespace: undefined,
      error: `Failed to look up the Kubescape operator namespace: ${error?.message ?? error}`,
    };
  }

  if (!namespace) {
    return { kubeScapeNamespace: undefined, error: 'Kubescape operator namespace not found.' };
  }
  setItemInSessionStorage(KubescapeSettings.KubescapeNamespace, {
    ...namespaces,
    [cacheKey]: namespace,
  });
  return { kubeScapeNamespace: namespace, error: null };
}

/**
 * Hook around {@link getKubescapeNamespace} for the current cluster.
 */
export function useKubescapeNamespace(): KubescapeNamespaceResult & { loading: boolean } {
  const [result, setResult] = useState<KubescapeNamespaceResult & { loading: boolean }>({
    kubeScapeNamespace: undefined,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    getKubescapeNamespace().then(namespaceResult => {
      if (active) setResult({ ...namespaceResult, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return result;
}
