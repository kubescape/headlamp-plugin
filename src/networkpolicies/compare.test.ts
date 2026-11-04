import { describe, expect, it } from 'vitest';
import { NetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import {
  cidrContains,
  comparePolicies,
  ExistingPolicy,
  ObservedFlow,
  peerSelects,
  policyDirections,
  portAllows,
  selectorMatches,
} from './compare';

const In = NetworkPolicy.LabelSelectorOperator.In;
const NotIn = NetworkPolicy.LabelSelectorOperator.NotIn;
const Exists = NetworkPolicy.LabelSelectorOperator.Exists;
const DoesNotExist = NetworkPolicy.LabelSelectorOperator.DoesNotExist;

describe('selectorMatches', () => {
  const labels = { app: 'db', role: 'primary' };
  it('matches labels and expressions', () => {
    expect(selectorMatches({}, labels)).toBe(true);
    expect(selectorMatches({ matchLabels: { app: 'db' } }, labels)).toBe(true);
    expect(selectorMatches({ matchLabels: { app: 'web' } }, labels)).toBe(false);
    expect(
      selectorMatches(
        { matchExpressions: [{ key: 'role', operator: In, values: ['primary'] }] },
        labels
      )
    ).toBe(true);
    expect(
      selectorMatches(
        { matchExpressions: [{ key: 'role', operator: NotIn, values: ['primary'] }] },
        labels
      )
    ).toBe(false);
    expect(
      selectorMatches(
        { matchExpressions: [{ key: 'zone', operator: NotIn, values: ['a'] }] },
        labels
      )
    ).toBe(true);
    expect(selectorMatches({ matchExpressions: [{ key: 'app', operator: Exists }] }, labels)).toBe(
      true
    );
    expect(
      selectorMatches({ matchExpressions: [{ key: 'app', operator: DoesNotExist }] }, labels)
    ).toBe(false);
  });
});

describe('cidrContains', () => {
  it('compares IPv4 ranges', () => {
    expect(cidrContains('203.0.113.0/24', '203.0.113.20/32')).toBe(true);
    expect(cidrContains('203.0.113.0/24', '203.0.114.1/32')).toBe(false);
    expect(cidrContains('0.0.0.0/0', '10.0.0.1/32')).toBe(true);
    expect(cidrContains('10.0.0.0/24', '10.0.0.0/16')).toBe(false);
    expect(cidrContains('10.0.0.1', '10.0.0.1/32')).toBe(true);
  });

  it('only matches IPv6 ranges with themselves or ::/0', () => {
    expect(cidrContains('2001:db8::/32', '2001:db8::/32')).toBe(true);
    expect(cidrContains('::/0', '2001:db8::1/128')).toBe(true);
    expect(cidrContains('2001:db8::/32', '2001:db8::1/128')).toBe(false);
  });
});

describe('portAllows', () => {
  it('matches protocols, ports, ranges and named ports', () => {
    const tcp5432 = { protocol: 'TCP', port: 5432 as unknown as string };
    expect(portAllows({ port: 5432 as unknown as string }, tcp5432)).toBe(true);
    expect(portAllows({ protocol: 'UDP', port: '5432' }, tcp5432)).toBe(false);
    expect(portAllows({ protocol: 'TCP' }, tcp5432)).toBe(true);
    expect(portAllows({ port: '5000', endPort: 6000 }, tcp5432)).toBe(true);
    expect(portAllows({ port: '5000', endPort: 5400 }, tcp5432)).toBe(false);
    expect(portAllows({ port: 'postgresql' }, tcp5432, { postgresql: 5432 })).toBe(true);
    expect(portAllows({ port: 'postgresql' }, tcp5432)).toBe(false);
    // a generated rule without ports needs a rule without ports
    expect(portAllows({ port: '5432' }, undefined)).toBe(false);
  });
});

describe('peerSelects', () => {
  const pod = {
    namespace: 'shop',
    namespaceLabels: { 'kubernetes.io/metadata.name': 'shop', purpose: 'monitoring' },
    podLabels: { app: 'prometheus' },
  };
  it('selects pods of the namespace of the policy, or of selected namespaces', () => {
    expect(peerSelects({ podSelector: {} }, pod, 'shop')).toBe(true);
    expect(peerSelects({ podSelector: {} }, pod, 'other')).toBe(false);
    expect(
      peerSelects({ namespaceSelector: { matchLabels: { purpose: 'monitoring' } } }, pod, 'other')
    ).toBe(true);
    expect(
      peerSelects(
        { namespaceSelector: {}, podSelector: { matchLabels: { app: 'grafana' } } },
        pod,
        'other'
      )
    ).toBe(false);
  });

  it('matches IP blocks against IP ranges only', () => {
    expect(peerSelects({ ipBlock: { cidr: '0.0.0.0/0' } }, pod, 'shop')).toBe(false);
    expect(peerSelects({ ipBlock: { cidr: '10.0.0.0/8' } }, { cidr: '10.1.2.3/32' }, 'shop')).toBe(
      true
    );
    expect(
      peerSelects(
        { ipBlock: { cidr: '10.0.0.0/8', except: ['10.1.0.0/16'] } },
        { cidr: '10.1.2.3/32' },
        'shop'
      )
    ).toBe(false);
    expect(peerSelects({ podSelector: {} }, { cidr: '10.1.2.3/32' }, 'shop')).toBe(false);
  });

  it('selects all pods of a namespace only with an empty pod selector', () => {
    const anyPod = { namespace: 'shop', namespaceLabels: {} };
    expect(peerSelects({ podSelector: {} }, anyPod, 'shop')).toBe(true);
    expect(peerSelects({ podSelector: { matchLabels: { app: 'x' } } }, anyPod, 'shop')).toBe(false);
  });
});

describe('policyDirections', () => {
  it('defaults to Ingress, and Egress when the policy has egress rules', () => {
    expect(policyDirections({ podSelector: {} })).toEqual(['ingress']);
    expect(policyDirections({ podSelector: {}, egress: [] })).toEqual(['ingress', 'egress']);
    expect(policyDirections({ podSelector: {}, policyTypes: ['Egress'] })).toEqual(['egress']);
  });
});

// The policies of a namespace with a database, after a real cluster
const policies: ExistingPolicy[] = [
  {
    metadata: { name: 'default-ingress', namespace: 'shop' },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [
        { from: [{ podSelector: {} }] },
        { from: [{ namespaceSelector: { matchLabels: { purpose: 'monitoring' } } }] },
      ],
    },
  },
  {
    metadata: { name: 'db-allow-operator', namespace: 'shop' },
    spec: {
      podSelector: { matchLabels: { 'cnpg.io/cluster': 'db' } },
      policyTypes: ['Ingress'],
      ingress: [
        {
          from: [
            {
              namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'cnpg-system' } },
            },
          ],
          ports: [{ protocol: 'TCP', port: 8000 as unknown as string }],
        },
        {
          from: [{ ipBlock: { cidr: '203.0.113.0/24' } }],
        },
      ],
    },
  },
  {
    metadata: { name: 'web-only', namespace: 'shop' },
    spec: { podSelector: { matchLabels: { app: 'web' } }, policyTypes: ['Ingress', 'Egress'] },
  },
];

const namespaceOf = (name: string, labels: Record<string, string> = {}) => ({
  namespace: name,
  namespaceLabels: { 'kubernetes.io/metadata.name': name, ...labels },
});

const flow = (
  direction: 'ingress' | 'egress',
  endpoints: ObservedFlow['endpoints'],
  port?: number
): ObservedFlow => ({
  direction,
  peer: {},
  ports: port ? [{ protocol: 'TCP', port: port as unknown as string }] : [],
  endpoints,
});

describe('comparePolicies', () => {
  const workload = { namespace: 'shop', podLabels: { 'cnpg.io/cluster': 'db' } };
  const flows = [
    flow('ingress', [{ ...namespaceOf('shop'), podLabels: { app: 'api' } }], 5432),
    flow('ingress', [{ ...namespaceOf('cnpg-system'), podLabels: { app: 'cnpg' } }], 8000),
    flow(
      'ingress',
      [{ ...namespaceOf('monitoring', { purpose: 'monitoring' }), podLabels: {} }],
      9187
    ),
    flow('ingress', [{ ...namespaceOf('other'), podLabels: { job: 'x' } }], 5432),
    flow(
      'ingress',
      [
        { ...namespaceOf('shop'), podLabels: { app: 'a' } },
        { ...namespaceOf('other'), podLabels: { app: 'b' } },
      ],
      5432
    ),
    flow('ingress', [{ cidr: '203.0.113.20/32' }], 8080),
    flow('egress', [{ ...namespaceOf('kube-system'), podLabels: { 'k8s-app': 'kube-dns' } }], 53),
  ];

  it('finds the policies that select the workload, per direction', () => {
    const result = comparePolicies(policies, workload, flows);
    expect(result.selecting.map(p => p.metadata.name)).toEqual([
      'default-ingress',
      'db-allow-operator',
    ]);
    expect(result.restricting.egress).toEqual([]);
  });

  it('tells which observed traffic the policies allow, and with which rules', () => {
    const result = comparePolicies(policies, workload, flows);
    expect(result.flows.map(f => [f.status, f.allowedBy])).toEqual([
      ['allowed', ['default-ingress']],
      ['allowed', ['db-allow-operator']],
      ['allowed', ['default-ingress']],
      ['blocked', []],
      ['partly', ['default-ingress']],
      ['allowed', ['db-allow-operator']],
      ['unrestricted', []],
    ]);
    expect(Object.fromEntries(result.ruleUse)).toEqual({
      '["default-ingress","ingress",0]': 2,
      '["default-ingress","ingress",1]': 1,
      '["db-allow-operator","ingress",0]': 1,
      '["db-allow-operator","ingress",1]': 1,
    });
  });

  it('denies all traffic of a direction that a policy without rules restricts', () => {
    const result = comparePolicies(
      policies,
      { namespace: 'shop', podLabels: { app: 'web' } },
      flows
    );
    expect(result.restricting.egress.map(p => p.metadata.name)).toEqual(['web-only']);
    expect(result.flows[6].status).toBe('blocked');
    // its ingress is still allowed by the rules of the other policies
    expect(result.flows[0]).toMatchObject({ status: 'allowed', allowedBy: ['default-ingress'] });
  });

  it('leaves the traffic unrestricted without policies that select the workload', () => {
    const result = comparePolicies(policies, { namespace: 'other', podLabels: {} }, flows);
    expect(result.selecting).toEqual([]);
    expect(new Set(result.flows.map(f => f.status))).toEqual(new Set(['unrestricted']));
  });
});
