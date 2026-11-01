import dagre from '@dagrejs/dagre';
import { Edge, MarkerType, Node } from '@xyflow/react';
import {
  GeneratedNetworkPolicy,
  NetworkPolicy,
} from '../softwarecomposition/GeneratedNetworkPolicy';
import type { Direction } from './compare';
import { portKey, sortPorts } from './ports';

// Size of nodes that have not been rendered yet
const defaultNodeWidth = 310;
const defaultNodeHeight = 70;

function nodeSize(node: Node) {
  return {
    width: node.measured?.width ?? defaultNodeWidth,
    height: node.measured?.height ?? defaultNodeHeight,
  };
}

/**
 * Positions the nodes from left to right. Rendered nodes are laid out with their measured
 * size, so that nodes with long selectors do not overlap.
 */
export function layoutElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 20, ranksep: 100 });

  nodes.forEach(node => {
    dagreGraph.setNode(node.id, nodeSize(node));
  });

  // dagre adds the end of an edge that is not a node without a size, which makes every
  // position NaN, so React Flow draws all nodes on top of each other
  const ids = new Set(nodes.map(node => node.id));
  edges.forEach(edge => {
    if (ids.has(edge.source) && ids.has(edge.target)) dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // dagre positions the center of a node, React Flow its top left corner
  nodes.forEach(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = nodeSize(node);
    const x = (nodeWithPosition?.x ?? 0) - width / 2;
    const y = (nodeWithPosition?.y ?? 0) - height / 2;
    node.position = { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
  });
}

export function createNodes(networkPolicy: GeneratedNetworkPolicy): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const workloadNode: Node = {
    id: 'main',
    data: {
      policy: networkPolicy,
    },
    position: { x: 0, y: 0 },
    type: 'mainNode',
  };
  nodes.push(workloadNode);

  // Each peer once, with the ports of all its rules; many IP ranges, and many pods that only
  // differ in the values of some labels, with the same ports share one node
  const peers = policyPeers(networkPolicy);
  const groups = peerGroups(peers);
  const nodesByGroup = new Map<string, Node>();
  for (const policyPeer of peers) {
    const groupKey = groupKeyOf(policyPeer);
    const group = groupKey ? groups.get(groupKey) : undefined;
    const existing = group && nodesByGroup.get(groupKey!);
    if (existing) {
      (existing.data.peers as NetworkPolicy.Peer[]).push(...policyPeer.peers);
      continue;
    }

    const type = policyPeer.direction === 'ingress' ? 'sourceNode' : 'targetNode';
    const node: Node = {
      id: nodes.length.toString(),
      data: {
        peer: group?.peer ?? policyPeer.peer,
        peers: [...policyPeer.peers],
        policy: networkPolicy,
        ports: policyPeer.ports,
        ...(group && { group: group.kind, differingLabels: group.differingLabels }),
      },
      position: { x: 0, y: 0 },
      type,
    };
    nodes.push(node);
    if (group) nodesByGroup.set(groupKey!, node);

    edges.push({
      id: edges.length.toString(),
      source: type === 'sourceNode' ? node.id : workloadNode.id,
      target: type === 'sourceNode' ? workloadNode.id : node.id,
      type: 'step',
      markerEnd: { type: MarkerType.Arrow },
    });
  }
  return { nodes, edges };
}

/** A peer of a direction of the policy, with the ports of all rules it is in. */
export interface PolicyPeer {
  direction: Direction;
  // the peer without per-pod labels
  peer: NetworkPolicy.Peer;
  // the distinct peers of the policy it stands for
  peers: NetworkPolicy.Peer[];
  // sorted; none for a peer of a rule without ports, which allows all ports
  ports: NetworkPolicy.Port[];
}

/**
 * The peers of the policy, each once per direction. Generated policies often have a rule
 * per port with the same peers, such as one for each passive port of an FTP server.
 */
export function policyPeers(networkPolicy: GeneratedNetworkPolicy): PolicyPeer[] {
  const found = new Map<
    string,
    PolicyPeer & { seen: Set<string>; byKey: Map<string, NetworkPolicy.Port>; allPorts: boolean }
  >();
  const collect = (
    direction: Direction,
    peers: NetworkPolicy.Peer[] = [],
    ports: NetworkPolicy.Port[] | undefined
  ) => {
    for (const peer of peers) {
      const shown = withoutPerPodLabels(peer);
      const key = JSON.stringify([direction, shown]);
      let entry = found.get(key);
      if (!entry) {
        entry = {
          direction,
          peer: shown,
          peers: [],
          ports: [],
          seen: new Set(),
          byKey: new Map(),
          allPorts: false,
        };
        found.set(key, entry);
      }
      const own = JSON.stringify(peer);
      if (!entry.seen.has(own)) {
        entry.seen.add(own);
        entry.peers.push(peer);
      }
      if (!ports?.length) entry.allPorts = true;
      for (const port of ports ?? []) {
        if (!entry.byKey.has(portKey(port))) entry.byKey.set(portKey(port), port);
      }
    }
  };
  for (const ingress of networkPolicy.spec.spec.ingress ?? []) {
    collect('ingress', ingress.from, ingress.ports);
  }
  for (const egress of networkPolicy.spec.spec.egress ?? []) {
    collect('egress', egress.to, egress.ports);
  }
  return [...found.values()].map(({ direction, peer, peers, byKey, allPorts }) => ({
    direction,
    peer,
    peers,
    ports: allPorts ? [] : sortPorts([...byKey.values()]),
  }));
}

// Labels with a value per run of a Job, per rollout or per placement of a pod, such as those
// of the pods of every CronJob run. Peers are shown without them, so that all pods of a
// workload share one node.
export const perPodLabels = new Set([
  'controller-uid',
  'job-name',
  'batch.kubernetes.io/controller-uid',
  'batch.kubernetes.io/job-name',
  'pod-template-hash',
  'controller-revision-hash',
  'pod-template-generation',
  'topology.kubernetes.io/zone',
]);

// More IP ranges of one direction with the same ports than this share one node
export const maxSeparateRanges = 5;
// More pods of one direction, the same ports and label keys than this share one node
export const maxSeparatePods = 10;

interface PeerGroup {
  kind: 'ipRanges' | 'pods';
  // the peer as shown: for pods, the labels they have in common
  peer: NetworkPolicy.Peer;
  // for pods, the labels whose values differ between them
  differingLabels: string[];
}

/**
 * The group a peer would share a node with: IP ranges by direction, ports and whether they
 * are in the cluster; pods by direction, ports, namespace and the keys of their labels.
 */
function groupKeyOf({ direction, peer, ports }: PolicyPeer): string | undefined {
  const portKeys = ports.map(portKey);
  if (peer.ipBlock) {
    return JSON.stringify([direction, 'ipRanges', isClusterRange(peer.ipBlock.cidr), portKeys]);
  }
  if (peer.podSelector?.matchLabels) {
    return JSON.stringify([
      direction,
      'pods',
      peer.namespaceSelector ?? null,
      peer.podSelector.matchExpressions ?? null,
      Object.keys(peer.podSelector.matchLabels).sort(),
      portKeys,
    ]);
  }
  return undefined;
}

/**
 * The groups with more peers than are shown apart, such as the client ranges of an ingress
 * controller or the pods an application starts per session, which would otherwise make a
 * diagram of hundreds or thousands of nodes.
 */
function peerGroups(peers: PolicyPeer[]): Map<string, PeerGroup> {
  // the peers of each group, which are distinct without their per-pod labels
  const members = new Map<string, NetworkPolicy.Peer[]>();
  for (const policyPeer of peers) {
    const key = groupKeyOf(policyPeer);
    if (!key) continue;
    const group = members.get(key);
    if (group) group.push(policyPeer.peer);
    else members.set(key, [policyPeer.peer]);
  }

  const groups = new Map<string, PeerGroup>();
  for (const [key, distinct] of members) {
    if (distinct[0].ipBlock) {
      if (distinct.length > maxSeparateRanges) {
        groups.set(key, { kind: 'ipRanges', peer: distinct[0], differingLabels: [] });
      }
      continue;
    }
    if (distinct.length <= maxSeparatePods) continue;
    const labels = distinct[0].podSelector!.matchLabels!;
    const common = Object.fromEntries(
      Object.entries(labels).filter(([name, value]) =>
        distinct.every(peer => peer.podSelector!.matchLabels![name] === value)
      )
    );
    groups.set(key, {
      kind: 'pods',
      peer: { ...distinct[0], podSelector: { ...distinct[0].podSelector, matchLabels: common } },
      differingLabels: Object.keys(labels).filter(name => !(name in common)),
    });
  }
  return groups;
}

/**
 * Whether an IP range is private, as the addresses of the cluster are: RFC 1918, the shared
 * address space that some clusters use for pods, and IPv6 unique local addresses.
 */
export function isClusterRange(cidr: string): boolean {
  if (/^f[cd]/i.test(cidr)) return true;
  const [first, second] = cidr.split('.').map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

export function withoutPerPodLabels(peer: NetworkPolicy.Peer): NetworkPolicy.Peer {
  const matchLabels = peer.podSelector?.matchLabels;
  if (!matchLabels) return peer;
  return {
    ...peer,
    podSelector: {
      ...peer.podSelector,
      matchLabels: Object.fromEntries(
        Object.entries(matchLabels).filter(([key]) => !perPodLabels.has(key))
      ),
    },
  };
}
