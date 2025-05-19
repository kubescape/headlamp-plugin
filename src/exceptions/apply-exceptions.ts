import { Control } from '../rego';
import { WorkloadConfigurationScan } from '../softwarecomposition/WorkloadConfigurationScan';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { KubernetesObject } from '../types/KubernetesObject';
import { ExceptionPolicy, ExceptionPolicyGroup, PosturePolicy } from './ExceptionPolicy';

export function applyExceptionsToWorkloadScanData(
  workloadScans: WorkloadConfigurationScanSummary[],
  frameWorkName: string,
  exceptionGroup: ExceptionPolicyGroup | undefined
) {
  const postureExceptionPolicies = exceptionGroup?.exceptionPolicies ?? [];

  for (const w of workloadScans) {
    Object.entries(w.spec.controls).forEach(([key, value]) => {
      value.exceptedByPolicy = isControlMatchedInException(
        key,
        value,
        frameWorkName,
        w,
        postureExceptionPolicies
      );
    });

    w.exceptedByPolicy = isResourceMatchedInException(w, postureExceptionPolicies);
  }
}

export function applyExceptionsToWorkloadScan(
  workloadScan: WorkloadConfigurationScan,
  frameWorkName: string,
  exceptionGroup: ExceptionPolicyGroup | undefined
) {
  const postureExceptionPolicies = exceptionGroup?.exceptionPolicies ?? [];

  if (!postureExceptionPolicies) {
    return;
  }

  Object.entries(workloadScan.spec.controls).forEach(([key, value]) => {
    value.exceptedByPolicy = isControlMatchedInException(
      key,
      { ...value } as WorkloadConfigurationScanSummary.Control,
      frameWorkName,
      workloadScan,
      postureExceptionPolicies
    );
  });

  workloadScan.exceptedByPolicy = isResourceMatchedInException(
    workloadScan,
    postureExceptionPolicies
  );
}

function resourceAttributesMatch(
  attributes: { [key: string]: string },
  workloadScan: KubernetesObject
) {
  if (Object.keys(attributes).length === 0) {
    return false;
  }

  for (const [key, value] of Object.entries(attributes)) {
    let compareValue: string;
    if (!value) {
      continue;
    }
    switch (key) {
      case 'kind':
        compareValue = workloadScan.metadata.labels['kubescape.io/workload-kind'];
        break;
      case 'name':
        compareValue = workloadScan.metadata.labels['kubescape.io/workload-name'];
        break;
      case 'namespace':
        compareValue = workloadScan.metadata.namespace;
        break;
      default:
        // TODO get the resource and match on labels
        return false;
    }

    if (!new RegExp(value).test(compareValue)) {
      return false;
    }
  }
  return true;
}

function policyAttributesMatch(
  posturePolicy: PosturePolicy,
  frameworkName: string,
  controlName: string,
  control: WorkloadConfigurationScanSummary.Control
) {
  if (Object.keys(posturePolicy).length === 0) {
    return false;
  }

  for (const [key, value] of Object.entries(posturePolicy)) {
    let compareValue: string;
    if (!value) {
      continue;
    }

    switch (key) {
      case 'controlID':
        compareValue = control.controlID;
        break;
      case 'frameworkName':
        compareValue = frameworkName;
        break;
      case 'controlName':
        compareValue = controlName;
        break;
      default:
        return false;
    }
    if (!new RegExp(value).test(compareValue)) {
      return false;
    }
  }

  return true;
}

function isResourceMatchedInException(workloadScan: KubernetesObject, policies: ExceptionPolicy[]) {
  return policies.some(
    policy =>
      (!policy.posturePolicies || policy.posturePolicies.length === 0) &&
      policy.resources?.some(r => resourceAttributesMatch(r.attributes, workloadScan))
  );
}

function isControlMatchedInException(
  controlName: string,
  control: WorkloadConfigurationScanSummary.Control,
  frameworkName: string,
  workloadScan: KubernetesObject,
  policies: ExceptionPolicy[]
) {
  return policies.some(
    policy =>
      policy.posturePolicies?.some(pp =>
        policyAttributesMatch(pp, frameworkName, controlName, control)
      ) && policy.resources.some(r => resourceAttributesMatch(r.attributes, workloadScan))
  );
}

export function countExcludedResources(workloadScanData: WorkloadConfigurationScanSummary[]) {
  return workloadScanData.filter(w => w.exceptedByPolicy).length;
}

export function countExcludedControls(workloadScanData: WorkloadConfigurationScanSummary[]) {
  return workloadScanData
    .filter(w => !w.exceptedByPolicy)
    .reduce(
      (excluded, w) =>
        excluded + Object.values(w.spec.controls).filter(scan => scan.exceptedByPolicy).length,
      0
    );
}

export function countExcludedWorkloadsForControl(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  let excluded: number = 0;
  workloadScanData.forEach(w => {
    Object.values(w.spec.controls).forEach(scan => {
      if (scan.controlID === control.controlID && (w.exceptedByPolicy || scan.exceptedByPolicy))
        excluded++;
    });
  });
  return excluded;
}
