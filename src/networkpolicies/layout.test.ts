import { Edge, MarkerType, Node } from '@xyflow/react';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { createNodes, isClusterRange, layoutElements, policyPeers } from './layout';
import { compactPorts, portsText } from './ports';

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

  const cronJobRun = (run: number) => ({
    podSelector: {
      matchLabels: {
        app: 'backup',
        'batch.kubernetes.io/controller-uid': `uid-${run}`,
        'batch.kubernetes.io/job-name': `backup-${run}`,
        'controller-uid': `uid-${run}`,
        'job-name': `backup-${run}`,
      },
    },
  });

  it('shows the peers of all CronJob runs as one node without per-run labels', () => {
    const policy = makePolicy({
      ingress: [
        {
          ports: [{ protocol: 'TCP', port: '8080' }],
          from: [
            cronJobRun(1),
            cronJobRun(2),
            cronJobRun(3),
            { podSelector: { matchLabels: { app: 'web' } } },
          ],
        },
      ],
    });
    const { nodes, edges } = createNodes(policy);

    expect(nodes).toHaveLength(3); // main, the backup runs, web
    expect(nodes[1].data.peer).toEqual({ podSelector: { matchLabels: { app: 'backup' } } });
    expect(nodes[1].data.peers).toEqual([cronJobRun(1), cronJobRun(2), cronJobRun(3)]);
    expect(nodes[2].data.peers).toHaveLength(1);
    expect(edges.map(edge => [edge.source, edge.target])).toEqual([
      ['1', 'main'],
      ['2', 'main'],
    ]);
  });

  it('shows a peer once per direction, with the ports of all its rules', () => {
    const policy = makePolicy({
      ingress: [
        { ports: [{ protocol: 'TCP', port: '9090' }], from: [cronJobRun(1)] },
        { ports: [{ protocol: 'TCP', port: '8080' }], from: [cronJobRun(2), cronJobRun(1)] },
      ],
      egress: [{ ports: [{ protocol: 'TCP', port: '8080' }], to: [cronJobRun(3)] }],
    });
    const { nodes } = createNodes(policy);

    expect(nodes.map(node => node.type)).toEqual(['mainNode', 'sourceNode', 'targetNode']);
    expect(nodes[1].data.peers).toEqual([cronJobRun(1), cronJobRun(2)]);
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
        peers: [api],
        ports: [
          { protocol: 'TCP', port: 443 },
          { protocol: 'UDP', port: '53' },
        ],
      },
      { direction: 'egress', peer: api, peers: [api], ports: [{ protocol: 'TCP', port: '80' }] },
    ]);
  });
});

describe('isClusterRange', () => {
  it('takes private ranges for the cluster', () => {
    expect(isClusterRange('10.4.0.0/14')).toBe(true);
    expect(isClusterRange('172.16.0.1/32')).toBe(true);
    expect(isClusterRange('172.31.255.0/24')).toBe(true);
    expect(isClusterRange('192.168.1.0/24')).toBe(true);
    expect(isClusterRange('100.64.0.0/10')).toBe(true);
    expect(isClusterRange('fd00::/8')).toBe(true);
  });

  it('takes public ranges for the internet', () => {
    expect(isClusterRange('172.32.0.0/24')).toBe(false);
    expect(isClusterRange('172.15.0.0/16')).toBe(false);
    expect(isClusterRange('100.63.255.0/24')).toBe(false);
    expect(isClusterRange('203.0.113.0/24')).toBe(false);
    expect(isClusterRange('2001:db8::/32')).toBe(false);
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

describe('large policies', () => {
  const ports = [{ protocol: 'TCP', port: '443' }];
  const ranges = (count: number, prefix = '1.2.3') =>
    Array.from({ length: count }, (_, index) => ({ ipBlock: { cidr: `${prefix}.${index}/32` } }));

  it('shows many IP ranges of one direction and ports as one node', () => {
    const { nodes, edges } = createNodes(makePolicy({ ingress: [{ ports, from: ranges(6) }] }));

    expect(nodes).toHaveLength(2);
    expect(nodes[1].data.group).toBe('ipRanges');
    expect(nodes[1].data.peers).toHaveLength(6);
    expect(edges).toHaveLength(1);
  });

  it('keeps a few IP ranges, and internet and cluster ranges, apart', () => {
    const { nodes } = createNodes(
      makePolicy({
        ingress: [{ ports, from: ranges(5) }],
        egress: [{ ports, to: [...ranges(6), ...ranges(6, '10.0.0')] }],
      })
    );

    // 5 separate ingress ranges, one node of internet and one of cluster egress ranges
    expect(nodes.filter(node => node.type === 'sourceNode')).toHaveLength(5);
    expect(nodes.filter(node => node.type === 'targetNode').map(n => n.data.peers)).toEqual([
      ranges(6),
      ranges(6, '10.0.0'),
    ]);
  });

  it('shows many pods that differ in label values as one node with their common labels', () => {
    const pods = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        podSelector: { matchLabels: { app: `session-${index}`, component: 'interpreter' } },
      }));

    const many = createNodes(makePolicy({ egress: [{ ports, to: pods(11) }] }));
    expect(many.nodes).toHaveLength(2);
    expect(many.nodes[1].data).toMatchObject({
      group: 'pods',
      differingLabels: ['app'],
      peer: { podSelector: { matchLabels: { component: 'interpreter' } } },
    });

    expect(createNodes(makePolicy({ egress: [{ ports, to: pods(10) }] })).nodes).toHaveLength(11);
  });

  it('shows the IP ranges of the rules per port of an FTP server as one node per set of ports', () => {
    const passivePorts = Array.from({ length: 101 }, (_, index) => ({
      protocol: 'TCP',
      port: String(50000 + index),
    }));
    const clients = ranges(8);
    const { nodes, edges } = createNodes(
      makePolicy({
        ingress: [
          // a rule per port, as Kubescape generates them
          ...passivePorts.map(port => ({ ports: [port], from: clients })),
          { ports: [{ protocol: 'TCP', port: '21' }], from: clients },
          { ports: [{ protocol: 'TCP', port: '21' }], from: ranges(6, '5.6.7') },
        ],
      })
    );

    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(nodes[1].data).toMatchObject({ group: 'ipRanges', peers: clients });
    expect(portsText(compactPorts(nodes[1].data.ports as typeof passivePorts))).toBe(
      'TCP:21, TCP:50000-50100'
    );
    expect(nodes[2].data).toMatchObject({ group: 'ipRanges', peers: ranges(6, '5.6.7') });
  });

  it('shows the pods of a workload in all zones as one node', () => {
    const inZone = (zone: string) => ({
      podSelector: { matchLabels: { app: 'web', 'topology.kubernetes.io/zone': zone } },
    });
    const { nodes } = createNodes(
      makePolicy({ ingress: [{ ports, from: [inZone('a'), inZone('b'), inZone('c')] }] })
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[1].data.peers).toHaveLength(3);
  });

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
