/* 
  Show diagram with generated network policies. 
*/
import '@xyflow/react/dist/style.css';
import './style.css';
import dagre from '@dagrejs/dagre';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import { SectionBox, Tabs as HeadlampTabs } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import Editor from '@monaco-editor/react';
import { Box } from '@mui/material';
import { Edge, MarkerType, Node, ReactFlow, ReactFlowInstance } from '@xyflow/react';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { generatedNetworkPolicyClass } from '../model';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { nodeTypes } from './nodes';

const { createRouteURL } = Router;

export default function KubescapeNetworkPolicyDiagram() {
  const [networkPolicyObject, setNetworkPolicyObject] = useState<KubeObject | null>(null);
  const [policyName, policyNamespace] = getURLSegments(-1, -2);

  generatedNetworkPolicyClass.useApiGet(setNetworkPolicyObject, policyName, policyNamespace);

  if (!networkPolicyObject) {
    return <></>;
  }
  return (
    <SectionBox
      title="Generated Network Policy"
      backLink={createRouteURL(RoutingName.KubescapeNetworkPolicies)}
    >
      <HeadlampTabs
        tabs={[
          {
            label: 'Diagram',
            component: (
              <NetworkPolicyDiagram generatedNetworkPolicy={networkPolicyObject.jsonData} />
            ),
          },
          {
            label: 'NetworkPolicy',
            component: <NetworkPolicyEditor yaml={yaml.dump(networkPolicyObject.jsonData.spec)} />,
          },
          {
            label: 'IP Lookup',
            component: (
              <NetworkPolicyEditor yaml={yaml.dump(networkPolicyObject.jsonData.policyRef)} />
            ),
          },
        ]}
        ariaLabel="Navigation Tabs"
      />
    </SectionBox>
  );
}

function NetworkPolicyEditor(props: Readonly<{ yaml: string }>) {
  const { yaml } = props;

  return (
    <Box paddingTop={2} height="100%">
      <Editor
        language={'yaml'}
        theme={localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : ''}
        value={yaml}
        height={window.innerHeight * 0.8}
      />
    </Box>
  );
}

function NetworkPolicyDiagram(props: Readonly<{ generatedNetworkPolicy: GeneratedNetworkPolicy }>) {
  const { generatedNetworkPolicy } = props;
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { nodes, edges } = createNodes(generatedNetworkPolicy);

  layoutElements(nodes, edges);

  if (reactFlowInstance) {
    setTimeout(reactFlowInstance.fitView);
  }

  return (
    <SectionBox>
      <Box style={{ height: dimensions.height * 0.8, width: dimensions.width * 0.8 }}>
        <ReactFlow
          onInit={(instance: any) => setReactFlowInstance(instance)}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={localStorage.headlampThemePreference}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        ></ReactFlow>
      </Box>
    </SectionBox>
  );
}

function layoutElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR' });

  const nodeWidth = 360;
  const nodeHeight = 70;

  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y,
    };
  });
}

function createNodes(networkPolicy: GeneratedNetworkPolicy): { nodes: Node[]; edges: Edge[] } {
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
