// Types for SecurityException CRD (kubescape.io/v1beta1 compatible)

export interface LabelSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  values?: string[];
}

export interface ResourceMatch {
  apiGroup?: string;
  kind: string;
  name?: string;
}

export interface SecurityExceptionMatchSpec {
  namespaceSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: LabelSelectorRequirement[];
  };
  objectSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: LabelSelectorRequirement[];
  };
  resources?: ResourceMatch[];
  images?: string[];
}

export interface PostureException {
  controlID: string;
  frameworkName?: string;
  action: 'ignore' | 'alert_only';
}

export type VulnerabilityStatus = 'not_affected' | 'fixed' | 'under_investigation';

export type VulnerabilityJustification =
  | 'component_not_present'
  | 'vulnerable_code_not_present'
  | 'vulnerable_code_cannot_be_controlled_by_adversary'
  | 'vulnerable_code_not_in_execute_path'
  | 'inline_mitigations_already_exist';

export interface VulnerabilityRef {
  id: string;
  aliases?: string[];
}

export interface VulnerabilityException {
  vulnerability: VulnerabilityRef;
  status: VulnerabilityStatus;
  justification?: VulnerabilityJustification;
  impactStatement?: string;
  expiredOnFix?: boolean;
}

export interface SecurityExceptionSpec {
  author?: string;
  reason?: string;
  expiresAt?: string;
  match?: SecurityExceptionMatchSpec;
  posture?: PostureException[];
  vulnerabilities?: VulnerabilityException[];
}

export interface SecurityException {
  apiVersion: 'kubescape.io/v1beta1' | string;
  kind: 'SecurityException';
  metadata: { name: string; namespace: string; creationTimestamp?: string; uid?: string };
  spec: SecurityExceptionSpec;
}

export interface ClusterSecurityException {
  apiVersion: 'kubescape.io/v1beta1' | string;
  kind: 'ClusterSecurityException';
  metadata: { name: string; creationTimestamp?: string; uid?: string };
  spec: SecurityExceptionSpec;
}
