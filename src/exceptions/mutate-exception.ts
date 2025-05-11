import { put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
import {
  getItemFromSessionStorage,
  KubescapeSettings,
  setItemInSessionStorage,
} from '../common/sessionStorage';
import { Control } from '../rego';
import { ExceptionPolicyGroup, ResourceDesignator } from './ExceptionPolicy';

export async function mutateResourceException(
  name: string,
  namespace: string,
  kind: string,
  exclude: boolean
): Promise<string | null> {
  const [exceptionGroup, errorMessage] = getExceptionGroup();
  if (errorMessage || !exceptionGroup) {
    return errorMessage;
  }

  const policyName = 'resource-exceptions';
  let resourceExceptions = exceptionGroup.exceptionPolicies.find(
    policy => policy.name === policyName
  );

  if (!resourceExceptions) {
    resourceExceptions = {
      name: policyName,
      creationTime: new Date(),
      resources: [],
    };
    exceptionGroup.exceptionPolicies.push(resourceExceptions);
  }

  resourceExceptions.resources = mutateResources(
    resourceExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  updateConfigMap(exceptionGroup);

  return '';
}

export async function mutateControlException(
  name: string,
  namespace: string,
  kind: string,
  control: Control,
  exclude: boolean
): Promise<string | null> {
  const [exceptionGroup, errorMessage] = getExceptionGroup();
  if (errorMessage || !exceptionGroup) {
    return errorMessage;
  }

  const policyName = `control-${control.controlID}-exception`;
  let controlExceptions = exceptionGroup.exceptionPolicies.find(
    policy => policy.name === policyName
  );
  if (!controlExceptions) {
    controlExceptions = {
      name: policyName,
      creationTime: new Date(),
      resources: [],
      posturePolicies: [
        {
          controlID: control.controlID,
        },
      ],
    };
    exceptionGroup.exceptionPolicies.push(controlExceptions);
  }
  controlExceptions.resources = mutateResources(
    controlExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  updateConfigMap(exceptionGroup);
  return '';
}

export async function mutateNamespaceException(
  namespace: string,
  exclude: boolean
): Promise<string | null> {
  const [exceptionGroup, errorMessage] = getExceptionGroup();
  if (errorMessage || !exceptionGroup) {
    return errorMessage;
  }
  const policyName = `namespace-${namespace}-exception`;
  let namespaceException = exceptionGroup.exceptionPolicies.find(
    policy => policy.name === policyName
  );
  if (!namespaceException && exclude) {
    // there is no namespace exception policy, but we want to add one
    namespaceException = {
      name: policyName,
      creationTime: new Date(),
      resources: [
        {
          designatorType: 'Attributes',
          attributes: {
            namespace: namespace,
          },
        },
      ],
    };
    exceptionGroup.exceptionPolicies.push(namespaceException);
  } else if (namespaceException && !exclude) {
    // there is a namespace exception policy, but we want to remove it
    exceptionGroup.exceptionPolicies.splice(
      exceptionGroup.exceptionPolicies.indexOf(namespaceException),
      1
    );
  }

  return updateConfigMap(exceptionGroup);
}

function mutateResources(
  resources: ResourceDesignator[],
  name: string,
  namespace: string,
  kind: string,
  exclude: boolean
): ResourceDesignator[] {
  const index = resources.findIndex(resource => {
    return (
      resource.attributes.name === name &&
      resource.attributes.namespace === namespace &&
      resource.attributes.kind === kind
    );
  });

  if (exclude && index === -1) {
    resources.push({
      designatorType: 'Attributes',
      attributes: {
        name: name,
        namespace: namespace,
        kind: kind,
      },
    });
  }
  if (!exclude && index !== -1) {
    resources.splice(index, 1);
  }
  return resources;
}

async function updateConfigMap(exceptionGroup: ExceptionPolicyGroup) {
  const kubeScapeNamespace =
    getItemFromSessionStorage<string>(KubescapeSettings.KubescapeNamespace) ?? 'kubescape';

  const configMap = (await request(
    `/api/v1/namespaces/${kubeScapeNamespace}/configmaps/${exceptionGroup.configmapManifestName}`
  ).catch(err => console.error(err))) as KubeConfigMap;

  if (!configMap) {
    return `Could not find configmap ${exceptionGroup.configmapManifestName}`;
  }

  configMap.data.exceptionPolicies = JSON.stringify(exceptionGroup.exceptionPolicies);
  await put(
    `/api/v1/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`,
    configMap
  ).catch(err => console.error(err));

  // cache the exception group in session storage
  setItemInSessionStorage(KubescapeSettings.SelectedExceptionGroup, exceptionGroup);

  return '';
}

function getExceptionGroup(): [ExceptionPolicyGroup | null, string | null] {
  const exceptionGroup = getItemFromSessionStorage<ExceptionPolicyGroup>(
    KubescapeSettings.SelectedExceptionGroup
  );
  if (!exceptionGroup) {
    return [null, 'Please select an exception group first'];
  }

  return [exceptionGroup, null];
}
