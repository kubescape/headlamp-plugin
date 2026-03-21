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
npm run test           # Run tests
```

### WASM and External Dependencies
```bash
make download          # Download all external dependencies (WASM runtime, controls, test files)
make build             # Build Go code to WASM (requires Go)
make local             # Build and copy to local Headlamp plugins directory
make controls-download # Download Kubescape control definitions
make wasm-download     # Download WASM execution runtime
make kubescape-download # Download policy and test files
```

## Architecture Overview

### Plugin Structure
The plugin integrates with Headlamp through `@kinvolk/headlamp-plugin` framework using:
- **Sidebar registration**: Adds navigation entries for main features
- **Route registration**: Defines URL routes for each feature module
- **Detail view extensions**: Adds security information to existing Kubernetes resource pages
- **Multi-cluster support**: Works with Headlamp's cluster context switching

### Core Feature Modules

#### 1. Compliance (`src/compliance/`)
- Configuration scanning and compliance reporting
- Uses `WorkloadConfigurationScan` and `WorkloadConfigurationScanSummary` CRDs
- Main components: `Compliance.tsx`, `WorkloadScanDetails.tsx`, `ControlResults.tsx`

#### 2. Vulnerabilities (`src/vulnerabilities/`)  
- Container image vulnerability scanning
- Uses `VulnerabilityManifest`, `VulnerabilityManifestSummary`, `SBOMSyft` CRDs
- Main components: `Vulnerabilities.tsx`, `CVEResults.tsx`, `ImageDetails.tsx`

#### 3. Network Policies (`src/networkpolicies/`)
- Network policy visualization with flow diagrams
- Uses `@xyflow/react` and `@dagrejs/dagre` for diagram rendering
- Main components: `NetworkPolicies.tsx`, `Diagram.tsx`

#### 4. Validating Admission Policies (`src/validating-admission/`)
- Policy playground for testing admission policies
- Uses WASM module for CEL (Common Expression Language) evaluation
- Main components: `ValidatingAdmissionPolicy.tsx`, `EvaluationResultsTables.tsx`

#### 5. Runtime Detection (`src/runtimedetection/`)
- Runtime security monitoring and application profiling
- Uses `ApplicationProfile` CRDs
- Main components: `ApplicationProfiles.tsx`, `RuntimeDetection.tsx`

#### 6. Exceptions (`src/exceptions/`) & Frameworks (`src/framework/`)
- Managing security exceptions and custom compliance frameworks
- Stored as ConfigMaps in Kubernetes cluster

### Data Flow Patterns

#### API Integration
- **Custom Resources**: All data comes from Kubescape CRDs in `spdx.softwarecomposition.kubescape.io/v1beta1` API group
- **Pagination**: Large datasets handled with continuation tokens (`src/query.ts`)
- **Multi-cluster**: Supports querying across multiple clusters simultaneously
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

### External Dependencies

#### Kubescape Resources (Downloaded via Makefile)
- **Control Definitions**: From regolibrary releases, transformed to TypeScript modules
- **Frameworks**: Security frameworks definitions with controls removed (available separately)
- **Policy Files**: ValidatingAdmissionPolicy definitions and test resources
- **WASM Runtime**: Go's WASM execution JavaScript from golang/go repository

#### Key Files Generated
- `src/rego/controls.ts`: Security control definitions
- `src/rego/frameworks.ts`: Compliance framework definitions  
- `dist/main.wasm`: WASM module for policy evaluation
- `dist/vap-test-files.yaml`: Test resources for policy validation

## Important Development Notes

- **Prerequisites**: Requires Kubescape operator installed in target cluster with `continuousScan: enable`
- **Testing**: Plugin requires live Kubernetes cluster with Kubescape CRDs for full functionality
- **Multi-cluster**: Plugin supports Headlamp's multi-cluster features with backward compatibility
- **Security**: All Kubernetes API access goes through Headlamp's secure proxy, no direct cluster access
- **Build Dependencies**: WASM build requires Go installation; frontend build only requires npm

## Release Process

Use GitHub workflow `pre-release`:
1. Specify version (e.g., v1.0.0)
2. Workflow builds tar and container image
3. Updates `artifacthub-pkg.yml` and `package.json`
4. Generates tag and release
5. Manually update release notes and unflag pre-release