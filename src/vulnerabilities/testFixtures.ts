import type { SBOMSyft } from '../softwarecomposition/SBOMSyft';
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

export function sbom(): SBOMSyft {
  return {
    metadata: {
      name: 'docker.io-velero-velero-v1.18.1-b55b90',
      namespace: 'kubescape',
      annotations: { 'kubescape.io/image-tag': 'docker.io/velero/velero:v1.18.1' },
      labels: {},
    } as any,
    spec: {
      metadata: { report: { createdAt: '2026-10-27T13:52:26Z' } },
      syft: {
        source: { id: 'docker.io/velero/velero@1145b55b90' },
        descriptor: { name: 'syft', version: 'v1.42.3' },
        distro: {
          id: 'ubuntu',
          name: 'Ubuntu',
          prettyName: 'Ubuntu 22.04.5 LTS',
          version: '22.04',
          versionID: '22.04',
        },
        artifacts: [
          {
            id: 'aaa8',
            name: 'base-files',
            version: '12ubuntu4.7',
            type: 'deb',
            purl: 'pkg:deb/ubuntu/base-files@12ubuntu4.7',
            foundBy: '',
            language: '',
            licenses: [
              { value: 'GPL', spdxExpression: '', urls: [] },
              { value: 'GPL', spdxExpression: '', urls: [] },
            ],
            cpes: [{ cpe: 'cpe:2.3:a:base-files:base-files:12ubuntu4.7:*:*:*:*:*:*:*' }],
          },
          {
            id: 'bbb9',
            name: 'golang.org/x/net',
            version: 'v0.38.0',
            type: 'go-module',
            purl: 'pkg:golang/golang.org/x/net@v0.38.0',
            foundBy: '',
            language: 'go',
            licenses: [],
            cpes: ['cpe:2.3:a:golang:net:v0.38.0:*:*:*:*:*:*:*'],
          },
        ],
        // a field of Syft that the plugin does not declare, which the export keeps
        files: [{ id: 'f1', location: { path: '/etc/os-release' } }],
      } as any,
    },
  };
}
