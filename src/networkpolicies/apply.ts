import { post, put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';

export interface NetworkPolicyObject {
  apiVersion: 'networking.k8s.io/v1';
  kind: 'NetworkPolicy';
  metadata: {
    name: string;
    namespace: string;
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
    resourceVersion?: string;
  };
  spec: GeneratedNetworkPolicy['spec']['spec'];
}

/** The NetworkPolicy that Kubescape generated, ready to create in the cluster. */
export function toNetworkPolicy(generated: GeneratedNetworkPolicy): NetworkPolicyObject {
  const metadata = generated.spec.metadata ?? {};
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: metadata.name ?? generated.metadata.name,
      namespace: metadata.namespace ?? generated.metadata.namespace,
      ...(metadata.labels && { labels: metadata.labels }),
      ...(metadata.annotations && { annotations: metadata.annotations }),
    },
    spec: generated.spec.spec,
  };
}

function policyPath(namespace: string) {
  return `/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies`;
}

/** Returns the NetworkPolicy with the name of the given one, or null if there is none. */
export async function getExistingNetworkPolicy(
  policy: NetworkPolicyObject
): Promise<NetworkPolicyObject | null> {
  try {
    return await request(`${policyPath(policy.metadata.namespace)}/${policy.metadata.name}`);
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

/** Creates the NetworkPolicy, or replaces the existing one with the same name. */
export async function applyNetworkPolicy(
  policy: NetworkPolicyObject,
  existing: NetworkPolicyObject | null
): Promise<void> {
  const path = policyPath(policy.metadata.namespace);
  if (existing) {
    const replacement = {
      ...policy,
      metadata: { ...policy.metadata, resourceVersion: existing.metadata.resourceVersion },
    };
    await put(`${path}/${policy.metadata.name}`, replacement as any);
  } else {
    await post(path, policy);
  }
}
