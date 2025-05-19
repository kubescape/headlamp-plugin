// https://github.com/kubescape/storage/tree/main/pkg/apis/softwarecomposition
// Only fields as used in this project are declared

import { Metadata } from './Metadata';

export interface WorkloadConfigurationScan {
  metadata: Metadata;
  spec: {
    controls: WorkloadConfigurationScan.Controls;
    relatedObjects: WorkloadConfigurationScan.RelatedObject[];
  };
  exceptedByPolicy: boolean; // maintained from the UI
}

export namespace WorkloadConfigurationScan {
  export interface Controls {
    [key: string]: Control;
  }

  export interface Control {
    controlID: string;

    name: string;
    severity: {
      scoreFactor: number;
      severity: string;
    };
    status: {
      status: string;
    };
    rules: Rule[];

    exceptedByPolicy: boolean; // maintained from the UI
  }

  export interface RelatedObject {
    namespace: string;
    apiGroup: string;
    apiVersion: string;
    kind: string;
    name: string;
  }
  export interface Rule {
    name: string;
    paths: RulePath[];
  }

  export interface RulePath {
    fixPath: string;
    failedPath: string;
    fixPathValue: string;
  }
}
