import { patch, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { KubeConfigMap } from '@kinvolk/headlamp-plugin/lib/k8s/configMap';
import { kubescapeConfigStore } from '../common/config-store';
import { customObjectLabel } from '../model';
import { Control } from '../rego';
import { ExceptionPolicy, ResourceDesignator } from './ExceptionPolicy';

export async function mutateResourceException(
  name: string,
  namespace: string,
  kind: string,
  exclude: boolean
): Promise<string | null> {
  const [configMap, errorMessage] = await getExceptionsConfigMap();
  if (errorMessage) {
    return errorMessage;
  }
  const exceptionPolicies = JSON.parse(
    configMap.data.exceptionPolicies ?? '[]'
  ) as ExceptionPolicy[];
  const policyName = 'resource-exceptions';
  let resourceExceptions = exceptionPolicies.find(policy => policy.name === policyName);

  if (!resourceExceptions) {
    resourceExceptions = {
      name: policyName,
      creationTime: new Date(),
      resources: [],
    };
    exceptionPolicies.push(resourceExceptions);
  }

  resourceExceptions.resources = mutateResources(
    resourceExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  updateConfigMap(configMap, exceptionPolicies);

  return '';
}

export async function mutateControlException(
  name: string,
  namespace: string,
  kind: string,
  control: Control,
  exclude: boolean
): Promise<string | null> {
  const [configMap, errorMessage] = await getExceptionsConfigMap();
  if (errorMessage) {
    return errorMessage;
  }
  const exceptionPolicies = JSON.parse(
    configMap.data.exceptionPolicies ?? '[]'
  ) as ExceptionPolicy[];

  const policyName = `control-${control.controlID}-exception`;
  let controlExceptions = exceptionPolicies.find(policy => policy.name === policyName);
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
    exceptionPolicies.push(controlExceptions);
  }
  controlExceptions.resources = mutateResources(
    controlExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  updateConfigMap(configMap, exceptionPolicies);
  return '';
}

export async function mutateNamespaceException(
  namespace: string,
  exclude: boolean
): Promise<string | null> {
  const [configMap, errorMessage] = await getExceptionsConfigMap();
  if (errorMessage) {
    return errorMessage;
  }
  const exceptionPolicies = JSON.parse(
    configMap.data.exceptionPolicies ?? '[]'
  ) as ExceptionPolicy[];

  const policyName = `namespace-${namespace}-exception`;
  let namespaceException = exceptionPolicies.find(policy => policy.name === policyName);
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
    exceptionPolicies.push(namespaceException);
  } else if (namespaceException && !exclude) {
    // there is a namespace exception policy, but we want to remove it
    exceptionPolicies.splice(exceptionPolicies.indexOf(namespaceException), 1);
  }

  return updateConfigMap(configMap, exceptionPolicies);
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

async function getExceptionsConfigMap() {
  const exceptionGroupName = kubescapeConfigStore.get().exceptionGroupName;
  if (!exceptionGroupName) {
    return [null, 'Please select an exception policy first'];
  }

  const queryParams = new URLSearchParams();
  queryParams.append(
    'labelSelector',
    `${customObjectLabel}=exceptions,app.kubernetes.io/name=${exceptionGroupName}`
  );

  const configMapList = await request(`api/v1/configmaps?${queryParams.toString()}`).catch(
    error => {
      console.error(error);
    }
  );

  if (!configMapList.items || configMapList.items.length === 0) {
    return [null, `Could not find configmap ${exceptionGroupName}`];
  }
  return [configMapList.items[0], null];
}

async function updateConfigMap(configMap: KubeConfigMap, exceptionPolicies: ExceptionPolicy[]) {
  configMap.data.exceptionPolicies = JSON.stringify(exceptionPolicies);
  await patch(
    `/api/v1/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`,
    configMap
  ).catch(err => console.error(err));

  return '';
}
