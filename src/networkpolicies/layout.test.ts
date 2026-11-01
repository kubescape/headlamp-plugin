import { Edge, MarkerType, Node } from '@xyflow/react';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { createNodes, layoutElements, policyPeers } from './layout';

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

  it('shows a peer once per direction, with the ports of all its rules', () => {
    const backup = { podSelector: { matchLabels: { app: 'backup' } } };
    const web = { podSelector: { matchLabels: { app: 'web' } } };
    const policy = makePolicy({
      ingress: [
        { ports: [{ protocol: 'TCP', port: '9090' }], from: [backup] },
        { ports: [{ protocol: 'TCP', port: '8080' }], from: [web, backup] },
      ],
      egress: [{ ports: [{ protocol: 'TCP', port: '8080' }], to: [backup] }],
    });
    const { nodes } = createNodes(policy);

    expect(nodes.map(node => node.type)).toEqual([
      'mainNode',
      'sourceNode',
      'sourceNode',
      'targetNode',
    ]);
    expect(nodes[1].data.peer).toEqual(backup);
    expect(nodes[1].data.ports).toEqual([
      { protocol: 'TCP', port: '8080' },
      { protocol: 'TCP', port: '9090' },
    ]);
  });

  it('gives a peer of a rule without ports all ports', () => {
    const web = { podSelector: { matchLabels: { app: 'web' } } };
    const { nodes } = createNodes(
      makePolicy({
        ingress: [{ ports: [{ protocol: 'TCP', port: '80' }], from: [web] }, { from: [web] }],
      })
    );
    expect(nodes[1].data.ports).toEqual([]);
  });
});

describe('policyPeers', () => {
  it('gives each peer of a direction the ports of all its rules', () => {
    const api = { podSelector: { matchLabels: { app: 'api' } } };
    expect(
      policyPeers(
        makePolicy({
          ingress: [
            { ports: [{ protocol: 'UDP', port: '53' }], from: [api] },
            { ports: [{ protocol: 'TCP', port: 443 as unknown as string }], from: [api] },
            { ports: [{ protocol: 'TCP', port: '443' }], from: [api] },
          ],
          egress: [{ ports: [{ protocol: 'TCP', port: '80' }], to: [api] }],
        })
      )
    ).toEqual([
      {
        direction: 'ingress',
        peer: api,
        ports: [
          { protocol: 'TCP', port: 443 },
          { protocol: 'UDP', port: '53' },
        ],
      },
      { direction: 'egress', peer: api, ports: [{ protocol: 'TCP', port: '80' }] },
    ]);
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

  it('lays out rendered nodes by their measured size without overlap', () => {
    const node = (id: string, height: number): Node => ({
      id,
      data: {},
      position: { x: 0, y: 0 },
      measured: { width: 310, height },
    });
    // Sources with long pod selectors are much taller than the other nodes
    const nodes = [
      node('main', 50),
      node('tall-1', 200),
      node('tall-2', 200),
      node('short', 50),
      node('target', 50),
    ];
    const edges: Edge[] = [
      { id: '0', source: 'tall-1', target: 'main' },
      { id: '1', source: 'tall-2', target: 'main' },
      { id: '2', source: 'short', target: 'main' },
      { id: '3', source: 'main', target: 'target' },
    ];

    layoutElements(nodes, edges);

    const box = (n: Node) => ({
      left: n.position.x,
      right: n.position.x + n.measured!.width!,
      top: n.position.y,
      bottom: n.position.y + n.measured!.height!,
    });
    for (const [i, a] of nodes.entries()) {
      for (const b of nodes.slice(i + 1)) {
        const [boxA, boxB] = [box(a), box(b)];
        const separate =
          boxA.right <= boxB.left ||
          boxB.right <= boxA.left ||
          boxA.bottom <= boxB.top ||
          boxB.bottom <= boxA.top;
        expect(separate, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
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

describe('layoutElements with edges to missing nodes', () => {
  it('lays out nodes with valid positions when an edge refers to a missing node', () => {
    const nodes: Node[] = [
      { id: 'main', position: { x: 0, y: 0 }, data: {} },
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'a', source: '1', target: 'main' },
      { id: 'b', source: 'main', target: '7' },
    ];

    layoutElements(nodes, edges);

    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    expect(nodes[0].position.x).toBeGreaterThan(nodes[1].position.x);
  });
});
