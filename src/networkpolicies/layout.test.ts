import { Edge, MarkerType, Node } from '@xyflow/react';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { createNodes, layoutElements } from './layout';

function makePolicy(
  overrides: Partial<Pick<GeneratedNetworkPolicy['spec']['spec'], 'ingress' | 'egress'>> = {}
): GeneratedNetworkPolicy {
  return {
    metadata: {
      creationTimestamp: '',
      name: 'test-policy',
      namespace: 'default',
      cluster: '',
      annotations: {},
      labels: {},
    },
    spec: {
      spec: {
        podSelector: { matchLabels: { app: 'test' } },
        ingress: overrides.ingress,
        egress: overrides.egress,
      },
    },
    policyRef: [],
  };
}

describe('createNodes', () => {
  it('creates a single main node when there are no ingress or egress rules', () => {
    const policy = makePolicy();
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('main');
    expect(nodes[0].type).toBe('mainNode');
    expect(edges).toHaveLength(0);
  });

  it('creates source nodes and edges for ingress rules', () => {
    const policy = makePolicy({
      ingress: [
        {
          ports: [{ protocol: 'TCP', port: '80' }],
          from: [
            { podSelector: { matchLabels: { role: 'frontend' } } },
            { namespaceSelector: { matchLabels: { env: 'prod' } } },
          ],
        },
      ],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(3); // 1 main + 2 source
    expect(nodes[1].type).toBe('sourceNode');
    expect(nodes[2].type).toBe('sourceNode');

    expect(edges).toHaveLength(2);
    edges.forEach(edge => {
      expect(edge.target).toBe('main');
      expect(edge.markerEnd).toEqual({ type: MarkerType.Arrow });
    });
  });

  it('creates target nodes and edges for egress rules', () => {
    const policy = makePolicy({
      egress: [
        {
          ports: [{ protocol: 'TCP', port: '443' }],
          to: [{ ipBlock: { cidr: '10.0.0.0/8' } }],
        },
      ],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(2); // 1 main + 1 target
    expect(nodes[1].type).toBe('targetNode');

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('main');
  });

  it('handles both ingress and egress rules together', () => {
    const policy = makePolicy({
      ingress: [{ from: [{ podSelector: { matchLabels: { role: 'frontend' } } }] }],
      egress: [{ to: [{ podSelector: { matchLabels: { role: 'db' } } }] }],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(3); // 1 main + 1 source + 1 target
    expect(edges).toHaveLength(2);
  });

  it('skips ingress rules with no from field', () => {
    const policy = makePolicy({
      ingress: [{ ports: [{ protocol: 'TCP', port: '80' }] }],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(1); // only main
    expect(edges).toHaveLength(0);
  });

  it('skips egress rules with no to field', () => {
    const policy = makePolicy({
      egress: [{ ports: [{ protocol: 'TCP', port: '443' }] }],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(1); // only main
    expect(edges).toHaveLength(0);
  });
});

describe('layoutElements', () => {
  it('assigns positions to all nodes using dagre layout', () => {
    const nodes: Node[] = [
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];

    layoutElements(nodes, edges);

    nodes.forEach(node => {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    });
  });

  it('produces a left-to-right layout where connected nodes have increasing x', () => {
    const nodes: Node[] = [
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    layoutElements(nodes, edges);

    expect(nodes[0].position.x).toBeLessThan(nodes[1].position.x);
  });

  it('handles a single node with no edges', () => {
    const nodes: Node[] = [{ id: 'a', data: {}, position: { x: 0, y: 0 } }];
    const edges: Edge[] = [];

    layoutElements(nodes, edges);

    expect(Number.isFinite(nodes[0].position.x)).toBe(true);
    expect(Number.isFinite(nodes[0].position.y)).toBe(true);
  });

  it('works end-to-end with createNodes output', () => {
    const policy = makePolicy({
      ingress: [{ from: [{ podSelector: { matchLabels: { role: 'frontend' } } }] }],
      egress: [
        {
          to: [
            { podSelector: { matchLabels: { role: 'db' } } },
            { ipBlock: { cidr: '10.0.0.0/8' } },
          ],
        },
      ],
    });

    const { nodes, edges } = createNodes(policy);
    layoutElements(nodes, edges);

    expect(nodes).toHaveLength(4); // 1 main + 1 source + 2 target
    nodes.forEach(node => {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    });
  });
});
