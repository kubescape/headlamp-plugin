/*
  Asks the Kubescape operator to run a command, such as a scan, through an OperatorCommand.
  The operator watches OperatorCommands in its namespace and reports progress in their status.
*/
import { post, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getKubescapeNamespace } from '../custom-objects/api-queries';
import { newGuid } from './uuid';

/** A command of the operator API, as accepted by its /v1/triggerAction endpoint. */
export interface OperatorApiCommand {
  commandName: string;
  wlid?: string;
  // a scope, such as a namespace, of which the operator works out the workloads itself
  wildWlid?: string;
  args?: Record<string, unknown>;
}

export const configurationScanCommand: OperatorApiCommand = {
  commandName: 'kubescapeScan',
  args: { scanV1: { submit: true } },
};

// The API paths of the workload kinds of a wlid
const workloadPaths: Record<string, (namespace: string, name: string) => string> = {
  deployment: (namespace, name) => `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
  statefulset: (namespace, name) => `/apis/apps/v1/namespaces/${namespace}/statefulsets/${name}`,
  daemonset: (namespace, name) => `/apis/apps/v1/namespaces/${namespace}/daemonsets/${name}`,
  replicaset: (namespace, name) => `/apis/apps/v1/namespaces/${namespace}/replicasets/${name}`,
  job: (namespace, name) => `/apis/batch/v1/namespaces/${namespace}/jobs/${name}`,
  cronjob: (namespace, name) => `/apis/batch/v1/namespaces/${namespace}/cronjobs/${name}`,
  pod: (namespace, name) => `/api/v1/namespaces/${namespace}/pods/${name}`,
};

/** The parts of a wlid such as wlid://cluster-prod/namespace-shop/deployment-web. */
export function parseWlid(
  wlid: string
): { cluster: string; namespace: string; kind: string; name: string } | undefined {
  const match = /^wlid:\/\/cluster-([^/]+)\/namespace-([^/]+)\/([a-z]+)-(.+)$/.exec(wlid);
  return match
    ? { cluster: match[1], namespace: match[2], kind: match[3], name: match[4] }
    : undefined;
}

/**
 * Scans the images of the workload with the given wlid (kubescape.io/wlid annotation). The
 * operator only works out the containers to scan for a scope, and fails with "failed to get
 * container for image" for a wlid, so the command names the namespace of the workload and the
 * labels of its pods, which the operator lists to scan their containers.
 */
export async function vulnerabilityScanCommand(
  wlid: string,
  cluster: string
): Promise<OperatorApiCommand> {
  const workload = parseWlid(wlid);
  const path = workload && workloadPaths[workload.kind];
  if (!workload || !path) throw new Error(`Kubescape cannot rescan ${wlid}.`);
  const wildWlid = `wlid://cluster-${workload.cluster}/namespace-${workload.namespace}`;

  if (workload.kind === 'pod') {
    return {
      commandName: 'scan',
      wildWlid,
      args: { fieldSelector: { 'metadata.name': workload.name } },
    };
  }

  const object = await request(path(workload.namespace, workload.name), { cluster });
  const template =
    workload.kind === 'cronjob' ? object.spec?.jobTemplate?.spec?.template : object.spec?.template;
  const labels = template?.metadata?.labels ?? {};
  // without labels the operator would scan every pod of the namespace
  if (Object.keys(labels).length === 0) {
    throw new Error(
      `The pods of ${workload.kind} ${workload.name} have no labels to select them by.`
    );
  }
  return { commandName: 'scan', wildWlid, args: { labels } };
}

export interface OperatorCommandRef {
  cluster: string;
  namespace: string;
  name: string;
}

export interface OperatorCommandStatus {
  started: boolean;
  completed: boolean;
  error?: string;
}

function operatorCommandsPath(namespace: string) {
  return `/apis/kubescape.io/v1alpha1/namespaces/${namespace}/operatorcommands`;
}

/** Creates an OperatorCommand that makes the operator in the cluster run the command. */
export async function sendOperatorCommand(
  cluster: string,
  command: OperatorApiCommand
): Promise<OperatorCommandRef> {
  const { kubeScapeNamespace, error } = await getKubescapeNamespace(cluster);
  if (!kubeScapeNamespace) {
    throw new Error(error ?? 'Kubescape operator namespace not found.');
  }

  const created = await post(
    operatorCommandsPath(kubeScapeNamespace),
    {
      apiVersion: 'kubescape.io/v1alpha1',
      kind: 'OperatorCommand',
      metadata: {
        generateName: 'headlamp-',
        namespace: kubeScapeNamespace,
        labels: { 'kubescape.io/app-name': 'operator' },
      },
      spec: {
        guid: newGuid(),
        commandType: 'OperatorAPI',
        // a byte array in the API, so base64 encoded
        body: btoa(JSON.stringify(command)),
      },
    },
    true,
    { cluster }
  );
  return { cluster, namespace: kubeScapeNamespace, name: created.metadata.name };
}

export async function getOperatorCommandStatus(
  ref: OperatorCommandRef
): Promise<OperatorCommandStatus> {
  const command = await request(`${operatorCommandsPath(ref.namespace)}/${ref.name}`, {
    cluster: ref.cluster,
  });
  const status = command.status ?? {};
  const error = status.error;
  return {
    started: !!status.started,
    completed: !!status.completed,
    error: error
      ? error.message || error.reason || 'The operator could not run the command'
      : undefined,
  };
}

/**
 * Waits until the operator completed the command, checking its status every interval.
 * Resolves with the final status, or with the last one when the timeout passes.
 */
export async function waitForOperatorCommand(
  ref: OperatorCommandRef,
  { interval = 3000, timeout = 120_000 } = {}
): Promise<OperatorCommandStatus & { timedOut: boolean }> {
  const deadline = Date.now() + timeout;
  let status: OperatorCommandStatus = { started: false, completed: false };
  while (Date.now() < deadline) {
    status = await getOperatorCommandStatus(ref);
    if (status.completed || status.error) return { ...status, timedOut: false };
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return { ...status, timedOut: true };
}
