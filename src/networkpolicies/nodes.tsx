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
import { compactPorts, portsText } from './ports';

const sourceHandle = <Handle type="source" position={Position.Right} id="source" />;
const targetHandle = <Handle type="target" position={Position.Left} id="target" />;

export type ConnectedNode = Node<{
  peer: NetworkPolicy.Peer;
  policy: GeneratedNetworkPolicy;
  ports: NetworkPolicy.Port[];
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

  const tooltip = (
    <>
      <TooltipText>{yaml.dump(data.peer)}</TooltipText>
      <PortsTooltipLine ports={data.ports} />
    </>
  );

  return (
    <Tooltip title={tooltip} slotProps={tooltipProps}>
      <Box className="network-node">
        <div className="title">
          {peerIcon(data.peer)} {peerOrigin(data.peer)}
        </div>
        <div className="text">{namespaceSelector(data.peer)}</div>
        <div className="text">{podSelector(data.peer)}</div>
        <div className="text">{dnsSelector(data.policy, data.peer)}</div>
        <div className="text">{ipSelector(data.peer)}</div>
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
  if (peer.podSelector?.matchLabels) {
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

function dnsSelector(policy: GeneratedNetworkPolicy, peer: NetworkPolicy.Peer): string {
  if (peer.ipBlock) {
    const ref = policy.policyRef?.find(ref => ref.ipBlock === peer.ipBlock?.cidr);
    if (ref) {
      return ref.dns;
    }
  }
  return '';
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

function peerOrigin(peer: NetworkPolicy.Peer): string {
  if (peer.namespaceSelector?.matchLabels) {
    const labels = peer.namespaceSelector.matchLabels;
    if (
      Object.keys(labels).length === 1 &&
      Object.keys(labels)[0] === 'kubernetes.io/metadata.name'
    ) {
      return Object.values(labels)[0];
    }
  }
  if (
    peer.ipBlock?.cidr &&
    !peer.ipBlock.cidr.startsWith('10.') &&
    !peer.ipBlock.cidr.startsWith('172.')
  ) {
    return 'Internet';
  }

  return 'k8s cluster';
}

function peerIcon(peer: NetworkPolicy.Peer): JSX.Element {
  if (peer.namespaceSelector) {
    return <K8sNamespace />;
  }
  if (peerOrigin(peer) === 'Internet') {
    return <TablerWorld />;
  }
  return <LogosKubernetes />;
}
