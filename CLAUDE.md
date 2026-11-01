# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Kubescape Headlamp Plugin that integrates Kubernetes security scanning capabilities into the Headlamp dashboard. It provides compliance scanning, vulnerability management, network policy visualization, runtime threat detection, and policy validation through a React/TypeScript frontend with WASM-based policy evaluation.

## Development Commands

### Frontend Development
```bash
npm run start          # Start development server
npm run build          # Build plugin for production
npm run lint           # Run ESLint
npm run lint-fix       # Fix ESLint issues automatically
npm run tsc            # TypeScript compilation check
npm run format         # Format code
npm run test           # Run tests (vitest)
go -C go test ./...    # Run Go tests of the WASM evaluators
```

### WASM and External Dependencies
```bash
make download                              # Download all external dependencies
make build                                 # Build Go code to WASM (requires Go)
make local                                 # Build and copy to local Headlamp plugins directory
make wasm-download                         # Copy the WASM execution runtime from the Go toolchain
make kubescape-rego-download               # Download controls, frameworks, and rego rules
make kubescape-cel-admission-library-download # Download CEL admission policy and test files
```

## Architecture Overview

### Plugin Structure
The plugin integrates with Headlamp through `@kinvolk/headlamp-plugin` framework using:
- **Sidebar registration**: Adds navigation entries for main features
- **Route registration**: Defines URL routes for each feature module
- **Detail view extensions**: Adds security information to existing Kubernetes resource pages
- **Multi-cluster support**: Works with Headlamp's cluster context switching

### Core Feature Modules

#### 0. Overview (`src/overview/`) and setup check (`src/common/SetupCheck.tsx`)
- Landing page of the Kubescape sidebar entry: compliance scores, CVE counts with the top package upgrades, recent runtime alerts and expiring exceptions
- Shares the scan caches of the Compliance and Vulnerabilities pages through `readConfigurationScans` and `readVulnerabilityScans`
- Every feature page starts with a setup check (`kubescapeSetup.ts`) that reports a missing storage API or disabled operator capabilities (read from the `ks-capabilities` ConfigMap) with the Helm command that fixes them
- Scan now / Rescan buttons (`ScanNowButton.tsx`, `operatorCommands.ts`) create an `OperatorCommand` (`kubescape.io/v1alpha1`, command type `OperatorAPI`) in the operator namespace and follow its status
- A vulnerability rescan must be a scope (`wildWlid` of the namespace with `args.labels` of the workload's pods, or `args.fieldSelector` for a bare pod): the operator only works out the containers to scan for a scope, and fails with "failed to get container for image" for a plain `wlid`
- Trends (`Trends.tsx`, `prometheus.ts`) chart the cluster totals of the Kubescape Prometheus exporter (`kubescape_controls_total_cluster_*`, `kubescape_vulnerabilities_total_cluster_*`) with `query_range` through the service proxy to the Prometheus address in the settings. Recharts is provided by Headlamp at runtime
- Notifications (`src/common/notifications.ts`, started from `index.tsx`) report critical runtime alerts and exceptions that expire within a week through Headlamp's notification store, every five minutes for the clusters in the URL. Sent ids are kept in localStorage, because Headlamp marks a notification that is sent again as unseen
- Search (`src/search/`): a button in Headlamp's top bar (`registerAppBarAction`) opens a search of CVEs (by id, a related id such as the CVE of a GHSA, or package), images, workloads (by name or container) and controls. Headlamp's own search has no plugin hook: it finds a fixed list of Kubernetes kinds and the registered pages without parameters, and registering a page per CVE was ruled out (a cluster easily has thousands of different CVEs, which are only in the full reports, hundreds of MB). The first search of a session reads the reports into the cache the Vulnerabilities pages share (`readVulnerabilityScans`); controls are searchable meanwhile. Indexing 8,000 CVEs takes ~30 ms and a search under 20 ms
- Kubescape columns in Headlamp's workload and pod lists (`src/sections/tableColumns.tsx`, `workloadSummaries.ts`) show critical and high CVEs and failed controls per workload. Summaries are read per namespace of the rows shown, four namespaces at a time, and kept for five minutes; pods are matched to their workload by the name of their controller

#### 1. Compliance (`src/compliance/`)
- Configuration scanning and compliance reporting
- Uses `WorkloadConfigurationScan` and `WorkloadConfigurationScanSummary` CRDs
- Main components: `Compliance.tsx`, `WorkloadScanDetails.tsx`, `ControlResults.tsx`
- A control's fix can be downloaded as YAML or applied after confirmation (`WorkloadScanFixes.tsx`); the update carries the resourceVersion, so a changed resource gives a 409 instead of being overwritten

#### 2. Vulnerabilities (`src/vulnerabilities/`)  
- Container image vulnerability scanning
- Uses `VulnerabilityManifest`, `VulnerabilityManifestSummary`, `SBOMSyft` CRDs
- Main components: `Vulnerabilities.tsx`, `CVEResults.tsx`, `ImageDetails.tsx`
- The Upgrades tab (`UpgradeList.tsx`, `upgrades.ts`) ranks package upgrades by the CVEs they fix
- Severity counts link to the findings of that severity with `?severity=`, read with `useURLSearchParam`
- A summary's `vulnerabilitiesRef` can name the workload namespace while the storage keeps all reports in the operator namespace. References are resolved at the referenced namespace first, then by name in the cluster (`findImageScan`) or in the operator namespace (`fetchVulnerabilityManifest`)
- Recent kubevuln versions leave `spec.metadata.report.createdAt` of the reports empty; the scan time is the `kubescape.io/timestamp` annotation (Unix seconds) of the summary (`getScanTime`)
- CVEs selected in the CVE list get one cluster-wide exception (`GuidedClusterVulnerabilityExceptionForm` takes `cveIds`)
- The SBOM page downloads the stored Syft JSON document as is, or converted to CycloneDX 1.5 JSON (`sbomExport.ts`)
- Images link to their vulnerability page and to the tag list of their registry (`ImageReference.tsx`, `registry.ts`): Docker Hub, Quay, GitHub, Google, Microsoft and the Amazon ECR public gallery. Other registries, such as registry.k8s.io, have no such page and get no button
- The Images tab and the pages of an image and a workload show the tag, the newest version and the end of life of the release line (`ImageVersion.tsx`, `imageVersionSources.ts`, `versions.ts`); both can be switched off in the plugin settings. The browser may only read services that allow other sites to, and Docker Hub, GHCR, GCR and MCR do not, nor may a plugin run its own script in Headlamp desktop or use its proxy for other hosts than artifacthub.io. So the tags of quay.io images come from Quay's API, those of gcr.io, `*-docker.pkg.dev` and registry.k8s.io (`k8s-artifacts-prod`) images from the API of Google's Artifact Registry, which public repositories answer without a login (`artifactRegistryPackage`; a repository is checked once a day, so a private one costs one request rather than one per image), the tags of Docker Hub's official images from the `docker-library/official-images` library files (through jsDelivr), the newest version of other Docker Hub images from the JSON of shields.io's Docker version badge (it sorts the most recent tags loosely and adds a `v`, so only an answer in the format of the tag or a plain release counts), the versions of GitHub projects from jsDelivr, as GitHub's API allows 60 anonymous requests an hour per address, and release lines from endoflife.date. There is no list of known images: the GitHub project of an image is the one its registry implies (ghcr.io, Crossplane packages; `githubProject`) or the one its `org.opencontainers.image.source` label names, read from the image config Kubescape keeps in the report (`imageSource.ts`, `ImageScan.source`), and only followed for public images (a public-only registry, or Quay, Artifact Registry or shields.io knowing the image), so private repository names go nowhere. The endoflife.date product is the one whose identifiers name the image (`pkg:docker`, `pkg:oci`) or its project (`pkg:github`; `purlKey`), or else the product or alias with the name of the image, of the image without a trailing number (`tool3`), of its project, or of the start of its name when the publisher carries it (`tracerproject/tracer-collector`); a product found by name only counts when the tag is one of its release lines. Docker Hub's own APIs and its mirrors (mirror.gcr.io, public.ecr.aws) do not allow other sites. version-checker, when it runs in a cluster, is read from its metrics through the service proxy and takes precedence. Images are only asked about at their own registry or at services that know them publicly; answers are kept a day in localStorage, failures an hour in memory, and at most four requests run at a time. Raise `storageVersion` when lookups change, or users keep the answers of the old lookups for a day
- Versions of tags (`versions.ts`): a tag is compared with the tags of the same format (prefix, number of components and variant, so `v3.13.2-distroless` with `v3.15.1-distroless`), project releases only count as numbers with an optional `v` (jsDelivr also lists tags such as `chart-3.0.0`), and a tag with fewer numbers (`8`, `3.4-alpine`) follows its release line, so only a newer line is newer

#### 3. Network Policies (`src/networkpolicies/`)
- Network policy visualization with flow diagrams
- Uses `@xyflow/react` and `@dagrejs/dagre` for diagram rendering; nodes are laid out after React Flow measured them
- Each peer is shown once per direction with the ports of all its rules (`policyPeers` in `layout.ts`), as generated policies often have a rule per port with the same peers, such as the passive ports of an FTP server; consecutive ports are shown as ranges (`ports.ts`). The Current policies tab compares the same peers
- Peers that only differ in per-pod labels (Job runs, rollouts, zones) are merged into one node; more than 5 IP ranges, or more than 10 pods that only differ in label values, of one direction with the same ports share one node
- Private ranges (RFC 1918, 100.64.0.0/10 and IPv6 unique local addresses) are shown as the cluster, other ranges as the internet
- The diagram reads the policy once: the storage generates it from runtime profiles that change constantly, so a watch would keep replacing it and restarting the layout
- A generated policy can be downloaded or created in the cluster (`apply.ts`, `NetworkPolicyActions.tsx`)
- The Current policies tab and the outlines of the diagram compare the observed traffic with the NetworkPolicies of the workload's namespace that select its pod template labels (`compare.ts`, `policyComparison.ts`, `ExistingPolicies.tsx`). Kubescape names only some labels of a peer, so the peer's live pods are read with a label selector (without per-pod labels, at most 50 queries) and their own labels are compared; peers without pods fall back to the generated labels. IP blocks are only matched against IP ranges, as whether they apply to pod addresses depends on the network plugin
- Peers with a pod selector but no namespace selector are in the workload's namespace, and the diagram names that namespace
- Main components: `NetworkPolicies.tsx`, `Diagram.tsx`

#### 4. Validating Admission Policies (`src/validating-admission/`)
- Policy playground for testing admission policies
- Uses WASM module for CEL (Common Expression Language) evaluation
- Main components: `ValidatingAdmissionPolicy.tsx`, `EvaluationResultsTables.tsx`
- The test resource can be a sample or an object of the cluster (`clusterResources.ts`)
- Install in cluster (`install.ts`, `InstallPolicyButton.tsx`) creates the policy with a binding whose `validationActions` are only Warn and/or Audit, never Deny. Policies with a `ControlConfiguration` paramKind need the `kubescape.io/v1` `controlconfigurations` CRD; the `basic-control-configuration` object can be created from the Params tab

#### 5. Runtime Detection (`src/runtimedetection/`, `src/rule-editor/`)
- Runtime security monitoring: alerts (read from Alertmanager), container profiles, rules and rule bindings
- Uses `ContainerProfile` CRDs, falling back to `ApplicationProfile` and `NetworkNeighborhood` on older Storage releases (`src/softwarecomposition/profileApi.ts`)
- Rules and `RuntimeRuleAlertBinding`s use the `kubescape.io/v1` API group; the rule editor tests rules with the `RuleEval` WASM function
- Seccomp profiles (`SeccompProfiles.tsx`, `seccomp.ts`) come from the `kubescape.io/v1` SeccompProfile CRD or the storage, depending on the operator's `seccompProfileBackend`
- Main components: `RuntimeDetection.tsx`, `ApplicationProfileDetail.tsx`, `RuleBindingEditor.tsx`, `rule-editor/RuleEditor.tsx`
- The profile page (`ContainerProfileDetail.tsx`) shows the behaviour, the network peers and the full profile as YAML, and the network graph of the workload: the diagram of the network policy the storage generates from the traffic of all its pods (`WorkloadNetworkGraph` in `networkpolicies/Diagram.tsx`, policy name `<kind>-<workload>`). Headlamp's tabs mount every tab hidden, so the graph is only rendered while its tab is open; React Flow would measure hidden nodes as empty. There is no separate network neighborhood page: it showed the same traffic as the Network Policies page, per profile version
- Alert labels of the node-agent (`alertFields.ts`): `severity` is the priority of the rule (1–4 Low, 5–7 Medium, 8–9 High, 10 Critical, 1000 a problem of the node-agent), the workload is only named by `workload_uid` so its name is read from the pod name, and `uid`/`gid` hold memory addresses, which are left out. The table shows the finding (`description`) rather than the summary, and a click on a row opens the details dialog (`AlertDetails.tsx`), which groups the labels by place, process and detection. What a rule detects, its MITRE ATT&CK ids and whether it needs a learned profile come from the `Rules` objects of the alert's cluster (`indexRules`, `alertRule`); the Rule column carries the description in its value, as Headlamp only redraws a cell when its value changes. The dialog links to the profile the container was checked against (`alertProfile.ts`): a profile's `kubescape.io/instance-id` names the version of the pod template (the ReplicaSet, the StatefulSet's `controller-revision-hash`, `<daemonset>-<hash>`, or the Job or CloudNativePG Cluster), which is matched against the pod's owner and labels, or the ReplicaSet in the pod's name when the pod is gone. Otherwise it falls back to the newest profile of the workload's container and says so; Jobs of a CronJob always do, as Kubescape keeps a profile per version of the CronJob. For a DNS alert the dialog shows the domain, which is only in the message (`alertDomain`), and compares it with the domains in the profile's egress (`fetchLearnedDomains`, `compareDomain`): the rule matches names exactly or by a `*.` wildcard, so `golang.org` alerts when only `proxy.golang.org` was learned
- Profiles are kept per version of the pod template (ReplicaSet, controller revision, Job), and the node-agent learns each container for the learning period (24 hours by default, the pod label `kubescape.io/max-sniffing-time` per workload) from its start; `kubescape.io/completion: partial` means it began watching after the container started. Relearn (`relearn.ts`, `RelearnDialog.tsx`, on the profile list and the profile page) restarts a Deployment, StatefulSet or DaemonSet like `kubectl rollout restart`, so its new pods get a new profile learned from their start, and deletes the profiles the workload recorded before. Before restarting, the dialog reads the workload and warns how the restart replaces its pods and when the workload is down (`restartImpact`: replicas, Recreate, OnDelete)
- Alerts are silenced from a dialog like the exception forms (`Silences.tsx`, `alertmanager.ts`): the rule in one pod, the workload, the namespace or the cluster, for 1 hour to 30 days, with a required reason as the comment and the Kubernetes username as `createdBy`. A silence of a workload matches the names of its pods with a regular expression of the parts Kubernetes generates (`podsOfWorkloadPattern`), so it also covers later rollouts; active silences are listed below the alerts and can be ended

#### 6. Exceptions (`src/exceptions/`) & Frameworks (`src/framework/`)
- Security exceptions are `SecurityException`/`ClusterSecurityException` CRDs. The scanners only apply them when the operator's `riskAcceptance` capability is enabled; the plugin then reads the `w/exceptions` control sub-status. Otherwise `apply-security-exceptions.ts` applies them to compliance results client-side, and the Exceptions page warns that scans ignore them
- Exceptions created in the plugin get the Kubernetes username (SelfSubjectReview, `src/common/currentUser.ts`) as `spec.author`; every create and change is appended to the `headlamp.kubescape.io/history` annotation (`history.ts`). The detail page shows that history and the `ExceptionMatched` events the scanner records when it applies the exception
- Risk acceptance: kubevuln hides a finding for `not_affected` and `fixed`, and for `affected` only with an `actionStatement` and responses that are all `can_not_fix`/`will_not_fix`; hidden findings move to `payload.ignoredMatches` with `appliedIgnoreRules` (status in `fix-state`, responses in `justification`, the action in `impactStatement`). The Resources tab and the findings page show which CVEs exceptions cover (`vulnerabilityExceptions.ts`, `exceptionChips.tsx`), and Accept risk creates one exception for the open CVEs of a workload (`GuidedVulnerabilityExceptionForm` with `acceptRisk`), from the Resources tab or the workload page. The image page accepts the risk of the image in the whole cluster: the form without a workload offers only the image scopes, and the page counts only cluster-wide exceptions without namespace, label or resource limits as covering the image (`imageCveExceptions`). Workloads that share an image share its report, into which kubevuln writes the exceptions of the workload it scanned, so ignored matches count as accepted only for a workload whose own exceptions cover them
- The exception edit form keeps the fields of an entry that it does not show (aliases, per-entry `expiresAt`, `subcomponents`)
- Custom compliance frameworks are stored as ConfigMaps in the Kubescape operator namespace

### Data Flow Patterns

#### API Integration
- **Custom Resources**: All data comes from Kubescape CRDs in `spdx.softwarecomposition.kubescape.io/v1beta1` API group
- **Pagination**: Large datasets handled with continuation tokens (`src/query.ts`). With allowed namespaces, each namespace is read to its last page
- **fullSpec**: the Kubescape storage returns only the metadata of listed objects, unless the list asks for `resourceVersion=fullSpec` (`paginatedListQuery` does, `listQuery` does not). Use `listQuery` for lists that only need names, labels and annotations; anything that reads `spec` needs `paginatedListQuery`
- **Multi-cluster**: list pages query all selected clusters (`useItemsInClusters` in `src/common/clusters.ts`) and link to details with `activeCluster`; detail and editor pages use the cluster in the URL
- **Namespace filtering**: Respects Headlamp's namespace access controls

#### Data Relationships
```
Vulnerability Flow: Namespace → VulnerabilitySummary → VulnerabilityManifestSummary → VulnerabilityManifest → SBOMSyft
Configuration Flow: Namespace → ConfigurationScanSummary → WorkloadConfigurationScanSummary → WorkloadConfigurationScan
```

### WASM Integration

#### Purpose
Provides CEL evaluation for Kubernetes ValidatingAdmissionPolicies without requiring cluster deployment.

#### Architecture
- **Go Backend** (`go/cmd/main.go`): Compiled to WASM, implements CEL evaluation engine
- **JavaScript Bridge** (`src/wasm/initWasmModule.ts`): Initializes WASM module and exposes functions
- **Build Process**: `GOOS=js GOARCH=wasm go build -o dist/main.wasm cmd/main.go`

#### Key Functions
- `AdmissionEval`: Evaluates admission policies against test resources
- Handles match constraints, CEL expressions, and policy validation
- Expressions are parsed but not type-checked, and the Kubernetes CEL libraries (quantity, regex, ...) are not included
- `RuleEval`: Evaluates runtime detection rules against mock events and profiles

### External Dependencies

#### Kubescape Resources (Downloaded via Makefile)
- **Control Definitions**: From regolibrary releases, transformed to TypeScript modules
- **Frameworks**: Security frameworks definitions with controls removed (available separately)
- **Policy Files**: ValidatingAdmissionPolicy definitions and test resources
- **WASM Runtime**: Go's `wasm_exec.js`, copied from the Go toolchain that builds `main.wasm`

#### Key Files Generated
- `public/controls.json`, `public/rego-rules.json`: Security control definitions and rules
- `public/frameworks.json`: Compliance framework definitions (controls removed)
- `public/validating-admission-policies.yaml`, `public/basic-control-configuration.yaml`: Sample policies and their parameters
- `public/vap-test-files.yaml`, `public/vap-test-files-index.yaml`: Test resources for policy validation
- `src/wasm/wasm_exec.js`: WASM execution runtime (committed)
- `dist/main.wasm`: WASM module for policy evaluation

The files in `public/` are shipped with the plugin and fetched at runtime from the plugin URL (`src/rego/RegoDataProvider.tsx`, `src/common/PluginHelper.ts`).

## Important Development Notes

- **Permissions**: actions that change the cluster are wrapped in `Permitted` / `PermittedIconButton` (`src/common/permissions.tsx`), which ask a SelfSubjectAccessReview and disable the action with an explanation when it is denied. An unanswered check leaves the action enabled. Answers are cached per cluster for the session, so tests that need another answer use another cluster name

- **Big clusters**: per-control results (`countScans`, `controlComplianceScore`, ...) come from an index built once per array of scans (`workload-scanning.ts`); call `invalidateControlStats()` after changing `exceptedByPolicy` marks in place. Aggregate with maps keyed by id, not `find`/`some` inside loops, memoise derived table data, and give table columns plain values (`accessorFn`) with JSX in `Cell`, which only renders for the rows on the page. The vulnerability cache keeps only the declared fields of each match (`toImageScan`)

- **Tables**: use `src/common/Table.tsx` instead of Headlamp's `Table`; it keeps the sorting of each table for the session. Headlamp names a column without an `id` by its index, so give the columns used in `initialState.sorting` an explicit `id`. `onRowClick` makes the rows clickable: Headlamp's table replaces the table-wide `muiTableBodyCellProps` with its own and renders rows with `display: contents`, so the click is set on the cells of each column (`withRowClick`). Headlamp only redraws a cell when its value changes, so a cell keeps the handlers of the item it first showed: tables with clickable rows or row actions need a `getRowId` per item, and action columns a value per item. The table also keeps the values of a row until `data` changes, so values that arrive later, such as the image versions, must be part of the rows (new row objects) rather than read from state in an `accessorFn`

- **Prerequisites**: Requires Kubescape operator installed in target cluster with `continuousScan: enable`
- **Testing**: Plugin requires live Kubernetes cluster with Kubescape CRDs for full functionality
- **Multi-cluster**: Plugin supports Headlamp's multi-cluster features with backward compatibility
- **Security**: All Kubernetes API access goes through Headlamp's secure proxy, no direct cluster access
- **Build Dependencies**: WASM build requires Go installation; frontend build only requires npm
- **File names**: no two modules in a folder may differ only in case (`relearn.ts` next to `Relearn.tsx`): on Windows `./Relearn` then resolves to `relearn.ts`, and the import is undefined
- **API Groups**: Most CRDs use `spdx.softwarecomposition.kubescape.io/v1beta1`. The `SecurityException` and `ClusterSecurityException` CRDs use `kubescape.io/v1beta1` (operator-owned, defined in `src/softwarecomposition/SecurityException.ts`).

## Release Process

Use GitHub workflow `pre-release`:
1. Specify version (e.g., v1.0.0)
2. Workflow builds tar and container image
3. Updates `artifacthub-pkg.yml` and `package.json`
4. Generates tag and release
5. Manually update release notes and unflag pre-release