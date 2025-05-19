// https://github.com/kubescape/storage/tree/main/pkg/apis/softwarecomposition
// Only fields as used in this project are declared

import { Metadata } from './Metadata';
export interface WorkloadConfigurationScanSummary {
  metadata: Metadata;
  spec: {
    controls: WorkloadConfigurationScanSummary.Controls;
    severities: WorkloadConfigurationScanSummary.Severities;
  };
  exceptedByPolicy: boolean; // maintained from the UI
}

export namespace WorkloadConfigurationScanSummary {
  export enum Status {
    Failed = 'failed',
    Passed = 'passed',
  }
  export interface Controls {
    [key: string]: Control;
  }
  export interface Control {
    controlID: string;

    severity: {
      scoreFactor: number;
      severity: string;
    };
    status: {
      status: Status;
    };
    exceptedByPolicy: boolean; // maintained from the UI
  }
  export interface Severities {
    critical: number;
    high: number;
    low: number;
    medium: number;
    unknown: number;
  }
}
