import dagre from '@dagrejs/dagre';
import { Edge, MarkerType, Node } from '@xyflow/react';
import {
  GeneratedNetworkPolicy,
  NetworkPolicy,
} from '../softwarecomposition/GeneratedNetworkPolicy';
import { portKey, sortPorts } from './ports';

export type Direction = 'ingress' | 'egress';

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

  // Each peer once, with the ports of all its rules
  for (const policyPeer of policyPeers(networkPolicy)) {
    const type = policyPeer.direction === 'ingress' ? 'sourceNode' : 'targetNode';
    const node: Node = {
      id: nodes.length.toString(),
      data: {
        peer: policyPeer.peer,
        policy: networkPolicy,
        ports: policyPeer.ports,
      },
      position: { x: 0, y: 0 },
      type,
    };
    nodes.push(node);

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
  peer: NetworkPolicy.Peer;
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
    PolicyPeer & { byKey: Map<string, NetworkPolicy.Port>; allPorts: boolean }
  >();
  const collect = (
    direction: Direction,
    peers: NetworkPolicy.Peer[] = [],
    ports: NetworkPolicy.Port[] | undefined
  ) => {
    for (const peer of peers) {
      const key = JSON.stringify([direction, peer]);
      let entry = found.get(key);
      if (!entry) {
        entry = { direction, peer, ports: [], byKey: new Map(), allPorts: false };
        found.set(key, entry);
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
  return [...found.values()].map(({ direction, peer, byKey, allPorts }) => ({
    direction,
    peer,
    ports: allPorts ? [] : sortPorts([...byKey.values()]),
  }));
}
