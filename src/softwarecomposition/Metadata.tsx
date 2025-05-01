export interface StringDict {
  [key: string]: string;
}

export interface Metadata {
  creationTimestamp: string;
  name: string;
  namespace: string;
  cluster: string; // for multi cluster support
  annotations: StringDict;
  labels: StringDict;
}
