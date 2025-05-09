// https://github.com/kubescape/kubescape/tree/master/examples/exceptions
// PostureExceptionPolicy defines the format for the exception file used by Kubescape

export type ExceptionPolicyActions = 'alertOnly';

export type PolicyType = 'postureExceptionPolicy';

export interface ExceptionPolicy {
  name: string;
  policyType?: PolicyType;
  creationTime?: Date;
  actions?: ExceptionPolicyActions[];
  resources: ResourceDesignator[];
  posturePolicies?: PosturePolicy[];
  reason?: string | null;
  createdBy?: string;
  updatedTime?: string;
}

export interface ResourceDesignator {
  designatorType: string; // Attributes
  attributes: { [key: string]: string }; // Attributes that describe the targets
}
export interface PosturePolicy {
  [key: string]: string | undefined;
  frameworkName?: string;
  controlID?: string;
}

export interface ExceptionPolicyGroup {
  name: string;
  description?: string;
  exceptionPolicies: ExceptionPolicy[];
  configmapManifestName?: string;
}
