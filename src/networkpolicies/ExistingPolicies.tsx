/*
  The NetworkPolicies that select the workload of a generated policy, and whether they allow
  the traffic Kubescape saw the workload use.
*/
import { Link as HeadlampLink } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CompactTable } from '../common/CompactTable';
import HeadlampTable from '../common/Table';
import { formatLabelSelector } from '../exceptions/apply-security-exceptions';
import {
  GeneratedNetworkPolicy,
  NetworkPolicy,
} from '../softwarecomposition/GeneratedNetworkPolicy';
import {
  Direction,
  ExistingPolicy,
  FlowResult,
  FlowStatus,
  policyDirections,
  ruleKey,
} from './compare';
import { withoutPerPodLabels } from './layout';
import { ComparisonResult, workloadOf } from './policyComparison';
import { compactPorts, portsText } from './ports';

export const flowStatusLabels: Record<FlowStatus, string> = {
  allowed: 'Allowed',
  partly: 'Partly allowed',
  blocked: 'Not allowed',
  unrestricted: 'Not restricted',
};

// the palette colors of the statuses
export const flowStatusColors: Record<FlowStatus, 'success' | 'warning' | 'error' | 'default'> = {
  allowed: 'success',
  partly: 'warning',
  blocked: 'error',
  unrestricted: 'default',
};

export const flowStatusDescriptions: Record<FlowStatus, string> = {
  allowed: 'The current NetworkPolicies allow this traffic',
  partly: 'The current NetworkPolicies allow only part of this traffic',
  blocked: 'The current NetworkPolicies do not allow this traffic',
  unrestricted: 'No NetworkPolicy restricts this direction, so all traffic is allowed',
};

// blocked traffic first
const statusOrder: FlowStatus[] = ['blocked', 'partly', 'allowed', 'unrestricted'];

const directionLabels: Record<Direction, string> = { ingress: 'Ingress', egress: 'Egress' };

function selectorText(selector: NetworkPolicy.LabelSelector) {
  return formatLabelSelector(selector).replaceAll(',', ', ');
}

/** A peer of a policy in words, as the policy in the namespace selects it. */
export function peerText(peer: NetworkPolicy.Peer, namespace: string): string {
  if (peer.ipBlock) {
    const except = peer.ipBlock.except?.length ? ` except ${peer.ipBlock.except.join(', ')}` : '';
    return `${peer.ipBlock.cidr}${except}`;
  }
  const namespaceName = peer.namespaceSelector?.matchLabels?.['kubernetes.io/metadata.name'];
  const namespaces = !peer.namespaceSelector
    ? `namespace ${namespace}`
    : namespaceName && Object.keys(peer.namespaceSelector.matchLabels!).length === 1
    ? `namespace ${namespaceName}`
    : selectorText(peer.namespaceSelector)
    ? `namespaces with ${selectorText(peer.namespaceSelector)}`
    : 'all namespaces';
  const pods =
    peer.podSelector && selectorText(peer.podSelector)
      ? `pods with ${selectorText(peer.podSelector)}`
      : 'all pods';
  return `${pods} in ${namespaces}`;
}

// Whether the labels of the generated policy decided the status, as no pod has them now
function isApproximate(flow: FlowResult) {
  return flow.approximate && flow.status !== 'unrestricted';
}

function StatusChip(props: Readonly<{ flow: FlowResult }>) {
  const { flow } = props;
  const note = isApproximate(flow)
    ? '. No pod has these labels now, so the labels of the generated policy were compared.'
    : '';
  return (
    <Tooltip title={`${flowStatusDescriptions[flow.status]}${note}`}>
      <Chip
        size="small"
        color={flowStatusColors[flow.status]}
        variant={flow.status === 'unrestricted' ? 'outlined' : 'filled'}
        label={`${flowStatusLabels[flow.status]}${isApproximate(flow) ? ' *' : ''}`}
      />
    </Tooltip>
  );
}

function PolicyLink(props: Readonly<{ policy: ExistingPolicy; cluster: string }>) {
  const { policy, cluster } = props;
  return (
    <HeadlampLink
      routeName="networkpolicy"
      params={{ namespace: policy.metadata.namespace, name: policy.metadata.name }}
      activeCluster={cluster || undefined}
    >
      {policy.metadata.name}
    </HeadlampLink>
  );
}

function directionSummary(
  direction: Direction,
  policies: ExistingPolicy[],
  flows: FlowResult[]
): string {
  const observed = flows.filter(flow => flow.direction === direction);
  if (policies.length === 0) {
    return `${directionLabels[direction]} is not restricted: no NetworkPolicy limits it.`;
  }
  const allowed = observed.filter(flow => flow.status === 'allowed').length;
  return `${directionLabels[direction]} is restricted by ${policies
    .map(policy => policy.metadata.name)
    .join(', ')}: ${allowed} of ${observed.length} observed flows are allowed.`;
}

interface RuleRow {
  policy: ExistingPolicy;
  direction: Direction;
  // undefined for a policy that restricts the direction without rules: it denies all
  index?: number;
  peers?: NetworkPolicy.Peer[];
  ports?: NetworkPolicy.Port[];
}

function ruleRows(policies: ExistingPolicy[]): RuleRow[] {
  return policies.flatMap(policy =>
    policyDirections(policy.spec).flatMap((direction): RuleRow[] => {
      const rules =
        direction === 'ingress'
          ? (policy.spec.ingress ?? []).map(rule => ({ peers: rule.from, ports: rule.ports }))
          : (policy.spec.egress ?? []).map(rule => ({ peers: rule.to, ports: rule.ports }));
      if (rules.length === 0) return [{ policy, direction }];
      return rules.map((rule, index) => ({ policy, direction, index, ...rule }));
    })
  );
}

export function ExistingPolicies(
  props: Readonly<{
    generatedNetworkPolicy: GeneratedNetworkPolicy;
    result: ComparisonResult | null;
    cluster: string;
  }>
) {
  const { generatedNetworkPolicy, result, cluster } = props;
  const { namespace, name } = workloadOf(generatedNetworkPolicy);
  const comparison = result?.comparison;
  const rules = useMemo(() => ruleRows(comparison?.selecting ?? []), [comparison]);

  if (!result) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        Reading the NetworkPolicies of namespace {namespace}…
      </Typography>
    );
  }
  if (!comparison) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Unable to read the NetworkPolicies of namespace {namespace}: {result.error}
      </Alert>
    );
  }

  const { flows, selecting, restricting, ruleUse } = comparison;
  const notAllowed = flows.filter(flow => flow.status === 'blocked' || flow.status === 'partly');
  const approximate = flows.some(isApproximate);

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {selecting.length === 0 ? (
        <Alert severity="info">
          No NetworkPolicy selects {name}, so all its traffic is allowed. Creating the generated
          policy would limit it to the traffic below.
        </Alert>
      ) : (
        <Alert severity={notAllowed.length > 0 ? 'warning' : 'success'}>
          <div>{directionSummary('ingress', restricting.ingress, flows)}</div>
          <div>{directionSummary('egress', restricting.egress, flows)}</div>
          {notAllowed.length > 0 && (
            <div>
              Traffic that Kubescape saw but the policies do not allow was blocked, or was seen
              before the policies existed.
            </div>
          )}
        </Alert>
      )}
      {result.approximateWorkload && (
        <Alert severity="info">
          The {name} workload could not be read, so the policies were matched against the pod labels
          of the generated policy.
        </Alert>
      )}

      <Box>
        <Typography variant="h6">Observed traffic</Typography>
        <HeadlampTable
          data={flows}
          sortingKey="networkpolicy-observed-traffic"
          columns={[
            {
              id: 'Direction',
              header: 'Direction',
              accessorFn: (flow: FlowResult) => directionLabels[flow.direction],
              gridTemplate: 'min-content',
            },
            {
              header: 'Peer',
              accessorFn: (flow: FlowResult) => peerText(withoutPerPodLabels(flow.peer), namespace),
              gridTemplate: 'auto',
            },
            {
              header: 'Ports',
              accessorFn: (flow: FlowResult) => portsText(compactPorts(flow.ports)),
              gridTemplate: 'min-content',
            },
            {
              id: 'Status',
              header: 'Current policies',
              accessorFn: (flow: FlowResult) => statusOrder.indexOf(flow.status),
              Cell: ({ row }: any) => <StatusChip flow={row.original} />,
              gridTemplate: 'min-content',
            },
            {
              header: 'Allowed by',
              accessorFn: (flow: FlowResult) => flow.allowedBy.join(', '),
              gridTemplate: 'auto',
            },
          ]}
          initialState={{ sorting: [{ id: 'Status', desc: false }] }}
        />
        {approximate && (
          <Typography variant="caption" color="text.secondary">
            * No pod has the labels of this peer now, so the labels of the generated policy were
            compared.
          </Typography>
        )}
      </Box>

      {selecting.length > 0 && (
        <Box>
          <Typography variant="h6">Policies that select {name}</Typography>
          <CompactTable
            rows={rules}
            rowKey={rule =>
              JSON.stringify([rule.policy.metadata.name, rule.direction, rule.index ?? -1])
            }
            columns={[
              {
                header: 'Policy',
                cell: rule => <PolicyLink policy={rule.policy} cluster={cluster} />,
              },
              { header: 'Direction', cell: rule => directionLabels[rule.direction] },
              {
                header: 'Allows',
                cell: rule =>
                  rule.index === undefined
                    ? `No ${rule.direction} at all`
                    : rule.peers?.length
                    ? rule.peers.map((peer, index) => (
                        <div key={index}>{peerText(peer, rule.policy.metadata.namespace)}</div>
                      ))
                    : `All ${rule.direction === 'ingress' ? 'sources' : 'destinations'}`,
              },
              {
                header: 'Ports',
                cell: rule => (rule.index === undefined ? '' : portsText(rule.ports)),
              },
              {
                header: 'Observed traffic',
                cell: rule => {
                  if (rule.index === undefined) return '';
                  const used =
                    ruleUse.get(ruleKey(rule.policy.metadata.name, rule.direction, rule.index)) ??
                    0;
                  return used > 0 ? (
                    `${used} ${used === 1 ? 'flow' : 'flows'}`
                  ) : (
                    <Tooltip title="Kubescape saw no traffic of the workload that this rule allows; it may be broader than needed">
                      <Chip size="small" variant="outlined" label="None" />
                    </Tooltip>
                  );
                },
              },
            ]}
          />
        </Box>
      )}
    </Stack>
  );
}
