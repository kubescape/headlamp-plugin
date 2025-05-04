// https://github.com/kubescape/kubescape/tree/master/examples/exceptions
// PostureExceptionPolicy defines the format for the exception file used by Kubescape

export type PostureExceptionPolicyActions = 'alertOnly';

export type PolicyType = 'postureExceptionPolicy';

export interface PostureExceptionPolicy {
  name: string;
  policyType?: PolicyType;
  creationTime?: Date;
  actions?: PostureExceptionPolicyActions[];
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
  controlName?: string; // TODO remove
  controlID?: string;
}
