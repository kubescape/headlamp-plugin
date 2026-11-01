/* 
  Create nodes for the networkpolicy diagram. 
*/
import { Box, Tooltip } from '@mui/material';
import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import * as yaml from 'js-yaml';
import { ReactNode } from 'react';
import {
  GeneratedNetworkPolicy,
  NetworkPolicy,
} from '../softwarecomposition/GeneratedNetworkPolicy';
import { K8sNamespace, LogosKubernetes, TablerWorld } from './icons';
import { isClusterRange } from './layout';
import { compactPorts, portsText } from './ports';

const sourceHandle = <Handle type="source" position={Position.Right} id="source" />;
const targetHandle = <Handle type="target" position={Position.Left} id="target" />;

export type ConnectedNode = Node<{
  // the peer as shown, without per-run labels
  peer: NetworkPolicy.Peer;
  // the peers of the policy that the node stands for
  peers: NetworkPolicy.Peer[];
  policy: GeneratedNetworkPolicy;
  ports: NetworkPolicy.Port[];
  // set when the node stands for many IP ranges
  group?: 'ipRanges' | 'pods';
  // for a node of many pods, the labels whose values differ between them
  differingLabels?: string[];
}>;

// MUI tooltips are at most 300px wide, which cut off the lines of label selectors
const tooltipProps = { tooltip: { sx: { fontSize: '0.9em', maxWidth: 'min(90vw, 720px)' } } };

// Preformatted text whose long lines wrap instead of running out of the tooltip
function TooltipText(props: Readonly<{ children: ReactNode }>) {
  return (
    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {props.children}
    </Box>
  );
}

// IP ranges listed on a node of many, and in its tooltip
const rangesOnNode = 3;
const rangesInTooltip = 40;
// Port ranges listed on a node; its tooltip lists all of them
const portRangesOnNode = 4;

function PortsLine(props: Readonly<{ ports: NetworkPolicy.Port[] }>) {
  const ranges = compactPorts(props.ports ?? []);
  const text =
    ranges.length <= portRangesOnNode
      ? portsText(ranges)
      : `${portsText(ranges.slice(0, portRangesOnNode - 1))}, … (${props.ports.length} ports)`;
  return <div className="text">{text}</div>;
}

function PortsTooltipLine(props: Readonly<{ ports: NetworkPolicy.Port[] }>) {
  return <div>Ports: {portsText(compactPorts(props.ports ?? []))}</div>;
}

const MainNode = (props: NodeProps<ConnectedNode>) => {
  const { data } = props;

  const hasIngress =
    data.policy.spec.spec.ingress && Object.entries(data.policy.spec.spec.ingress).length > 0;
  const hasEgress =
    data.policy.spec.spec.egress && Object.entries(data.policy.spec.spec.egress).length > 0;

  return (
    <div className="network-node">
      <div className="title">
        <LogosKubernetes /> {data.policy.metadata.labels['kubescape.io/workload-namespace']}
      </div>
      <div className="text">
        {data.policy.metadata.labels['kubescape.io/workload-kind']}{' '}
        {data.policy.metadata.labels['kubescape.io/workload-name']}
      </div>
      {hasIngress ? targetHandle : ''}
      {hasEgress ? sourceHandle : ''}
    </div>
  );
};

const ConnectedNode = (props: NodeProps<ConnectedNode>) => {
  const { type, data } = props;
  const count = data.peers?.length ?? 1;

  if (data.group === 'ipRanges') {
    return <IpRangesNode {...props} />;
  }

  const differing = data.differingLabels?.join(', ');
  const tooltip =
    count > 1 ? (
      <>
        <div>
          {differing
            ? `${count} pods that differ in ${differing}, with these labels in common:`
            : `${count} peers that only differ in per-pod labels, such as the pods of each CronJob run:`}
        </div>
        <TooltipText>{yaml.dump(data.peer)}</TooltipText>
        <PortsTooltipLine ports={data.ports} />
      </>
    ) : (
      <>
        <TooltipText>{yaml.dump(data.peers?.[0] ?? data.peer)}</TooltipText>
        <PortsTooltipLine ports={data.ports} />
      </>
    );

  return (
    <Tooltip title={tooltip} slotProps={tooltipProps}>
      <Box className="network-node">
        <div className="title">
          {peerIcon(data.peer)} {peerOrigin(data.peer, workloadNamespace(data.policy))}
          {count > 1 && <span className="count"> ×{count}</span>}
        </div>
        <div className="text">{namespaceSelector(data.peer)}</div>
        <div className="text">{podSelector(data.peer)}</div>
        {differing && <div className="text">differ in: {differing}</div>}
        <div className="text">{dnsSelector(data.policy, data.peer)}</div>
        <div className="text">{ipSelector(data.peer)}</div>
        <PortsLine ports={data.ports} />
        {type === 'sourceNode' ? sourceHandle : targetHandle}
      </Box>
    </Tooltip>
  );
};

function rangeText(policy: GeneratedNetworkPolicy, peer: NetworkPolicy.Peer) {
  const dns = dnsSelector(policy, peer);
  return dns ? `${peer.ipBlock?.cidr} (${dns})` : peer.ipBlock?.cidr ?? '';
}

// A node for the many IP ranges of one direction and ports, such as the clients of an
// ingress controller; one node each would make a diagram of thousands of nodes
const IpRangesNode = (props: NodeProps<ConnectedNode>) => {
  const { type, data } = props;
  const count = data.peers.length;
  const tooltip = (
    <>
      <div>{count} IP ranges:</div>
      <TooltipText>
        {data.peers
          .slice(0, rangesInTooltip)
          .map(peer => rangeText(data.policy, peer))
          .join('\n')}
      </TooltipText>
      {count > rangesInTooltip && (
        <div>and {count - rangesInTooltip} more; the NetworkPolicy tab lists all of them.</div>
      )}
      <PortsTooltipLine ports={data.ports} />
    </>
  );

  return (
    <Tooltip title={tooltip} slotProps={tooltipProps}>
      <Box className="network-node">
        <div className="title">
          {peerIcon(data.peer)} {peerOrigin(data.peer, workloadNamespace(data.policy))}
          <span className="count"> ×{count}</span>
        </div>
        <div className="text">{count} IP ranges</div>
        {data.peers.slice(0, rangesOnNode).map((peer, index) => (
          <div className="text" key={index}>
            {rangeText(data.policy, peer)}
          </div>
        ))}
        {count > rangesOnNode && <div className="text">…</div>}
        <PortsLine ports={data.ports} />
        {type === 'sourceNode' ? sourceHandle : targetHandle}
      </Box>
    </Tooltip>
  );
};

export const nodeTypes = {
  sourceNode: ConnectedNode,
  targetNode: ConnectedNode,
  mainNode: MainNode,
};

function podSelector(peer: NetworkPolicy.Peer): string {
  let text = '';
  if (peer.podSelector?.matchLabels && Object.keys(peer.podSelector.matchLabels).length > 0) {
    const labels = peer.podSelector.matchLabels;
    text += 'pod: ' + labelsToString(labels);
  }
  if (peer.podSelector?.matchExpressions) {
    const expressions = peer.podSelector.matchExpressions;
    text += ' with expressions ' + expressionsToString(expressions);
  }

  return text;
}

function namespaceSelector(peer: NetworkPolicy.Peer): string {
  let text = '';
  if (peer.namespaceSelector?.matchLabels) {
    const labels = peer.namespaceSelector.matchLabels;
    if (!isSingleNamespaceSelector(labels)) {
      text += 'namespace: ' + labelsToString(labels);
    }
  }
  if (peer.namespaceSelector?.matchExpressions) {
    const expressions = peer.namespaceSelector.matchExpressions;
    text += ' with expressions ' + expressionsToString(expressions);
  }
  return text;
}

function ipSelector(peer: NetworkPolicy.Peer): string {
  return peer.ipBlock ? peer.ipBlock.cidr : '';
}

// The DNS names of the IP ranges of each policy, looked up once instead of for every range
const dnsByPolicy = new WeakMap<GeneratedNetworkPolicy, Map<string, string>>();

function dnsSelector(policy: GeneratedNetworkPolicy, peer: NetworkPolicy.Peer): string {
  if (!peer.ipBlock) return '';
  let dnsByRange = dnsByPolicy.get(policy);
  if (!dnsByRange) {
    dnsByRange = new Map();
    for (const ref of policy.policyRef ?? []) {
      if (ref.ipBlock && !dnsByRange.has(ref.ipBlock)) dnsByRange.set(ref.ipBlock, ref.dns);
    }
    dnsByPolicy.set(policy, dnsByRange);
  }
  return dnsByRange.get(peer.ipBlock.cidr) ?? '';
}

function isSingleNamespaceSelector(labels: NetworkPolicy.LabelSelector): boolean {
  return (
    Object.keys(labels).length === 1 && Object.keys(labels)[0] === 'kubernetes.io/metadata.name'
  );
}

function labelsToString(labels: { [key: string]: string }): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v.length > 0 ? v : '""'}`)
    .join(', ');
}

function expressionsToString(expressions: NetworkPolicy.LabelSelectorRequirement[]): string {
  return expressions.map(e => `${e.key}${e.operator}${e.values}`).join(', ');
}

function workloadNamespace(policy: GeneratedNetworkPolicy): string {
  return policy.metadata.labels?.['kubescape.io/workload-namespace'] ?? policy.metadata.namespace;
}

/** Where a peer is: its namespace, the internet, or elsewhere in the cluster. */
export function peerOrigin(peer: NetworkPolicy.Peer, namespace: string): string {
  if (peer.namespaceSelector?.matchLabels) {
    const labels = peer.namespaceSelector.matchLabels;
    if (
      Object.keys(labels).length === 1 &&
      Object.keys(labels)[0] === 'kubernetes.io/metadata.name'
    ) {
      return Object.values(labels)[0];
    }
  }
  if (peer.ipBlock?.cidr && !isClusterRange(peer.ipBlock.cidr)) {
    return 'Internet';
  }
  // pods without a namespace selector are those of the policy's namespace
  if (!peer.ipBlock && !peer.namespaceSelector) {
    return namespace;
  }

  return 'k8s cluster';
}

function peerIcon(peer: NetworkPolicy.Peer): JSX.Element {
  if (peer.namespaceSelector || !peer.ipBlock) {
    return <K8sNamespace />;
  }
  if (!isClusterRange(peer.ipBlock.cidr)) {
    return <TablerWorld />;
  }
  return <LogosKubernetes />;
}
