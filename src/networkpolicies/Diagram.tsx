/* 
  Show diagram with generated network policies. 
*/
import '@xyflow/react/dist/style.css';
import './style.css';
import { Icon } from '@iconify/react';
import { SectionBox, Tabs as HeadlampTabs } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import Editor from '@monaco-editor/react';
import { Alert, Box, Stack, Typography, useTheme } from '@mui/material';
import {
  ControlButton,
  Controls,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import * as yaml from 'js-yaml';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useEditorTheme } from '../common/theme';
import { getURLSegments } from '../common/url';
import { fetchObject, generatedNetworkPolicyClass } from '../model';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { ExistingPolicies, flowStatusColors, flowStatusLabels } from './ExistingPolicies';
import { createNodes, layoutElements } from './layout';
import { FlowStatusContext, nodeFlowStatuses, nodeTypes } from './nodes';
import { ComparisonResult, usePolicyComparison, workloadOf } from './policyComparison';

/**
 * Reads a generated network policy once: the storage generates it from the runtime profiles,
 * which change all the time, so a watch would replace the policy, and lay out the diagram
 * again, over and over.
 */
function useGeneratedPolicy(name: string, namespace: string, cluster: string) {
  const [policy, setPolicy] = useState<GeneratedNetworkPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPolicy(null);
    setError(null);
    fetchObject(name, namespace, cluster, generatedNetworkPolicyClass)
      .then(found => {
        if (active) setPolicy(found);
      })
      .catch(err => {
        if (active) setError(err?.message ?? String(err));
      });
    return () => {
      active = false;
    };
  }, [name, namespace, cluster]);

  return { policy, error };
}

export default function KubescapeNetworkPolicyDiagram() {
  const [policyName, policyNamespace] = getURLSegments(-1, -2);
  const cluster = getCluster() ?? '';
  const { policy, error } = useGeneratedPolicy(policyName, policyNamespace, cluster);

  if (error) {
    return (
      <SectionBox title="Generated Network Policy" backLink>
        <Alert severity="error">Unable to read the generated network policy: {error}</Alert>
      </SectionBox>
    );
  }
  if (!policy) {
    return (
      <SectionBox title="Generated Network Policy" backLink>
        <Typography color="text.secondary">Reading the generated network policy…</Typography>
      </SectionBox>
    );
  }
  return <GeneratedPolicyTabs policy={policy} cluster={cluster} />;
}

function GeneratedPolicyTabs(props: Readonly<{ policy: GeneratedNetworkPolicy; cluster: string }>) {
  const { policy, cluster } = props;
  // read once for the diagram and the tab of the current policies
  const comparison = usePolicyComparison(policy, cluster);
  // the workload, as the Name column of the list shows it
  const workload = workloadOf(policy).name || policy.metadata.name;

  return (
    <SectionBox title={`Generated Network Policy - ${workload}`} backLink>
      <HeadlampTabs
        tabs={[
          {
            label: 'Diagram',
            component: (
              <NetworkPolicyDiagram generatedNetworkPolicy={policy} comparison={comparison} />
            ),
          },
          {
            label: 'Current policies',
            component: (
              <ExistingPolicies
                generatedNetworkPolicy={policy}
                result={comparison}
                cluster={cluster}
              />
            ),
          },
          {
            label: 'NetworkPolicy',
            component: <NetworkPolicyEditor yaml={yaml.dump(policy.spec)} />,
          },
          {
            label: 'IP Lookup',
            component: <NetworkPolicyEditor yaml={yaml.dump(policy.policyRef)} />,
          },
        ]}
        ariaLabel="Navigation Tabs"
      />
    </SectionBox>
  );
}

function NetworkPolicyEditor(props: Readonly<{ yaml: string }>) {
  const { yaml } = props;
  const editorTheme = useEditorTheme();

  return (
    <Box paddingTop={2} height="100%">
      <Editor
        language={'yaml'}
        theme={editorTheme}
        value={yaml}
        height={window.innerHeight * 0.8}
      />
    </Box>
  );
}

function NetworkPolicyDiagram(
  props: Readonly<{
    generatedNetworkPolicy: GeneratedNetworkPolicy;
    comparison: ComparisonResult | null;
  }>
) {
  const { generatedNetworkPolicy, comparison } = props;
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

  return (
    <SectionBox>
      <StatusLegend comparison={comparison} />
      <Box style={{ height: dimensions.height * 0.8, width: dimensions.width * 0.8 }}>
        <ReactFlowProvider>
          <NetworkPolicyFlow
            generatedNetworkPolicy={generatedNetworkPolicy}
            comparison={comparison}
          />
        </ReactFlowProvider>
      </Box>
    </SectionBox>
  );
}

// What the outlines of the peers mean, when policies restrict the workload
function StatusLegend(props: Readonly<{ comparison: ComparisonResult | null }>) {
  const { comparison } = props;
  const theme = useTheme();
  if (!comparison?.comparison?.selecting.length) return null;
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      sx={{ mt: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        Current NetworkPolicies:
      </Typography>
      {(['allowed', 'partly', 'blocked'] as const).map(status => (
        <Stack key={status} direction="row" spacing={0.5} alignItems="center">
          <Box
            sx={{
              width: 14,
              height: 14,
              borderRadius: '3px',
              boxShadow: `0 0 0 2px ${
                theme.palette[flowStatusColors[status] as 'success' | 'warning' | 'error'].main
              }`,
            }}
          />
          <Typography variant="body2">{flowStatusLabels[status]}</Typography>
        </Stack>
      ))}
      <Typography variant="body2" color="text.secondary">
        Peers without an outline are in a direction no policy restricts.
      </Typography>
    </Stack>
  );
}

// Big policies only fit far zoomed out; small ones are not blown up
const fitOptions = { maxZoom: 1, minZoom: 0.05 };

/**
 * The height of a node depends on its selectors, so the nodes are first rendered hidden.
 * Once React Flow has measured them, they are laid out with their size and shown.
 */
function NetworkPolicyFlow(
  props: Readonly<{
    generatedNetworkPolicy: GeneratedNetworkPolicy;
    comparison: ComparisonResult | null;
  }>
) {
  const { generatedNetworkPolicy, comparison } = props;
  const elements = useMemo(() => createNodes(generatedNetworkPolicy), [generatedNetworkPolicy]);
  // outlines that do not change the size of the nodes, so the layout stays
  const flowStatuses = useMemo(
    () => nodeFlowStatuses(elements.nodes, comparison?.comparison?.flows),
    [elements, comparison]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(elements.nodes);
  const [laidOut, setLaidOut] = useState(false);
  // the positions of the layout, to go back to after dragging nodes around
  const [layout, setLayout] = useState<Node[]>([]);
  const nodesInitialized = useNodesInitialized();
  const { getNodes, fitView } = useReactFlow();
  const theme = useTheme();

  useEffect(() => {
    setNodes(elements.nodes);
    setLaidOut(false);
  }, [elements, setNodes]);

  useEffect(() => {
    if (!nodesInitialized || laidOut) return;

    // the nodes and edges of the same policy, with the sizes React Flow measured
    const measured = new Map(getNodes().map(node => [node.id, node.measured]));
    const laidOutNodes = elements.nodes.map(node => ({
      ...node,
      measured: measured.get(node.id) ?? node.measured,
    }));
    layoutElements(laidOutNodes, elements.edges);
    setLayout(laidOutNodes);
    setNodes(laidOutNodes);
    setLaidOut(true);
    window.requestAnimationFrame(() => fitView(fitOptions));
  }, [nodesInitialized, laidOut, elements, getNodes, setNodes, fitView]);

  // puts dragged nodes back where the layout put them, and shows the whole diagram
  const resetView = () => {
    setNodes(layout.map(node => ({ ...node, position: { ...node.position } })));
    window.requestAnimationFrame(() => fitView(fitOptions));
  };

  // the controls in the colors of Headlamp's theme, whichever theme that is
  const controlColors = {
    '--xy-controls-button-background-color': theme.palette.background.paper,
    '--xy-controls-button-background-color-hover': theme.palette.action.hover,
    '--xy-controls-button-color': theme.palette.text.primary,
    '--xy-controls-button-color-hover': theme.palette.text.primary,
    '--xy-controls-button-border-color': theme.palette.divider,
  } as CSSProperties;

  return (
    <FlowStatusContext.Provider value={flowStatuses}>
      <ReactFlow
        nodes={nodes}
        edges={elements.edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        colorMode={theme.palette.mode}
        proOptions={{ hideAttribution: true }}
        // big policies only fit zoomed out
        minZoom={fitOptions.minZoom}
        style={{ ...controlColors, visibility: laidOut ? 'visible' : 'hidden' }}
      >
        <Controls showInteractive={false} fitViewOptions={fitOptions}>
          <ControlButton onClick={resetView} title="Reset view" aria-label="Reset view">
            <Icon icon="mdi:restore" />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </FlowStatusContext.Provider>
  );
}
