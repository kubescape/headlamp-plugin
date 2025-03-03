import { K8s, KubeObject } from '@kinvolk/headlamp-plugin/lib';
import {
  Link as HeadlampLink,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { RoutingName } from '../index';
import { applicationProfileClass } from '../model';
import { ApplicationProfile } from '../softwarecomposition/ApplicationProfile';
import { AlertMessagePopup } from './AlertMessagePopup';
import { NodeAgentLogLine } from './NodeAgentLogLine';

export function ApplicationProfiles() {
  const [applicationProfiles, setApplicationProfiles] = useState<KubeObject[] | null>(null);

  applicationProfileClass.useApiList(setApplicationProfiles);

  if (!applicationProfiles) {
    return <></>;
  }

  return (
    <>
      <SectionBox title="Application Profiles">
        <Typography variant="body1" component="div" sx={{ flexGrow: 1 }}>
          Kubescape operator should be configured with "capabilities.runtimeDetection: enable" and
          "alertCRD.installDefault: true". For testing a short learning period is recommended:
          "nodeAgent.config.maxLearningPeriod: 10m".
        </Typography>
        <HeadlampTable
          data={applicationProfiles}
          columns={[
            {
              header: 'Name',
              accessorFn: (profile: ApplicationProfile) =>
                profile.metadata.labels['kubescape.io/workload-name'],
              Cell: ({ cell, row }: any) => (
                <HeadlampLink
                  routeName={RoutingName.RuntimeDetection}
                  params={{
                    name: row.original.metadata.name,
                    namespace: row.original.metadata.namespace,
                  }}
                >
                  {cell.getValue()}
                </HeadlampLink>
              ),
            },
            {
              header: 'Kind',
              accessorFn: (profile: ApplicationProfile) =>
                profile.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              header: 'Namespace',
              accessorFn: (profile: ApplicationProfile) => profile.metadata.namespace,
            },
            {
              header: 'Monitoring',
              accessorFn: (profile: ApplicationProfile) =>
                profile.metadata.annotations['kubescape.io/status'],
            },
          ]}
        />
      </SectionBox>
      <NodeAgentLogging />
    </>
  );
}

function NodeAgentLogging() {
  const [alerts, setAlerts] = useState<NodeAgentLogLine[]>([]);
  const [nodeAgents] = K8s.ResourceClasses.Pod.useList({
    labelSelector: 'app.kubernetes.io/component=node-agent,app.kubernetes.io/instance=kubescape',
  });
  const nodeAlerts = useRef<Map<string, NodeAgentLogLine[]>>(new Map());

  if (!nodeAgents) {
    return <></>;
  }

  function setNodeAgentAlerts(nodeName: string, lines: NodeAgentLogLine[]) {
    nodeAlerts.current.set(nodeName, lines);
    const all = Array.from(nodeAlerts.current.values()).flatMap(lines => lines);
    setAlerts(all);
  }

  return (
    <>
      <SectionBox title="Runtime Detection">
        {nodeAgents.map((nodeAgent: KubeObject) => (
          <NodeLog nodeAgent={nodeAgent} setNodeAgentAlerts={setNodeAgentAlerts} />
        ))}
        <HeadlampTable
          data={alerts}
          columns={[
            {
              id: 'time',
              header: 'Time',
              accessorKey: 'time',
              gridTemplate: '1fr',
              Cell: ({ cell }: any) => {
                const startOfToday = new Date().setUTCHours(0, 0, 0, 0);
                if (new Date(cell.getValue()) < new Date(startOfToday)) {
                  return localeDate(cell.getValue());
                } else {
                  return new Date(cell.getValue()).toLocaleTimeString();
                }
              },
            },
            {
              header: 'Message',
              accessorKey: 'message',
              gridTemplate: '2fr',
            },
            {
              header: 'Pod',
              accessorKey: 'RuntimeK8sDetails.podName',
              gridTemplate: '1fr',
            },
            {
              header: 'Workload',
              accessorKey: 'RuntimeK8sDetails.workloadName',
              gridTemplate: '1fr',
            },
            {
              header: 'Namespace',
              accessorKey: 'RuntimeK8sDetails.workloadNamespace',
              gridTemplate: '1fr',
            },
            {
              header: 'Node',
              accessorKey: 'nodeName',
              gridTemplate: '1fr',
            },
            {
              header: 'Fix',
              accessorKey: 'BaseRuntimeMetadata.fixSuggestions',
              Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
              gridTemplate: '4fr',
            },
            {
              header: '',
              accessorFn: () => '...',
              Cell: ({ row }: any) => (
                <AlertMessagePopup
                  content={JSON.stringify(row.original, null, 2)}
                ></AlertMessagePopup>
              ),
              gridTemplate: '0.1fr',
            },
          ]}
          initialState={{
            sorting: [
              {
                id: 'time',
                desc: true,
              },
            ],
          }}
        />
      </SectionBox>
    </>
  );
}

function NodeLog(props: { nodeAgent: KubeObject; setNodeAgentAlerts: any }) {
  const { nodeAgent, setNodeAgentAlerts } = props;

  useEffect(() => {
    let callback: any = null;
    const nodeName = nodeAgent.jsonData.metadata.name;

    function setlogChunks(lines: string[]) {
      const nodeAgentAlerts = parseLogChunks(nodeName, lines).filter(
        line => line.BaseRuntimeMetadata
      );

      setNodeAgentAlerts(nodeName, nodeAgentAlerts);
    }

    callback = nodeAgent.getLogs('node-agent', setlogChunks, {
      tailLines: 200,
    });

    return function cleanup() {
      if (callback) {
        console.log('Cleanup callback for ' + nodeAgent.jsonData.spec.nodeName);
        callback();
      }
    };
  }, [nodeAgent]);

  return <></>;
}

// chunks are just blocks from the log stream.
// in each call to this method we get all the log chunks, this is how nodeAgent.getLogs() works
function parseLogChunks(nodeName: string, logChunks: string[]) {
  const nodeAgentLogLines: NodeAgentLogLine[] = [];

  // join the chunks and split on newline
  const lines = logChunks.join('').split('\n');

  lines.map(line => {
    // throw away lines which are non-json
    if (!line.startsWith('{') || !line.endsWith('}')) {
      return;
    }

    try {
      const jsonLine: NodeAgentLogLine = JSON.parse(line);
      jsonLine.nodeName = nodeName;
      if (jsonLine.RuntimeK8sDetails.workloadName) {
        nodeAgentLogLines.push(jsonLine);
      }
    } catch (e) {
      // ignore, the last chunk might not be complete
    }
  });

  return nodeAgentLogLines;
}
