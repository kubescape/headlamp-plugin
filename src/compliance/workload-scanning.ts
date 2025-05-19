import { Control, FrameWork } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

// The framework compliance score provides an overall assessment of your cluster's compliance with a specific framework.
// It is calculated by averaging the Control Compliance Scores of all controls within the framework.
// https://kubescape.io/docs/frameworks-and-controls/frameworks/
export function frameworkComplianceScore(
  workloadScanData: WorkloadConfigurationScanSummary[],
  framework: FrameWork
) {
  const controlComplianceScores = framework.controls.map(control =>
    controlComplianceScore(workloadScanData, control)
  );

  return controlComplianceScores.reduce((a, b) => a + b, 0) / controlComplianceScores.length;
}

/**
 * Calculate the compliance score for a given control across all scans.
 *
 * The control compliance score measures the compliance of individual controls within a framework.
 * It is calculated by evaluating the ratio of resources that passed to the total number of resources evaluated against that control.
 *
 * See also https://github.com/kubescape/opa-utils/blob/main/score/score.go for method used in kubescape-cli.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData - The list of scans to calculate the score for.
 * @param {Control} control - The control to calculate the score for.
 * @returns {number} The compliance score for the control, as a percentage.
 */
export function controlComplianceScore(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  const [passedCount, workloadsAffected] = passedOrExcludedCount(workloadScanData, control);
  if (workloadsAffected === 0) {
    return 100;
  }
  return (passedCount / workloadsAffected) * 100;
}

export function passedOrExcludedCount(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  const workloadsAffected = workloadScanData.filter(w =>
    Object.values(w.spec.controls).some(scan => scan.controlID === control.controlID)
  );

  const passedOrExcluded = workloadsAffected.filter(
    w =>
      w.exceptedByPolicy ||
      Object.values(w.spec.controls).some(
        scan =>
          scan.controlID === control.controlID &&
          (scan.exceptedByPolicy ||
            scan.status.status === WorkloadConfigurationScanSummary.Status.Passed)
      )
  ).length;

  return [passedOrExcluded, workloadsAffected.length];
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
    .filter(w => !w.exceptedByPolicy)
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => !scan.exceptedByPolicy)
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
    .filter(w => !w.exceptedByPolicy)
    .flatMap(w => Object.values(w.spec.controls))
    .filter(scan => !scan.exceptedByPolicy)
    .filter(scan => scan.status.status === 'failed').length;
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
    workloadScanData?.some(
      w =>
        !w.exceptedByPolicy &&
        Object.values(w.spec.controls).some(
          scan =>
            control.controlID === scan.controlID &&
            !scan.exceptedByPolicy &&
            scan.status.status === 'failed'
        )
    )
  );
}

/**
 * Checks if there are any failed scans for the given control.
 *
 * This function will return true if any of the scans in the workload scan data
 * have a status of 'failed' for the given control, and false otherwise.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData
 * @param {Control} control
 * @returns {boolean}
 */
export function hasFailedScans(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  return workloadScanData?.some(w =>
    Object.values(w.spec.controls).some(
      scan => scan.controlID === control.controlID && scan.status.status === 'failed'
    )
  );
}
