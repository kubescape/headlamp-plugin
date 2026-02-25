/* 
  Show diagram with generated network policies. 
*/
import '@xyflow/react/dist/style.css';
import './style.css';
import { SectionBox, Tabs as HeadlampTabs } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import Editor from '@monaco-editor/react';
import { Box } from '@mui/material';
import { ReactFlow, ReactFlowInstance } from '@xyflow/react';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { getURLSegments } from '../common/url';
import { generatedNetworkPolicyClass } from '../model';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { createNodes, layoutElements } from './layout';
import { nodeTypes } from './nodes';

export default function KubescapeNetworkPolicyDiagram() {
  const [networkPolicyObject, setNetworkPolicyObject] = useState<KubeObject | null>(null);
  const [policyName, policyNamespace] = getURLSegments(-1, -2);

  generatedNetworkPolicyClass.useApiGet(setNetworkPolicyObject, policyName, policyNamespace);

  if (!networkPolicyObject) {
    return <></>;
  }
  return (
    <SectionBox title="Generated Network Policy" backLink>
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
