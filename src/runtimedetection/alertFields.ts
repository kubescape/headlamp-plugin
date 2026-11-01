/*
  Reading the runtime alerts of the node-agent. It sends the severity as the priority of the
  rule, the process by its name and PID, and names the workload only by its uid, so the name of
  the workload is read from the name of the pod.
*/
import type { Rule } from '../types/Rules';
import type { AlertmanagerAlert } from './alertmanager';

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'None' | 'System issue';

const severityNames: Record<string, AlertSeverity> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
  system_issue: 'System issue',
};

/**
 * The severity of an alert. Like the node-agent, a priority of 1 to 4 is low, 5 to 7 medium,
 * 8 and 9 high, 10 critical, and 1000 a problem of the node-agent itself.
 */
export function alertSeverity(alert: AlertmanagerAlert): AlertSeverity | undefined {
  const value = alert.labels.severity?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return severityNames[value.toLowerCase()];
  const priority = Number(value);
  if (priority >= 1000) return 'System issue';
  if (priority >= 10) return 'Critical';
  if (priority >= 8) return 'High';
  if (priority >= 5) return 'Medium';
  if (priority >= 1) return 'Low';
  return 'None';
}

/** The order of the severities, the most severe last. */
export const severityRank: Record<AlertSeverity, number> = {
  'System issue': 0,
  None: 1,
  Low: 2,
  Medium: 3,
  High: 4,
  Critical: 5,
};

export function severityColor(severity: string | undefined): 'error' | 'warning' | 'default' {
  if (severity === 'Critical' || severity === 'High') return 'error';
  if (severity === 'Medium') return 'warning';
  return 'default';
}

/**
 * What the rule found, such as the process or the domain. The summary only repeats the rule,
 * the pod and the namespace.
 */
export function alertMessage(alert: AlertmanagerAlert): string | undefined {
  const { description, message, summary } = alert.annotations;
  return description || message || summary || undefined;
}

export function alertPod(alert: AlertmanagerAlert): string | undefined {
  return alert.labels.pod ?? alert.labels.pod_name;
}

export function alertNamespace(alert: AlertmanagerAlert): string | undefined {
  return alert.labels.namespace ?? alert.labels.workload_namespace;
}

// the characters of the random suffixes of generated names: no vowels, and no 0, 1 or 3
const suffix = '[bcdfghjklmnpqrstvwxz2456789]';
// what Kubernetes adds to the name of a workload to name its pods
const generatedTails = [
  // a Job of a CronJob: the scheduled time in minutes and a suffix
  `-\\d{8,}-${suffix}{5}`,
  // a ReplicaSet of a Deployment: the pod template hash and a suffix
  `-${suffix}{6,10}-${suffix}{5}`,
  // a DaemonSet or a Job
  `-${suffix}{5}`,
  // a StatefulSet, or an operator that numbers its pods, such as CloudNativePG
  '-\\d+',
];
const ownerPatterns = generatedTails.map(tail => ({ tail, pattern: new RegExp(`^(.+)${tail}$`) }));

/** The name of the workload of a pod, read from the name Kubernetes generated for the pod. */
export function workloadOfPod(pod: string): string {
  for (const { pattern } of ownerPatterns) {
    const match = pattern.exec(pod);
    if (match) return match[1];
  }
  return pod;
}

/** The workload of the alert, named by the exporter or read from the pod name. */
export function alertWorkload(alert: AlertmanagerAlert): string | undefined {
  const named = alert.labels.workload_name ?? alert.labels.workload;
  if (named) return named;
  const pod = alertPod(alert);
  return pod ? workloadOfPod(pod) : undefined;
}

/**
 * A user or group id of the process. Recent node-agents send memory addresses instead, which
 * are larger than any id.
 */
export function processId(value: string | undefined): string | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value) <= 0xffffffff ? value : undefined;
}

/** The rules of a Rules object of a cluster. */
export interface ClusterRules {
  cluster?: string;
  rules?: Partial<Rule>[];
}

function ruleKey(cluster: string | undefined, idOrName: string) {
  return `${cluster ?? ''}|${idOrName}`;
}

/** The rules of the clusters by cluster and by rule id and name, the first of a key winning. */
export function indexRules(objects: ClusterRules[]): Map<string, Partial<Rule>> {
  const index = new Map<string, Partial<Rule>>();
  for (const { cluster, rules } of objects) {
    for (const rule of rules ?? []) {
      for (const key of [rule.id, rule.name]) {
        if (key && !index.has(ruleKey(cluster, key))) index.set(ruleKey(cluster, key), rule);
      }
    }
  }
  return index;
}

/** The rule that raised an alert, as defined in the cluster of the alert. */
export function alertRule(
  index: Map<string, Partial<Rule>>,
  alert: AlertmanagerAlert
): Partial<Rule> | undefined {
  for (const key of [alert.labels.rule_id, alert.labels.rule_name]) {
    const rule = key ? index.get(ruleKey(alert.cluster, key)) : undefined;
    if (rule) return rule;
  }
  return undefined;
}

/** What a rule detects, as a sentence. */
export function ruleDescription(rule: Partial<Rule> | undefined): string | undefined {
  const description = rule?.description?.trim();
  if (!description) return undefined;
  return /[.!?]$/.test(description) ? description : `${description}.`;
}

/** The page of a MITRE ATT&CK tactic (TA0002) or technique (T1059, T1071.004). */
export function mitreUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (/^TA\d{4}$/.test(id)) return `https://attack.mitre.org/tactics/${id}/`;
  const technique = /^T(\d{4})(?:\.(\d{3}))?$/.exec(id);
  if (!technique) return undefined;
  const [, number, sub] = technique;
  return `https://attack.mitre.org/techniques/T${number}/${sub ? `${sub}/` : ''}`;
}

/** Whether a rule compares with the learned profile of the container. */
export const profileDependencyTexts: Record<number, string> = {
  0: 'Required: the rule fires on what the profile did not record',
  1: 'Used when available',
  2: 'Not used',
};

/** The trace of the alert, formatted, when it has one. */
export function alertTrace(alert: AlertmanagerAlert): string | undefined {
  const trace = alert.labels.trace?.trim();
  if (!trace || trace === '{}' || trace === 'null') return undefined;
  try {
    return JSON.stringify(JSON.parse(trace), null, 2);
  } catch {
    return trace;
  }
}
