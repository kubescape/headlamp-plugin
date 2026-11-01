/*
  The Kubescape results of the workloads in a namespace, read for the Headlamp resource lists
  and kept for a few minutes.
*/
import { useEffect, useSyncExternalStore } from 'react';
import { vulnerabilityManifestSummaryClass, workloadConfigurationScanSummaryClass } from '../model';
import { paginatedListQuery } from '../query';
import type { WorkloadRef } from './scannedWorkload';

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ContainerVulnerabilities extends SeverityCounts {
  container: string;
  // name of the VulnerabilityManifestSummary
  name: string;
}

export interface WorkloadVulnerabilities extends SeverityCounts {
  containers: ContainerVulnerabilities[];
}

export interface WorkloadControls extends SeverityCounts {
  // name of the WorkloadConfigurationScanSummary
  name: string;
}

export interface WorkloadSummaries {
  vulnerabilities: Map<string, WorkloadVulnerabilities>;
  controls: Map<string, WorkloadControls>;
}

const severities = ['critical', 'high', 'medium', 'low'] as const;

export function workloadKey(namespace: string, kind: string, name: string) {
  return `${namespace}/${kind}/${name}`.toLowerCase();
}

function keyOfSummary(summary: any): string | undefined {
  const labels = summary.metadata?.labels ?? {};
  const kind = labels['kubescape.io/workload-kind'];
  const name = labels['kubescape.io/workload-name'];
  const namespace = labels['kubescape.io/workload-namespace'] ?? summary.metadata?.namespace;
  return kind && name && namespace ? workloadKey(namespace, kind, name) : undefined;
}

/** Totals the summaries per workload: CVEs over the containers, and failed controls. */
export function summarizeWorkloads(
  vulnerabilitySummaries: any[],
  configurationSummaries: any[]
): WorkloadSummaries {
  const vulnerabilities = new Map<string, WorkloadVulnerabilities>();
  for (const summary of vulnerabilitySummaries) {
    const key = keyOfSummary(summary);
    if (!key) continue;
    const workload = vulnerabilities.get(key) ?? {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      containers: [],
    };
    const container: ContainerVulnerabilities = {
      container: summary.metadata.labels['kubescape.io/workload-container-name'] ?? '',
      name: summary.metadata.name,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const severity of severities) {
      container[severity] = summary.spec?.severities?.[severity]?.all ?? 0;
      workload[severity] += container[severity];
    }
    workload.containers.push(container);
    vulnerabilities.set(key, workload);
  }

  const controls = new Map<string, WorkloadControls>();
  for (const summary of configurationSummaries) {
    const key = keyOfSummary(summary);
    if (!key) continue;
    const counts = summary.spec?.severities ?? {};
    controls.set(key, {
      name: summary.metadata.name,
      critical: counts.critical ?? 0,
      high: counts.high ?? 0,
      medium: counts.medium ?? 0,
      low: counts.low ?? 0,
    });
  }

  return { vulnerabilities, controls };
}

interface ListedObject {
  kind: string;
  metadata: {
    name: string;
    labels?: Record<string, string>;
    ownerReferences?: Array<WorkloadRef & { controller?: boolean }>;
  };
}

/**
 * The workloads that Kubescape may have scanned for a listed object, the most likely first.
 * Pods are scanned as the workload that runs them; that is guessed from the name of their
 * controller, since a resource list cannot afford to look up the controllers of every pod.
 */
export function scannedWorkloadCandidates(object: ListedObject): WorkloadRef[] {
  const { name } = object.metadata;
  if (object.kind !== 'Pod') return [{ kind: object.kind, name }];

  const controller = object.metadata.ownerReferences?.find(reference => reference.controller);
  if (!controller) return [{ kind: 'Pod', name }];

  if (controller.kind === 'ReplicaSet') {
    const hash = object.metadata.labels?.['pod-template-hash'];
    const deployment =
      hash && controller.name.endsWith(`-${hash}`)
        ? controller.name.slice(0, -hash.length - 1)
        : undefined;
    return [
      ...(deployment ? [{ kind: 'Deployment', name: deployment }] : []),
      { kind: 'ReplicaSet', name: controller.name },
    ];
  }
  if (controller.kind === 'Job') {
    // CronJobs name their Jobs after the scheduled time: <cronjob>-<minutes since epoch>
    const cronJob = /^(.+)-\d+$/.exec(controller.name)?.[1];
    return [
      ...(cronJob ? [{ kind: 'CronJob', name: cronJob }] : []),
      { kind: 'Job', name: controller.name },
    ];
  }
  return [{ kind: controller.kind, name: controller.name }];
}

/** The summary of the first candidate that Kubescape scanned. */
export function findWorkloadSummary<T>(
  summaries: Map<string, T>,
  namespace: string,
  candidates: WorkloadRef[]
): T | undefined {
  for (const candidate of candidates) {
    const summary = summaries.get(workloadKey(namespace, candidate.kind, candidate.name));
    if (summary) return summary;
  }
  return undefined;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const maxAge = 5 * 60 * 1000;
// namespaces read at the same time; a page of pods can show many namespaces
const maxParallel = 4;
const pageSize = 500;

interface Entry {
  summaries?: WorkloadSummaries;
  loadedAt: number;
  loading: boolean;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const queue: Array<() => Promise<void>> = [];
let running = 0;

function changed() {
  version++;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function keyOf(cluster: string, namespace: string) {
  return `${cluster}\u0000${namespace}`;
}

function runQueued() {
  while (running < maxParallel && queue.length > 0) {
    const read = queue.shift()!;
    running++;
    read().finally(() => {
      running--;
      runQueued();
    });
  }
}

// The storage only returns the spec, which holds the counts, of a fullSpec list
async function listSummaries(cluster: string, namespace: string, objectClass: any) {
  const { items } = await paginatedListQuery(cluster, objectClass, '', pageSize, [namespace]);
  return items;
}

/**
 * Reads the summaries of a namespace, unless they were read recently. The lists only read the
 * namespaces of the rows they show, which on a big cluster is a fraction of all summaries.
 * A namespace without Kubescape results gets empty summaries, so its rows stay empty.
 */
export function loadWorkloadSummaries(
  cluster: string,
  namespace: string,
  now: number = Date.now()
) {
  const key = keyOf(cluster, namespace);
  const entry = entries.get(key);
  if (entry && (entry.loading || now - entry.loadedAt < maxAge)) return;

  entries.set(key, {
    summaries: entry?.summaries,
    loadedAt: entry?.loadedAt ?? 0,
    loading: true,
  });
  queue.push(async () => {
    const [vulnerabilities, configurations] = await Promise.allSettled([
      listSummaries(cluster, namespace, vulnerabilityManifestSummaryClass),
      listSummaries(cluster, namespace, workloadConfigurationScanSummaryClass),
    ]);
    entries.set(key, {
      summaries: summarizeWorkloads(
        vulnerabilities.status === 'fulfilled' ? vulnerabilities.value : [],
        configurations.status === 'fulfilled' ? configurations.value : []
      ),
      loadedAt: Date.now(),
      loading: false,
    });
    changed();
  });
  runQueued();
}

/** The summaries of a namespace read so far, without reading them. */
export function cachedWorkloadSummaries(
  cluster: string,
  namespace: string
): WorkloadSummaries | undefined {
  return entries.get(keyOf(cluster, namespace))?.summaries;
}

/** The summaries of a namespace, read when needed; undefined until they are read. */
export function useWorkloadSummaries(
  cluster: string,
  namespace: string
): WorkloadSummaries | undefined {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    loadWorkloadSummaries(cluster, namespace);
  }, [cluster, namespace]);
  return cachedWorkloadSummaries(cluster, namespace);
}

/** Forgets the summaries, for tests. */
export function clearWorkloadSummaries() {
  entries.clear();
  changed();
}
