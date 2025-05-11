/* 
  Registration of menu and routes in headlamp. 
*/
import {
  // @ts-ignore
  registerDetailsViewSectionsProcessor,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';

const kubescape = 'kubescape';
const vulnerabilities: string = 'vulnerabilities';
const compliance: string = 'compliance';

namespace RoutingPath {
  export const ComplianceView = '/kubescape/compliance';
  export const KubescapeConfigurationScanNamespaceSummary = '/kubescape/compliance/:namespace';
  export const KubescapeWorkloadConfigurationScanDetails =
    '/kubescape/compliance/namespaces/:namespace/:name';
  export const KubescapeControlResults = '/kubescape/compliance/controls/:control';
  export const KubescapeWorkloadConfigurationScanFixes =
    '/kubescape/compliance/namespaces/:namespace/:name/:control';
  export const VulnerabilitiesNamespaceSummary = '/kubescape/vulnerabilities/:namespace';
  export const KubescapeVulnerabilityDetails =
    '/kubescape/vulnerabilities/namespaces/:namespace/:name';
  export const KubescapeCVEResults = '/kubescape/vulnerabilities/cves/:cve';
  export const ImageVulnerabilityDetails = '/kubescape/vulnerabilities/images/:namespace/:name';
  export const KubescapeFrameworks = '/kubescape/frameworks';
  export const FrameworkControls = '/kubescape/frameworks/:name/controls';
  export const FrameworkNew = '/kubescape/framework';
  export const FrameworkEdit = '/kubescape/framework/:name';
  export const ExceptionGroupNew = '/kubescape/exception-group';
  export const ExceptionGroupEdit = '/kubescape/exception-group/:name';
  export const ExceptionGroups = '/kubescape/exception-groups';
  export const KubescapeVulnerabilities = '/kubescape/vulnerabilities';
  export const KubescapeNetworkPolicies = '/kubescape/networkpolicies';
  export const KubescapeNetworkPolicyDiagram = '/kubescape/networkpolicies/:namespace/:name';
  export const KubescapeSBOMDetails = '/kubescape/sbom/:namespace/:name';
  export const VAP = '/kubescape/vap';
  export const ApplicationProfiles = '/kubescape/applicationprofiles';
  export const RuntimeDetection = '/kubescape/runtimedetection/:namespace/:name';
}

export namespace RoutingName {
  export const ApplicationProfiles = 'Application Profile';
  export const ComplianceView = 'Compliance';
  export const ImageVulnerabilityDetails = 'Image Vulnerabilities';
  export const KubescapeConfigurationScanNamespaceSummary = 'Namespace Configuration Scan';
  export const KubescapeControlResults = 'Control Configuration Scan';
  export const KubescapeCVEResults = 'CVE Vulnerabilities';
  export const KubescapeFrameworks = 'Frameworks';
  export const FrameworkControls = 'FrameworkControls';
  export const FrameworkNew = 'New Framework';
  export const FrameworkEdit = 'Edit Framework';
  export const KubescapeNetworkPolicies = 'Network Policies';
  export const KubescapeNetworkPolicyDiagram = 'Network Policy Diagram';
  export const ExceptionGroupNew = 'New Kubescape Exceptions';
  export const ExceptionGroupEdit = 'Edit Kubescape Exceptions';
  export const ExceptionGroup = 'Kubescape Exceptions';
  export const ExceptionGroups = 'Kubescape Exception Groups';
  export const KubescapeSBOMDetails = 'Software Bill of Materials';
  export const KubescapeVulnerabilityDetails = 'Vulnerability';
  export const KubescapeVulnerabilities = 'Vulnerabilities';
  export const KubescapeWorkloadConfigurationScanDetails = 'Configuration Scan';
  export const KubescapeWorkloadConfigurationScanFixes = 'Workload Configuration Fixes';
  export const RuntimeDetection = 'Runtime Detection';
  export const VAP = 'Validation Admission Policies';
  export const VulnerabilitiesNamespaceSummary = 'Namespace Vulnerabilities';
}

// Kubescape main sidebar
registerSidebarEntry({
  parent: null,
  name: kubescape,
  label: 'Kubescape',
  icon: 'mdi:shield-search',
  url: RoutingPath.ComplianceView,
});

registerSidebarEntry({
  parent: kubescape,
  name: compliance,
  label: 'Compliance',
  url: RoutingPath.ComplianceView,
});

registerSidebarEntry({
  parent: kubescape,
  name: vulnerabilities,
  label: 'Vulnerabilities',
  url: RoutingPath.KubescapeVulnerabilities,
});

registerSidebarEntry({
  parent: kubescape,
  name: 'networkpolicies',
  label: 'Network Policies',
  url: RoutingPath.KubescapeNetworkPolicies,
});

registerSidebarEntry({
  parent: kubescape,
  name: 'vap-policies',
  label: 'Policy Playground',
  url: RoutingPath.VAP,
});

registerSidebarEntry({
  parent: kubescape,
  name: 'runtime-detection',
  label: 'Runtime Detection',
  url: RoutingPath.ApplicationProfiles,
});

registerSidebarEntry({
  parent: kubescape,
  name: 'exceptions',
  label: 'Exceptions',
  url: RoutingPath.ExceptionGroups,
});

registerSidebarEntry({
  parent: kubescape,
  name: 'frameworks',
  label: 'Frameworks',
  url: RoutingPath.KubescapeFrameworks,
});

import ComplianceView from './compliance/Compliance';

registerRoute({
  path: RoutingPath.ComplianceView,
  sidebar: compliance,
  component: () => <ComplianceView />,
  exact: true,
  name: RoutingName.ComplianceView,
});

import KubescapeConfigurationScanNamespaceSummary from './compliance/NamespaceSummary';

registerRoute({
  path: RoutingPath.KubescapeConfigurationScanNamespaceSummary,
  sidebar: compliance,
  component: () => <KubescapeConfigurationScanNamespaceSummary />,
  exact: true,
  name: RoutingName.KubescapeConfigurationScanNamespaceSummary,
});

import KubescapeWorkloadConfigurationScanDetails from './compliance/WorkloadScanDetails';

registerRoute({
  path: RoutingPath.KubescapeWorkloadConfigurationScanDetails,
  sidebar: compliance,
  component: () => <KubescapeWorkloadConfigurationScanDetails />,
  exact: true,
  name: RoutingName.KubescapeWorkloadConfigurationScanDetails,
});

import KubescapeControlResults from './compliance/ControlResults';

registerRoute({
  path: RoutingPath.KubescapeControlResults,
  sidebar: compliance,
  component: () => <KubescapeControlResults />,
  exact: true,
  name: RoutingName.KubescapeControlResults,
});

import { ExceptionGroupEdit, ExceptionGroupNew } from './exceptions/ExceptionGroup';

registerRoute({
  path: RoutingPath.ExceptionGroupEdit,
  sidebar: compliance,
  component: () => <ExceptionGroupEdit />,
  exact: true,
  name: RoutingName.ExceptionGroupEdit,
});

registerRoute({
  path: RoutingPath.ExceptionGroupNew,
  sidebar: compliance,
  component: () => <ExceptionGroupNew />,
  exact: true,
  name: RoutingName.ExceptionGroupNew,
});

import { ExceptionGroupList } from './exceptions/ExceptionGroups';

registerRoute({
  path: RoutingPath.ExceptionGroups,
  sidebar: compliance,
  component: () => <ExceptionGroupList />,
  exact: true,
  name: RoutingName.ExceptionGroups,
});

import KubescapeWorkloadConfigurationScanFixes from './compliance/WorkloadScanFixes';

registerRoute({
  path: RoutingPath.KubescapeWorkloadConfigurationScanFixes,
  sidebar: compliance,
  component: () => <KubescapeWorkloadConfigurationScanFixes />,
  exact: true,
  name: RoutingName.KubescapeWorkloadConfigurationScanFixes,
});

import KubescapeVulnerabilities from './vulnerabilities/Vulnerabilities';

registerRoute({
  path: RoutingPath.KubescapeVulnerabilities,
  sidebar: vulnerabilities,
  component: () => <KubescapeVulnerabilities />,
  exact: true,
  name: RoutingName.KubescapeVulnerabilities,
});

import VulnerabilitiesNamespaceSummary from './vulnerabilities/NamespaceSummary';

registerRoute({
  path: RoutingPath.VulnerabilitiesNamespaceSummary,
  sidebar: vulnerabilities,
  component: () => <VulnerabilitiesNamespaceSummary />,
  exact: true,
  name: RoutingName.VulnerabilitiesNamespaceSummary,
});

import KubescapeVulnerabilityDetails from './vulnerabilities/WorkloadScanDetails';

registerRoute({
  path: RoutingPath.KubescapeVulnerabilityDetails,
  sidebar: vulnerabilities,
  component: () => <KubescapeVulnerabilityDetails />,
  exact: true,
  name: RoutingName.KubescapeVulnerabilityDetails,
});

import KubescapeCVEResults from './vulnerabilities/CVEResults';

registerRoute({
  path: RoutingPath.KubescapeCVEResults,
  sidebar: vulnerabilities,
  component: () => <KubescapeCVEResults />,
  exact: true,
  name: RoutingName.KubescapeCVEResults,
});

import ImageVulnerabilityDetails from './vulnerabilities/ImageDetails';

registerRoute({
  path: RoutingPath.ImageVulnerabilityDetails,
  sidebar: vulnerabilities,
  component: () => <ImageVulnerabilityDetails />,
  exact: true,
  name: RoutingName.ImageVulnerabilityDetails,
});

import SBOMDetail from './vulnerabilities/SBOMDetail';

registerRoute({
  path: RoutingPath.KubescapeSBOMDetails,
  sidebar: vulnerabilities,
  component: () => <SBOMDetail />,
  exact: true,
  name: RoutingName.KubescapeSBOMDetails,
});

import KubescapeNetworkPolicies from './networkpolicies/NetworkPolicies';

registerRoute({
  path: RoutingPath.KubescapeNetworkPolicies,
  sidebar: 'networkpolicies',
  component: () => <KubescapeNetworkPolicies />,
  exact: true,
  name: RoutingName.KubescapeNetworkPolicies,
});

import KubescapeNetworkPolicyDiagram from './networkpolicies/Diagram';

registerRoute({
  path: RoutingPath.KubescapeNetworkPolicyDiagram,
  sidebar: 'networkpolicies',
  component: () => <KubescapeNetworkPolicyDiagram />,
  exact: true,
  name: RoutingName.KubescapeNetworkPolicyDiagram,
});

import { ValidatingAdmissionPolicyEditor } from './validating-admission/ValidatingAdmissionPolicy';

registerRoute({
  path: RoutingPath.VAP,
  sidebar: 'vap-policies',
  component: () => <ValidatingAdmissionPolicyEditor />,
  exact: true,
  name: RoutingName.VAP,
});

import { ApplicationProfiles } from './runtimedetection/ApplicationProfiles';

registerRoute({
  path: RoutingPath.ApplicationProfiles,
  sidebar: 'runtime-detection',
  component: () => <ApplicationProfiles />,
  exact: true,
  name: RoutingName.ApplicationProfiles,
});

import { RuntimeDetection } from './runtimedetection/RuntimeDetection';

registerRoute({
  path: RoutingPath.RuntimeDetection,
  sidebar: 'runtime-detection',
  component: () => <RuntimeDetection />,
  exact: true,
  name: RoutingName.RuntimeDetection,
});

import { FrameworksPage } from './framework/FrameworkList';

registerRoute({
  path: RoutingPath.KubescapeFrameworks,
  sidebar: 'frameworks',
  component: () => <FrameworksPage />,
  exact: true,
  name: RoutingName.KubescapeFrameworks,
});

import { FrameworkControls } from './framework/FrameworkControls';

registerRoute({
  path: RoutingPath.FrameworkControls,
  sidebar: 'frameworks',
  component: () => <FrameworkControls />,
  exact: true,
  name: RoutingName.FrameworkControls,
});

import { FrameworkEdit, FrameworkNew } from './framework/FrameworkEdit';

registerRoute({
  path: RoutingPath.FrameworkNew,
  sidebar: 'frameworks',
  component: () => <FrameworkNew />,
  exact: true,
  name: RoutingName.FrameworkNew,
});

registerRoute({
  path: RoutingPath.FrameworkEdit,
  sidebar: 'frameworks',
  component: () => <FrameworkEdit />,
  exact: true,
  name: RoutingName.FrameworkEdit,
});

// Detail panel for workloads
import addKubescapeWorkloadSection from './sections/WorkloadSection';

registerDetailsViewSectionsProcessor(addKubescapeWorkloadSection);

// Detail panel for namespaces
import addKubescapeNamespaceSection from './sections/NamespaceSection';

registerDetailsViewSectionsProcessor(addKubescapeNamespaceSection);
