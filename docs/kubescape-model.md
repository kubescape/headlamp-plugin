## Kubescape datamodel

Kubescape provides several reporting objects that can be retrieved via the K8s API server.

Kubescape uses API aggregation: https://github.com/kubescape/storage. There are no CRDs. The API contract can be found in the softwarecomposition [folder](https://github.com/kubescape/storage/tree/main/pkg/apis/softwarecomposition/v1beta1).

### Vulnerabilty scan

```mermaid

 classDiagram

    class VulnerabilityManifestSummary {
        metadata
        spec.vulnerabilitiesRef.all.name: VulnerabilityManifest
        spec.vulnerabilitiesRef.relevant.name: VulnerabilityManifest
    }

    class VulnerabilityManifest {
        metadata
        spec.matches
    }

     class VulnerabilityManifestRelevant {
        metadata
        spec.matches
    }

    class VulnerabilitySummary {
        metadata
        spec.vulnerabilitiesRef: []VulnerabilityManifestSummary
    }

    class SBOMSyft {
        metadata
        syft: SBOMSyft.Syft
    }

     class SBOMSyftFiltered {
        metadata
        syft: SBOMSyft.Syft
    }

    VulnerabilityManifestSummary --> VulnerabilityManifest
    VulnerabilityManifestSummary --> VulnerabilityManifestRelevant
    VulnerabilitySummary --> VulnerabilityManifestSummary
    VulnerabilityManifest --> SBOMSyft
    VulnerabilityManifestRelevant --> SBOMSyftFiltered
    SBOMSyftFiltered --> SBOMSyft

    K8sNamespace --> VulnerabilitySummary
    K8sWorkload --> ContainerImage
    ContainerImage --> SBOMSyft
    K8sWorkload --> VulnerabilityManifestSummary
    K8sWorkload --> SBOMSyftFiltered
```

### Configuration scan

```mermaid

classDiagram

    class ConfigurationScanSummary {
        metadata
    }

    class WorkloadConfigurationScan {
        metadata
        spec.controls: []Rego Control + rules
        spec.severities: []int
    }

    class WorkloadConfigurationScanSummary {
        metadata
        spec.controls: []Rego Control
        spec.severities: []int
    }

    K8sNamespace --> ConfigurationScanSummary
    K8sWorkload --> WorkloadConfigurationScanSummary
    ConfigurationScanSummary --> WorkloadConfigurationScanSummary
    WorkloadConfigurationScanSummary --> WorkloadConfigurationScan

    class ApplicationProfile{
        metadata
        spec.containers: []Container
    }
```

