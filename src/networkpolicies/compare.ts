/*
  Compares the traffic that Kubescape saw a workload use, which its generated network policy
  allows, with the NetworkPolicies in the cluster that select the workload.
*/
import { NetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';

export type Direction = 'ingress' | 'egress';

/** One side of observed traffic: a pod, all pods of a namespace, or an IP range. */
export interface Endpoint {
  namespace?: string;
  namespaceLabels?: Record<string, string>;
  // the labels of the pod; without them, any pod of the namespace
  podLabels?: Record<string, string>;
  // the named container ports of the pod
  namedPorts?: Record<string, number>;
  cidr?: string;
}

export interface ExistingPolicy {
  metadata: { name: string; namespace: string };
  spec: NetworkPolicy.NetworkPolicySpec;
}

export interface ComparedWorkload {
  namespace: string;
  podLabels: Record<string, string>;
  namedPorts?: Record<string, number>;
}

/** Traffic of the generated policy: one peer with the ports of all its rules. */
export interface ObservedFlow {
  direction: Direction;
  peer: NetworkPolicy.Peer;
  ports: NetworkPolicy.Port[];
  endpoints: Endpoint[];
  // no pod has the labels of the peer anymore, so the labels of the generated policy are used
  approximate?: boolean;
}

// allowed by the policies that restrict the direction, by some of them, by none, or the
// direction is not restricted, so all traffic is allowed
export type FlowStatus = 'allowed' | 'partly' | 'blocked' | 'unrestricted';

export interface FlowResult extends ObservedFlow {
  status: FlowStatus;
  // the names of the policies with a rule that allows the traffic
  allowedBy: string[];
}

export interface PolicyComparison {
  // the policies that select the pods of the workload
  selecting: ExistingPolicy[];
  // of those, the policies that restrict each direction
  restricting: Record<Direction, ExistingPolicy[]>;
  flows: FlowResult[];
  // how many flows each rule allows, by ruleKey
  ruleUse: Map<string, number>;
}

export function ruleKey(policy: string, direction: Direction, index: number) {
  return JSON.stringify([policy, direction, index]);
}

/** Whether labels meet a label selector; an empty selector selects everything. */
export function selectorMatches(
  selector: NetworkPolicy.LabelSelector | undefined,
  labels: Record<string, string>
): boolean {
  for (const [key, value] of Object.entries(selector?.matchLabels ?? {})) {
    if (labels[key] !== value) return false;
  }
  for (const { key, operator, values = [] } of selector?.matchExpressions ?? []) {
    const has = key in labels;
    if (operator === 'In' && !(has && values.includes(labels[key]))) return false;
    if (operator === 'NotIn' && has && values.includes(labels[key])) return false;
    if (operator === 'Exists' && !has) return false;
    if (operator === 'DoesNotExist' && has) return false;
  }
  return true;
}

function isEmptySelector(selector: NetworkPolicy.LabelSelector) {
  return (
    Object.keys(selector.matchLabels ?? {}).length === 0 &&
    (selector.matchExpressions ?? []).length === 0
  );
}

/** The directions a policy restricts; without policyTypes, Egress only when it has rules. */
export function policyDirections(spec: NetworkPolicy.NetworkPolicySpec): Direction[] {
  const types = spec.policyTypes ?? ['Ingress', ...(spec.egress ? ['Egress' as const] : [])];
  return types.map(type => (type === 'Ingress' ? 'ingress' : 'egress'));
}

function parseIPv4Cidr(cidr: string): { base: number; bits: number } | undefined {
  const match = cidr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/);
  if (!match) return undefined;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some(octet => octet > 255)) return undefined;
  const bits = match[5] === undefined ? 32 : Number(match[5]);
  const address = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  return { base: (address & mask(bits)) >>> 0, bits };
}

function mask(bits: number) {
  return bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
}

/** Whether the outer range holds all of the inner one. IPv6 ranges only match themselves. */
export function cidrContains(outer: string, inner: string): boolean {
  const a = parseIPv4Cidr(outer);
  const b = parseIPv4Cidr(inner);
  if (!a || !b) return outer === inner || outer === '::/0';
  return a.bits <= b.bits && (b.base & mask(a.bits)) >>> 0 === a.base;
}

function cidrOverlaps(first: string, second: string) {
  return cidrContains(first, second) || cidrContains(second, first);
}

function ipBlockContains(ipBlock: NetworkPolicy.IPBlock, cidr: string) {
  return (
    cidrContains(ipBlock.cidr, cidr) &&
    !(ipBlock.except ?? []).some(excepted => cidrOverlaps(excepted, cidr))
  );
}

/**
 * Whether a peer of a policy in the namespace selects the endpoint. IP blocks are not matched
 * against pods: whether they apply to pod addresses depends on the network plugin.
 */
export function peerSelects(
  peer: NetworkPolicy.Peer,
  endpoint: Endpoint,
  policyNamespace: string
): boolean {
  if (peer.ipBlock) return !!endpoint.cidr && ipBlockContains(peer.ipBlock, endpoint.cidr);
  if (endpoint.cidr) return false;
  const inNamespace = peer.namespaceSelector
    ? selectorMatches(peer.namespaceSelector, endpoint.namespaceLabels ?? {})
    : endpoint.namespace === policyNamespace;
  if (!inNamespace) return false;
  if (!peer.podSelector) return true;
  return endpoint.podLabels
    ? selectorMatches(peer.podSelector, endpoint.podLabels)
    : isEmptySelector(peer.podSelector);
}

/**
 * Whether a port of a rule allows a port of the generated policy; a generated rule without a
 * port allows all ports. Named ports are those of the pod the traffic goes to.
 */
export function portAllows(
  rulePort: NetworkPolicy.Port,
  observed: NetworkPolicy.Port | undefined,
  namedPorts: Record<string, number> = {}
): boolean {
  if (!observed) return false;
  if ((rulePort.protocol ?? 'TCP') !== (observed.protocol ?? 'TCP')) return false;
  const allowed = rulePort.port as string | number | undefined;
  if (allowed === undefined) return true;
  if (observed.port === undefined) return false;
  const port = Number(observed.port);
  const number = typeof allowed === 'number' || /^\d+$/.test(allowed) ? Number(allowed) : undefined;
  if (number === undefined) return namedPorts[allowed] === port;
  return rulePort.endPort ? number <= port && port <= rulePort.endPort : number === port;
}

interface Rule {
  ports?: NetworkPolicy.Port[];
  peers?: NetworkPolicy.Peer[];
}

function rulesOf(spec: NetworkPolicy.NetworkPolicySpec, direction: Direction): Rule[] {
  return direction === 'ingress'
    ? (spec.ingress ?? []).map(rule => ({ ports: rule.ports, peers: rule.from }))
    : (spec.egress ?? []).map(rule => ({ ports: rule.ports, peers: rule.to }));
}

/** Compares the observed traffic of the workload with the policies of its namespace. */
export function comparePolicies(
  policies: ExistingPolicy[],
  workload: ComparedWorkload,
  flows: ObservedFlow[]
): PolicyComparison {
  const selecting = policies.filter(
    policy =>
      policy.metadata.namespace === workload.namespace &&
      selectorMatches(policy.spec.podSelector, workload.podLabels)
  );
  const restricting: Record<Direction, ExistingPolicy[]> = {
    ingress: selecting.filter(policy => policyDirections(policy.spec).includes('ingress')),
    egress: selecting.filter(policy => policyDirections(policy.spec).includes('egress')),
  };
  const ruleUse = new Map<string, number>();

  const results = flows.map((flow): FlowResult => {
    const policiesOfDirection = restricting[flow.direction];
    if (policiesOfDirection.length === 0) return { ...flow, status: 'unrestricted', allowedBy: [] };

    const allowedBy = new Set<string>();
    const usedRules = new Set<string>();
    // every port of every endpoint of the flow has to be allowed
    const ports: (NetworkPolicy.Port | undefined)[] = flow.ports.length ? flow.ports : [undefined];
    let allowed = 0;
    let total = 0;
    for (const endpoint of flow.endpoints) {
      const namedPorts = flow.direction === 'ingress' ? workload.namedPorts : endpoint.namedPorts;
      for (const port of ports) {
        total++;
        let isAllowed = false;
        for (const policy of policiesOfDirection) {
          rulesOf(policy.spec, flow.direction).forEach((rule, index) => {
            // a rule without peers or ports allows all of them
            const peerAllowed =
              !rule.peers?.length ||
              rule.peers.some(peer => peerSelects(peer, endpoint, policy.metadata.namespace));
            const portAllowed =
              !rule.ports?.length ||
              rule.ports.some(rulePort => portAllows(rulePort, port, namedPorts));
            if (peerAllowed && portAllowed) {
              isAllowed = true;
              allowedBy.add(policy.metadata.name);
              usedRules.add(ruleKey(policy.metadata.name, flow.direction, index));
            }
          });
        }
        if (isAllowed) allowed++;
      }
    }
    for (const key of usedRules) ruleUse.set(key, (ruleUse.get(key) ?? 0) + 1);
    const status: FlowStatus =
      total > 0 && allowed === total ? 'allowed' : allowed > 0 ? 'partly' : 'blocked';
    return { ...flow, status, allowedBy: [...allowedBy] };
  });

  return { selecting, restricting, flows: results, ruleUse };
}
