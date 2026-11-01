import dagre from '@dagrejs/dagre';
import { Edge, MarkerType, Node } from '@xyflow/react';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';

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

  if (networkPolicy.spec.spec.ingress) {
    for (const ingress of networkPolicy.spec.spec.ingress) {
      if (!ingress.from) {
        continue;
      }
      for (const from of ingress.from) {
        const node: Node = {
          id: nodes.length.toString(),
          data: {
            peer: from,
            policy: networkPolicy,
            ports: ingress.ports,
          },
          position: { x: 0, y: 0 },
          type: 'sourceNode',
        };
        nodes.push(node);

        const edge: Edge = {
          id: edges.length.toString(),
          source: node.id,
          target: workloadNode.id,
          type: 'step',
          markerEnd: { type: MarkerType.Arrow },
        };
        edges.push(edge);
      }
    }
  }

  if (networkPolicy.spec.spec.egress) {
    for (const egress of networkPolicy.spec.spec.egress) {
      if (!egress.to) {
        continue;
      }
      for (const to of egress.to) {
        const node: Node = {
          id: nodes.length.toString(),
          data: {
            peer: to,
            policy: networkPolicy,
            ports: egress.ports,
          },
          position: { x: 0, y: 0 },
          type: 'targetNode',
        };
        nodes.push(node);

        const edge: Edge = {
          id: edges.length.toString(),
          source: workloadNode.id,
          target: node.id,
          type: 'step',
          markerEnd: { type: MarkerType.Arrow },
        };
        edges.push(edge);
      }
    }
  }
  return { nodes, edges };
}
