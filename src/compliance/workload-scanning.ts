import YAML from 'yaml';
import { getItemFromLocalStorage, KubescapeSettings } from '../common/webStorage';
import { PostureExceptionPolicy, PosturePolicy } from '../exceptions/PostureExceptionPolicy';
import { Control, FrameWork } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

/**
 * Filters the given workload scans based on the given frameWork and postureExceptionPolicies.
 *
 * It filters the controls in each workload scan to only include those that belong to the given frameWork.
 * It also filters the controls and resources in each workload scan to exclude those that are matched by the given postureExceptionPolicies.
 *
 * @param workloadScans - The list of workload scans to filter.
 * @param frameWork - The frameWork to filter by.
 * @returns The filtered list of workload scans.
 */
export function filterWorkloadScanData(
  workloadScans: WorkloadConfigurationScanSummary[],
  frameWork: FrameWork
): [WorkloadConfigurationScanSummary[], number, number] {
  const filteredWorkloadScans: WorkloadConfigurationScanSummary[] = [];

  const exceptions = getItemFromLocalStorage<string>(KubescapeSettings.Exceptions);
  const postureExceptionPolicies = exceptions ? YAML.parse(exceptions) : undefined;
  let controlsExcepted = 0;

  for (const workloadScan of workloadScans) {
    const w: WorkloadConfigurationScanSummary = structuredClone(workloadScan);

    if (frameWork) {
      w.spec.controls = Object.fromEntries(
        Object.entries(workloadScan.spec.controls).filter(([, value]) =>
          frameWork.controls.find(control => control.controlID === value.controlID)
        )
      );
    }

    // Filter controls by postureExceptionPolicies
    if (postureExceptionPolicies) {
      const numControls = Object.entries(w.spec.controls).length;
      w.spec.controls = Object.fromEntries(
        Object.entries(w.spec.controls).filter(
          ([key, value]) =>
            !isControlMatchedInException(key, value, frameWork.name, w, postureExceptionPolicies)
        )
      );
      controlsExcepted += numControls - Object.entries(w.spec.controls).length;
    }
    filteredWorkloadScans.push(w);
  }

  // Filter resources by postureExceptionPolicies
  if (postureExceptionPolicies) {
    const numResources = filteredWorkloadScans.length;
    const workloadScans = filteredWorkloadScans.filter(
      w => !isResourceMatchedInException(w, postureExceptionPolicies)
    );

    return [workloadScans, numResources - workloadScans.length, controlsExcepted];
  }

  return [filteredWorkloadScans, 0, controlsExcepted];
}

function resourceAttributesMatch(
  attributes: { [key: string]: string },
  workloadScan: WorkloadConfigurationScanSummary
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

function isResourceMatchedInException(
  workloadScan: WorkloadConfigurationScanSummary,
  policies: PostureExceptionPolicy[]
) {
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
  workloadScan: WorkloadConfigurationScanSummary,
  policies: PostureExceptionPolicy[]
) {
  return policies.some(
    policy =>
      policy.posturePolicies?.some(pp =>
        policyAttributesMatch(pp, frameworkName, controlName, control)
      ) && policy.resources.some(r => resourceAttributesMatch(r.attributes, workloadScan))
  );
}

/**
 * Calculate the compliance score for a given control across all scans.
 *
 * The control compliance score measures the compliance of individual controls within a framework.
 * It is calculated by evaluating the ratio of resources that passed to the total number of resources evaluated against that control.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData - The list of scans to calculate the score for.
 * @param {Control} control - The control to calculate the score for.
 * @returns {number} The compliance score for the control, as a percentage.
 */
export function controlComplianceScore(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  const total = countScansForControl(workloadScanData, control);
  if (total === 0) {
    return 100;
  }
  const passedCount = countScans(workloadScanData, control, 'passed');
  return (passedCount / total) * 100;
}

/**
 * Count the number of scans that match the given control ID and status.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData
 * @param {Control} control
 * @param {string} status
 * @returns {number}
 */
export function countScans(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control,
  status: string
): number {
  return workloadScanData
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => scan.controlID === control.controlID)
    .filter(scan => scan.status.status === status).length;
}

/**
 * Count the number of failed scans across all workloads.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData
 * @returns {number}
 */
export function countFailedScans(workloadScanData: WorkloadConfigurationScanSummary[]): number {
  return workloadScanData
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => scan.status.status === 'failed').length;
}

/**
 * Count the number of scans that match the given control ID.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData
 * @param {Control} control
 * @returns {number}
 */
export function countScansForControl(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
): number {
  return workloadScanData.filter(w =>
    Object.values(w.spec.controls).some(scan => scan.controlID === control.controlID)
  ).length;
}

/**
 * Retrieves controls from the specified framework that have associated findings
 * marked as 'failed' in the given workload scan data.
 *
 * This function filters the controls within the provided framework to identify
 * those that match any control ID in the workload scan data where the status
 * is marked as 'failed'.
 *
 * @param workloadScanData - An array of workload scan summaries to check for failed controls.
 * @param frameWork - The framework containing the controls to be filtered.
 * @returns An array of controls that have failed findings in the workload scan data.
 */

export function getControlsWithFindings(
  workloadScanData: WorkloadConfigurationScanSummary[],
  frameWork: FrameWork
) {
  return frameWork.controls.filter(control =>
    workloadScanData?.some(w =>
      Object.values(w.spec.controls).some(
        scan => control.controlID === scan.controlID && scan.status.status === 'failed'
      )
    )
  );
}
