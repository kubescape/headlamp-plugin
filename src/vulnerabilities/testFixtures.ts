import type { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import type { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';

export const T0 = '2026-09-01T00:00:00Z';
export const T1 = '2026-10-17T10:00:00.000Z';
export const T2 = '2026-10-17T11:00:00.000Z';

export function manifest(createdAt: string | null | undefined = T1): VulnerabilityManifest {
  return {
    metadata: {
      name: 'image-123',
      namespace: 'reports',
      cluster: 'cluster-a',
      creationTimestamp: T0,
      labels: {},
      annotations: { 'kubescape.io/image-tag': 'example:latest' },
    },
    spec: {
      metadata: { report: { createdAt } },
      payload: { source: { type: 'image' }, matches: [match('CVE-1')] },
    },
  };
}

export function match(id: string): VulnerabilityManifest.Match {
  return {
    artifact: { name: 'package', version: '1.0' },
    relatedVulnerabilities: [],
    vulnerability: {
      id,
      severity: 'High',
      description: 'test finding',
      dataSource: 'https://example.com/cve',
      cvss: [{ metrics: { baseScore: 8 } }],
      fix: { state: 'fixed', versions: ['2.0'] },
    },
  };
}

export function summary(): VulnerabilityManifestSummary {
  return {
    metadata: {
      ...manifest().metadata,
      name: 'workload-123',
      namespace: 'workloads',
      labels: {
        'kubescape.io/workload-name': 'workload',
        'kubescape.io/workload-namespace': 'workloads',
        'kubescape.io/workload-container-name': 'app',
        'kubescape.io/workload-kind': 'Deployment',
      },
    },
    spec: {
      severities: {
        critical: { all: 0, relevant: 0 },
        high: { all: 2, relevant: 1 },
        medium: { all: 0, relevant: 0 },
        low: { all: 0, relevant: 0 },
        negligible: { all: 0, relevant: 0 },
        unknown: { all: 0, relevant: 0 },
      },
      vulnerabilitiesRef: {
        all: { kind: 'VulnerabilityManifest', name: 'image-123', namespace: 'reports' },
        relevant: {
          kind: 'VulnerabilityManifest',
          name: 'relevant-123',
          namespace: 'relevant-reports',
        },
      },
    },
  };
}
