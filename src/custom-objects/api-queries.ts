import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
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

/**
 * Return the namespace of the Kubescape operator.
 * The namespace is read from SessionStorage. If not found,
 * it is determined by looking for a pod with labels
 * app.kubernetes.io/name=kubescape-operator and app.kubernetes.io/instance=kubescape.
 * @returns An object with a namespace and an error.
 *          If the namespace is found, the error is null.
 *          If the namespace is not found, the error is "Kubescape operator namespace not found."
 */
export async function getKubescapeNamespace() {
  let namespace = getItemFromSessionStorage<string>(KubescapeSettings.KubescapeNamespace);
  if (namespace) {
    return { kubeScapeNamespace: namespace, error: null };
  }
  const queryParams = new URLSearchParams();
  queryParams.append(
    'labelSelector',
    'app.kubernetes.io/name=kubescape-operator,app.kubernetes.io/component=kubescape'
  );
  const response = await request(`api/v1/pods?${queryParams.toString()}`);
  namespace = response.items[0]?.metadata?.namespace;

  if (namespace) {
    setItemInSessionStorage(KubescapeSettings.KubescapeNamespace, namespace);
  }
  return { kubeScapeNamespace: namespace, error: null };
}
