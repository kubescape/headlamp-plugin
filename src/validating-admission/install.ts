/*
  Installing a playground policy in the cluster with a binding that only warns or audits, so
  it can be tried on real requests without rejecting any.
*/
import { post, put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

export type ValidationAction = 'Warn' | 'Audit';

// The parameters that the Kubescape library policies are written for
export const paramsName = 'basic-control-configuration';
const paramsCollection = '/apis/kubescape.io/v1/controlconfigurations';
const managedBy = { 'app.kubernetes.io/managed-by': 'headlamp-kubescape-plugin' };

export interface PolicyObject {
  apiVersion: string;
  kind: string;
  metadata: { name: string; [key: string]: any };
  spec?: { paramKind?: { apiVersion: string; kind: string }; [key: string]: any };
}

/** Reads the policy from the editor, or explains why it cannot be installed. */
export function checkPolicy(policy: any): string | null {
  if (!policy || policy.kind !== 'ValidatingAdmissionPolicy') {
    return 'The policy editor does not hold a ValidatingAdmissionPolicy.';
  }
  if (!/^admissionregistration\.k8s\.io\/v1(beta1)?$/.test(policy.apiVersion ?? '')) {
    return `Policies of apiVersion ${policy.apiVersion} cannot be installed.`;
  }
  if (!policy.metadata?.name) return 'The policy has no name.';
  return null;
}

export function bindingName(policy: PolicyObject) {
  return `${policy.metadata.name}-binding`;
}

/**
 * A binding that only warns or audits. Never Deny: the policy is being tried, and switching
 * to Deny is a decision to take with kubectl, knowing what it rejects.
 */
export function bindingFor(policy: PolicyObject, actions: ValidationAction[], namespace?: string) {
  return {
    apiVersion: policy.apiVersion,
    kind: 'ValidatingAdmissionPolicyBinding',
    metadata: { name: bindingName(policy), labels: managedBy },
    spec: {
      policyName: policy.metadata.name,
      validationActions: actions.filter(action => action === 'Warn' || action === 'Audit'),
      ...(policy.spec?.paramKind && {
        paramRef: { name: paramsName, parameterNotFoundAction: 'Deny' },
      }),
      ...(namespace && {
        matchResources: {
          namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': namespace } },
        },
      }),
    },
  };
}

function collectionOf(apiVersion: string, plural: string) {
  return `/apis/${apiVersion}/${plural}`;
}

export type ParamsState = 'unneeded' | 'not-served' | 'namespaced' | 'missing' | 'present';

/**
 * Whether the cluster has the ControlConfiguration that a policy with parameters reads: the
 * resource is served by the Kubescape CEL admission library's CRD, and the object exists.
 */
export async function paramsState(policy: PolicyObject, cluster?: string): Promise<ParamsState> {
  const paramKind = policy.spec?.paramKind;
  if (!paramKind) return 'unneeded';
  if (paramKind.apiVersion !== 'kubescape.io/v1' || paramKind.kind !== 'ControlConfiguration') {
    return 'not-served';
  }
  const options = cluster ? { cluster } : {};
  const discovery = await request('/apis/kubescape.io/v1', options).catch(() => null);
  const resource = discovery?.resources?.find((r: any) => r.name === 'controlconfigurations');
  if (!resource) return 'not-served';
  if (resource.namespaced) return 'namespaced';
  try {
    await request(`${paramsCollection}/${paramsName}`, options);
    return 'present';
  } catch (error: any) {
    if (error?.status === 404) return 'missing';
    throw error;
  }
}

/** Whether an object exists, with the resource version to replace it. */
async function existing(path: string, cluster?: string): Promise<string | null> {
  try {
    const object = await request(path, cluster ? { cluster } : {});
    return object?.metadata?.resourceVersion ?? '';
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function isInstalled(policy: PolicyObject, cluster?: string) {
  const path = `${collectionOf(policy.apiVersion, 'validatingadmissionpolicies')}/${
    policy.metadata.name
  }`;
  return (await existing(path, cluster)) !== null;
}

async function createOrReplace(collection: string, object: any, cluster?: string) {
  const options = cluster ? { cluster } : undefined;
  const resourceVersion = await existing(`${collection}/${object.metadata.name}`, cluster);
  if (resourceVersion === null) {
    return post(collection, object, true, options);
  }
  return put(
    `${collection}/${object.metadata.name}`,
    { ...object, metadata: { ...object.metadata, resourceVersion } },
    true,
    options
  );
}

// The policy as the user wrote it, also when it was copied from a cluster
function withoutServerFields(policy: PolicyObject) {
  const metadata = Object.fromEntries(
    Object.entries(policy.metadata).filter(
      ([key]) =>
        !['resourceVersion', 'uid', 'creationTimestamp', 'generation', 'managedFields'].includes(
          key
        )
    )
  );
  return {
    apiVersion: policy.apiVersion,
    kind: policy.kind,
    metadata: { ...metadata, labels: { ...policy.metadata.labels, ...managedBy } },
    spec: policy.spec,
  };
}

/**
 * Installs the policy, its warn or audit binding and, when given, the parameters it reads.
 * Objects that exist are replaced.
 */
export async function installPolicy(
  policy: PolicyObject,
  binding: ReturnType<typeof bindingFor>,
  params: any | null,
  cluster?: string
) {
  if (params) {
    await post(
      paramsCollection,
      { ...params, metadata: { ...params.metadata, name: paramsName } },
      true,
      cluster ? { cluster } : undefined
    );
  }
  await createOrReplace(
    collectionOf(policy.apiVersion, 'validatingadmissionpolicies'),
    withoutServerFields(policy),
    cluster
  );
  await createOrReplace(
    collectionOf(policy.apiVersion, 'validatingadmissionpolicybindings'),
    binding,
    cluster
  );
}
