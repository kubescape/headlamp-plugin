// https://github.com/kubescape/storage/tree/main/pkg/apis/softwarecomposition
// Only fields as used in this project are declared

import { Metadata } from './Metadata';

export interface GeneratedNetworkPolicy {
  metadata: Metadata;
  // a NetworkPolicy
  spec: {
    apiVersion?: string;
    kind?: string;
    metadata?: {
      name?: string;
      namespace?: string;
      labels?: { [key: string]: string };
      annotations?: { [key: string]: string };
    };
    spec: NetworkPolicy.NetworkPolicySpec;
  };
  policyRef: PolicyRef[];
}

export interface PolicyRef {
  dns: string;
  ipBlock: string;
  name: string;
  originalIP: string;
  server: string;
}

// converted from https://github.com/kubernetes/api/blob/master/networking/v1/types.go
export namespace NetworkPolicy {
  // PolicyType string describes the NetworkPolicy type
  type PolicyType = 'Ingress' | 'Egress';

  // NetworkPolicySpec provides the specification of a NetworkPolicy
  export interface NetworkPolicySpec {
    podSelector: LabelSelector;
    ingress?: IngressRule[];
    egress?: EgressRule[];
    policyTypes?: PolicyType[];
  }

  // NetworkPolicyIngressRule describes a particular set of traffic that is allowed to the pods
  // matched by a NetworkPolicySpec's podSelector. The traffic must match both ports and from.
  export interface IngressRule {
    ports?: Port[];
    from?: Peer[];
  }

  // NetworkPolicyEgressRule describes a particular set of traffic that is allowed out of pods
  // matched by a NetworkPolicySpec's podSelector. The traffic must match both ports and to.
  export interface EgressRule {
    ports?: Port[];
    to?: Peer[];
  }

  // NetworkPolicyPort describes a port to allow traffic on
  export interface Port {
    protocol?: string;
    port?: string;
    endPort?: number;
  }

  // IPBlock describes a particular CIDR (Ex. "192.168.1.0/24","2001:db8::/64") that is allowed
  // to the pods matched by a NetworkPolicySpec's podSelector. The except entry describes CIDRs
  // that should not be included within this rule.
  export interface IPBlock {
    cidr: string;
    except?: string[];
  }

  // NetworkPolicyPeer describes a peer to allow traffic to/from. Only certain combinations of
  // fields are allowed
  export interface Peer {
    podSelector?: LabelSelector;
    namespaceSelector?: LabelSelector;
    ipBlock?: IPBlock;
  }

  export interface LabelSelector {
    // matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels
    // map is equivalent to an element of matchExpressions, whose key field is "key", the
    // operator is "In", and the values array contains only "value". The requirements are ANDed.
    matchLabels?: { [key: string]: string };

    // matchExpressions is a list of label selector requirements. The requirements are ANDed.
    matchExpressions?: LabelSelectorRequirement[];
  }

  // A label selector requirement is a selector that contains values, a key, and an operator that
  // relates the key and values.
  export interface LabelSelectorRequirement {
    // key is the label key that the selector applies to.
    key: string;
    // operator represents a key's relationship to a set of values.
    // Valid operators are In, NotIn, Exists and DoesNotExist.
    operator: LabelSelectorOperator;
    // values is an array of string values. If the operator is In or NotIn,
    // the values array must be non-empty. If the operator is Exists or DoesNotExist,
    // the values array must be empty. This array is replaced during a strategic
    // merge patch.
    values?: string[];
  }

  // Assuming LabelSelectorOperator is an enum, we can define it as:
  export enum LabelSelectorOperator {
    In = 'In',
    NotIn = 'NotIn',
    Exists = 'Exists',
    DoesNotExist = 'DoesNotExist',
  }
}
