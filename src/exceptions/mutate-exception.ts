import * as YAML from 'yaml';
import {
  getItemFromLocalStorage,
  KubescapeSettings,
  setItemInLocalStorage,
} from '../common/webStorage';
import { Control } from '../rego';
import { PostureExceptionPolicy, ResourceDesignator } from './PostureExceptionPolicy';

/**
 * Adds or removes a resource exception, depending on the exclude flag.
 *
 * If the exception doesn't exist, it will be created.
 *
 * @param {string} name The name of the workload.
 * @param {string} namespace The namespace of the workload.
 * @param {string} kind The kind of the workload.
 * @param {boolean} exclude If true, the exception will be removed. Otherwise it will be added.
 */
export function mutateResourceException(
  name: string,
  namespace: string,
  kind: string,
  exclude: boolean
) {
  const exceptions = getItemFromLocalStorage<string>(KubescapeSettings.Exceptions) ?? '';

  const postureExceptionPolicies: PostureExceptionPolicy[] = YAML.parse(exceptions);

  let resourceExceptions = postureExceptionPolicies.find(
    policy => policy.name === 'resource-exceptions'
  );

  if (!resourceExceptions) {
    resourceExceptions = {
      name: 'resource-exceptions',
      creationTime: new Date(),
      resources: [],
    };
    postureExceptionPolicies.push(resourceExceptions);
  }

  resourceExceptions.resources = mutateResources(
    resourceExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  setItemInLocalStorage(KubescapeSettings.Exceptions, YAML.stringify(postureExceptionPolicies));
}

/**
 * Adds or removes a control exception, depending on the exclude flag.
 *
 * If the exception doesn't exist, it will be created.
 *
 * @param {string} name The name of the workload.
 * @param {string} namespace The namespace of the workload.
 * @param {string} kind The kind of the workload.
 * @param {Control} control The control to add or remove the exception for.
 * @param {boolean} exclude If true, the exception will be removed. Otherwise it will be added.
 */
export function mutateControlException(
  name: string,
  namespace: string,
  kind: string,
  control: Control,
  exclude: boolean
) {
  const exceptions = getItemFromLocalStorage<string>(KubescapeSettings.Exceptions) ?? '';

  const postureExceptionPolicies: PostureExceptionPolicy[] = YAML.parse(exceptions);
  const policyName = `control-${control.controlID}-exception`;

  let controlExceptions = postureExceptionPolicies.find(policy => policy.name === policyName);

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
    postureExceptionPolicies.push(controlExceptions);
  }

  controlExceptions.resources = mutateResources(
    controlExceptions.resources,
    name,
    namespace,
    kind,
    exclude
  );

  setItemInLocalStorage(KubescapeSettings.Exceptions, YAML.stringify(postureExceptionPolicies));
}

/**
 * Updates the namespace exception policies in local storage.
 *
 * This function retrieves existing posture exception policies from local storage,
 * and either adds or removes a namespace exception policy based on the provided
 * `namespace` and `exclude` parameters.
 *
 * @param namespace - The namespace to be added or removed from exceptions.
 * @param exclude - A boolean indicating if the namespace should be excluded
 *                  (added to exceptions) or included (removed from exceptions).
 */

export function mutateNamespaceException(namespace: string, exclude: boolean) {
  const exceptions = getItemFromLocalStorage<string>(KubescapeSettings.Exceptions) ?? '';
  const postureExceptionPolicies: PostureExceptionPolicy[] = YAML.parse(exceptions);
  const policyName = `namespace-${namespace}-exception`;

  let controlExceptions = postureExceptionPolicies.find(policy => policy.name === policyName);

  if (!controlExceptions && exclude) {
    controlExceptions = {
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
    postureExceptionPolicies.push(controlExceptions);
  }
  if (controlExceptions && !exclude) {
    postureExceptionPolicies.splice(postureExceptionPolicies.indexOf(controlExceptions), 1);
  }

  setItemInLocalStorage(KubescapeSettings.Exceptions, YAML.stringify(postureExceptionPolicies));
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
