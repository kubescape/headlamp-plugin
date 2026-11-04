/*
  Reads what is needed to compare a generated network policy with the NetworkPolicies of the
  cluster: those policies, the labels of the workload's pods and of the pods it talks to.
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { useEffect, useState } from 'react';
import { formatLabelSelector } from '../exceptions/apply-security-exceptions';
import {
  GeneratedNetworkPolicy,
  NetworkPolicy,
} from '../softwarecomposition/GeneratedNetworkPolicy';
import {
  ComparedWorkload,
  comparePolicies,
  Endpoint,
  ObservedFlow,
  PolicyComparison,
  selectorMatches,
} from './compare';
import { policyPeers, withoutPerPodLabels } from './layout';

// The paths of the workload kinds, with where their pod template is
const workloadPaths: Record<string, string> = {
  deployment: '/apis/apps/v1/namespaces/{namespace}/deployments/{name}',
  statefulset: '/apis/apps/v1/namespaces/{namespace}/statefulsets/{name}',
  daemonset: '/apis/apps/v1/namespaces/{namespace}/daemonsets/{name}',
  replicaset: '/apis/apps/v1/namespaces/{namespace}/replicasets/{name}',
  job: '/apis/batch/v1/namespaces/{namespace}/jobs/{name}',
  cronjob: '/apis/batch/v1/namespaces/{namespace}/cronjobs/{name}',
  pod: '/api/v1/namespaces/{namespace}/pods/{name}',
};

// Queries for the pods of peers; peers beyond them are matched with the labels of the
// generated policy
const maxPodQueries = 50;

interface PodLike {
  metadata?: { labels?: Record<string, string> };
  spec?: { containers?: { ports?: { name?: string; containerPort: number }[] }[] };
}

function namedPortsOf(pod: PodLike | undefined): Record<string, number> {
  const ports: Record<string, number> = {};
  for (const container of pod?.spec?.containers ?? []) {
    for (const port of container.ports ?? []) {
      if (port.name) ports[port.name] = port.containerPort;
    }
  }
  return ports;
}

/** The pod template of a workload, or the pod itself. */
function podTemplateOf(kind: string, object: any): PodLike | undefined {
  if (kind === 'pod') return object;
  if (kind === 'cronjob') return object?.spec?.jobTemplate?.spec?.template;
  return object?.spec?.template;
}

export function workloadOf(policy: GeneratedNetworkPolicy) {
  const labels = policy.metadata.labels ?? {};
  return {
    kind: (labels['kubescape.io/workload-kind'] ?? '').toLowerCase(),
    name: labels['kubescape.io/workload-name'] ?? '',
    namespace: labels['kubescape.io/workload-namespace'] ?? policy.metadata.namespace,
  };
}

/**
 * The traffic of the generated policy: one flow per peer and direction, without per-pod
 * labels, with the ports of all rules the peer is in, as the diagram shows the peers.
 */
export function observedFlows(policy: GeneratedNetworkPolicy): ObservedFlow[] {
  return policyPeers(policy).map(({ direction, peer, ports }) => ({
    direction,
    peer,
    ports,
    endpoints: [],
  }));
}

/** The names of the namespaces of a peer: those its selector selects, or the workload's. */
function peerNamespaces(
  peer: NetworkPolicy.Peer,
  workloadNamespace: string,
  namespaceLabels: Map<string, Record<string, string>>
): string[] {
  if (!peer.namespaceSelector) return [workloadNamespace];
  const name = peer.namespaceSelector.matchLabels?.['kubernetes.io/metadata.name'];
  if (name && namespaceLabels.size === 0) return [name];
  return [...namespaceLabels]
    .filter(([, labels]) => selectorMatches(peer.namespaceSelector, labels))
    .map(([namespace]) => namespace);
}

// The pods of a peer are looked up without the labels that differ per run or placement
function podQueryKey(namespace: string, peer: NetworkPolicy.Peer) {
  return JSON.stringify([namespace, withoutPerPodLabels(peer).podSelector]);
}

/** The namespaces and label selectors to find the pods of the peers with. */
export function podQueries(
  flows: ObservedFlow[],
  workloadNamespace: string,
  namespaceLabels: Map<string, Record<string, string>>
) {
  const queries = new Map<string, { namespace: string; selector: NetworkPolicy.LabelSelector }>();
  for (const { peer } of flows) {
    if (peer.ipBlock || !peer.podSelector) continue;
    for (const namespace of peerNamespaces(peer, workloadNamespace, namespaceLabels)) {
      queries.set(podQueryKey(namespace, peer), {
        namespace,
        selector: withoutPerPodLabels(peer).podSelector!,
      });
    }
  }
  return queries;
}

/**
 * The pods or IP range of each flow. Pods are those that now have the labels of the peer,
 * without the labels that differ per run or placement; their own labels decide which policies
 * select them, as the generated policy names only some of them.
 */
export function resolveEndpoints(
  flows: ObservedFlow[],
  workloadNamespace: string,
  namespaceLabels: Map<string, Record<string, string>>,
  // the pods found per podQueryKey
  podsByQuery: Map<string, PodLike[]>
): ObservedFlow[] {
  const labelsOf = (namespace: string) =>
    namespaceLabels.get(namespace) ?? { 'kubernetes.io/metadata.name': namespace };
  return flows.map(flow => {
    const { peer } = flow;
    if (peer.ipBlock) return { ...flow, endpoints: [{ cidr: peer.ipBlock.cidr }] };
    const namespaces = peerNamespaces(peer, workloadNamespace, namespaceLabels);
    if (!peer.podSelector) {
      return {
        ...flow,
        endpoints: namespaces.map(namespace => ({
          namespace,
          namespaceLabels: labelsOf(namespace),
        })),
      };
    }
    const endpoints = new Map<string, Endpoint>();
    for (const namespace of namespaces) {
      for (const pod of podsByQuery.get(podQueryKey(namespace, peer)) ?? []) {
        const podLabels = pod.metadata?.labels ?? {};
        // replicas with the same labels count once
        const shared = withoutPerPodLabels({ podSelector: { matchLabels: podLabels } });
        const key = JSON.stringify([namespace, shared.podSelector?.matchLabels]);
        endpoints.set(key, {
          namespace,
          namespaceLabels: labelsOf(namespace),
          podLabels,
          namedPorts: namedPortsOf(pod),
        });
      }
    }
    if (endpoints.size > 0) return { ...flow, endpoints: [...endpoints.values()] };
    return {
      ...flow,
      approximate: true,
      endpoints: namespaces.map(namespace => ({
        namespace,
        namespaceLabels: labelsOf(namespace),
        podLabels: peer.podSelector?.matchLabels ?? {},
      })),
    };
  });
}

async function readItems(path: string, cluster: string): Promise<any[]> {
  const list = await request(path, cluster ? { cluster } : {});
  return list?.items ?? [];
}

export interface ComparisonResult {
  comparison?: PolicyComparison;
  error?: string;
  // the workload's labels were taken from the generated policy
  approximateWorkload?: boolean;
}

/** Compares the generated policy with the NetworkPolicies of the workload's namespace. */
export async function readPolicyComparison(
  policy: GeneratedNetworkPolicy,
  cluster: string
): Promise<ComparisonResult> {
  const { kind, name, namespace } = workloadOf(policy);
  const path = workloadPaths[kind]
    ?.replace('{namespace}', encodeURIComponent(namespace))
    .replace('{name}', encodeURIComponent(name));

  const [policies, namespaces, workloadObject] = await Promise.all([
    readItems(`/apis/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies`, cluster),
    // without access to namespaces, peers are matched by the name of their namespace only
    readItems('/api/v1/namespaces', cluster).catch(() => []),
    path ? request(path, cluster ? { cluster } : {}).catch(() => undefined) : undefined,
  ]);

  const namespaceLabels = new Map<string, Record<string, string>>(
    namespaces.map((ns: any) => [ns.metadata.name, ns.metadata.labels ?? {}])
  );
  const template = podTemplateOf(kind, workloadObject);
  const workload: ComparedWorkload = {
    namespace,
    podLabels: template?.metadata?.labels ?? policy.spec.spec.podSelector?.matchLabels ?? {},
    namedPorts: namedPortsOf(template),
  };

  const flows = observedFlows(policy);
  const queries = [...podQueries(flows, namespace, namespaceLabels)].slice(0, maxPodQueries);
  const podLists = await Promise.all(
    queries.map(([, query]) => {
      const labelSelector = encodeURIComponent(formatLabelSelector(query.selector));
      return readItems(
        `/api/v1/namespaces/${query.namespace}/pods?labelSelector=${labelSelector}`,
        cluster
      ).catch(() => []);
    })
  );
  const podsByQuery = new Map(queries.map(([key], index) => [key, podLists[index]]));

  return {
    comparison: comparePolicies(
      policies,
      workload,
      resolveEndpoints(flows, namespace, namespaceLabels, podsByQuery)
    ),
    approximateWorkload: !template?.metadata?.labels,
  };
}

/** The comparison of the generated policy with the NetworkPolicies, read once per policy. */
export function usePolicyComparison(policy: GeneratedNetworkPolicy, cluster: string) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    readPolicyComparison(policy, cluster)
      .then(found => {
        if (active) setResult(found);
      })
      .catch(err => {
        if (active) setResult({ error: err?.message ?? String(err) });
      });
    return () => {
      active = false;
    };
  }, [policy, cluster]);
  return result;
}
