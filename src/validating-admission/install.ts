/*
  Installing a playground policy in the cluster with a binding that only warns or audits, so
  it can be tried on real requests without rejecting any. A binding that denies may already refer
  to the name of the policy, also before the policy exists, and would then enforce the policy of
  the editor as soon as it is installed; such a policy is not installed.
*/
import { post, put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

export type ValidationAction = 'Warn' | 'Audit';

// The parameters that the Kubescape library policies are written for
export const paramsName = 'basic-control-configuration';
const paramsCollection = '/apis/kubescape.io/v1/controlconfigurations';
const managedByLabel = 'app.kubernetes.io/managed-by';
const managedBy = { [managedByLabel]: 'headlamp-kubescape-plugin' };

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

function plural(count: number, one: string, more: string) {
  return count === 1 ? one : more;
}

/** Every ValidatingAdmissionPolicyBinding of the cluster. */
async function listBindings(policy: PolicyObject, cluster?: string): Promise<any[]> {
  try {
    const list = await request(
      collectionOf(policy.apiVersion, 'validatingadmissionpolicybindings'),
      cluster ? { cluster } : {}
    );
    return list?.items ?? [];
  } catch (error: any) {
    // a cluster that does not serve the bindings has none
    if (error?.status !== 404) throw error;
    return [];
  }
}

function policyProblem(policy: PolicyObject, bindings: any[]): string | null {
  const name = policy.metadata.name;
  const denying = bindings
    .filter(
      binding =>
        binding?.spec?.policyName === name &&
        (binding.spec.validationActions ?? []).includes('Deny')
    )
    .map(binding => binding.metadata?.name);
  if (denying.length) {
    return (
      `${plural(denying.length, 'The binding', 'The bindings')} ${denying.join(', ')} ` +
      `${plural(denying.length, 'rejects', 'reject')} requests that violate ${name}, so ` +
      'installing would change what it enforces. Give the policy another name in the editor to ' +
      'try it.'
    );
  }
  const own = bindings.find(binding => binding?.metadata?.name === bindingName(policy));
  if (
    own &&
    (own.spec?.policyName !== name ||
      own.metadata?.labels?.[managedByLabel] !== managedBy[managedByLabel])
  ) {
    return (
      `The binding ${bindingName(policy)} exists and was not installed for this policy by the ` +
      'plugin, so installing would replace it. Give the policy another name in the editor to try ' +
      'it.'
    );
  }
  return null;
}

/**
 * Why installing the policy could reject requests or replace a binding that the plugin did not
 * install, or null. A binding that denies with the name of the policy would enforce the policy of
 * the editor, also outside the namespace chosen here; the plugin's own binding is one of them once
 * it is switched to Deny with kubectl. A binding with the name of the plugin's binding that the
 * plugin did not install, or that binds another policy, would be replaced.
 */
export async function installProblem(
  policy: PolicyObject,
  cluster?: string
): Promise<string | null> {
  return policyProblem(policy, await listBindings(policy, cluster));
}

function paramsProblem(bindings: any[]): string | null {
  const reading = bindings
    .filter(
      binding =>
        (binding?.spec?.validationActions ?? []).includes('Deny') &&
        (binding.spec.paramRef?.name === paramsName || binding.spec.paramRef?.selector)
    )
    .map(binding => binding.metadata?.name);
  if (!reading.length) return null;
  return (
    `${plural(reading.length, 'The binding', 'The bindings')} ${reading.join(', ')} ` +
    `${plural(reading.length, 'rejects', 'reject')} requests and may read the parameters ` +
    `${paramsName}, so creating them here could change what ` +
    `${plural(reading.length, 'it enforces', 'they enforce')}. Create them with kubectl when ` +
    'that is intended.'
  );
}

/**
 * Why creating the missing parameters could reject requests, or null. The parameters are shared
 * with the policies of the Kubescape library, so a binding that denies and reads them, by their
 * name or by a selector, would start to enforce its policy with them.
 */
export async function paramsCreationProblem(
  policy: PolicyObject,
  cluster?: string
): Promise<string | null> {
  return paramsProblem(await listBindings(policy, cluster));
}

/** The policy was installed, but its binding was not. */
export class BindingNotInstalledError extends Error {}

/**
 * Installs the policy, its warn or audit binding and, when given, the parameters it reads.
 * Objects that exist are replaced. Nothing is written when installProblem, or for the parameters
 * paramsCreationProblem, finds a problem, which is checked again here, as the bindings may have
 * changed since the dialog opened.
 */
export async function installPolicy(
  policy: PolicyObject,
  binding: ReturnType<typeof bindingFor>,
  params: any | null,
  cluster?: string
) {
  const bindings = await listBindings(policy, cluster);
  const problem = policyProblem(policy, bindings) ?? (params ? paramsProblem(bindings) : null);
  if (problem) throw new Error(problem);
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
  // every binding of the policy only warns or audits, so a policy without its new binding
  // rejects nothing either
  try {
    await createOrReplace(
      collectionOf(policy.apiVersion, 'validatingadmissionpolicybindings'),
      binding,
      cluster
    );
  } catch (error: any) {
    throw new BindingNotInstalledError(
      `Installed ${policy.metadata.name}, but not its binding ${binding.metadata.name}: ${
        error?.message ?? String(error)
      }`
    );
  }
}
