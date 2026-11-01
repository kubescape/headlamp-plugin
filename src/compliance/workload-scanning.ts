import { Control, FrameWork } from '../rego';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';

/** The results of one control over a set of workload scans. */
interface ControlStats {
  // workloads that were checked for the control
  affected: number;
  // of those, the workloads that passed it or are excepted from it
  passedOrExcluded: number;
  // results per status, without excepted workloads and results
  byStatus: Map<string, number>;
  // results of excepted workloads or excepted results
  excluded: number;
  // whether any result failed, excepted or not
  hasFailed: boolean;
}

interface ScanIndex {
  version: number;
  controls: Map<string, ControlStats>;
  failed: number;
}

// The pages ask for the results of every control, of every framework, on every render. Each
// set of scans is indexed once, so asking is a lookup instead of a pass over all scans.
const indexes = new WeakMap<WorkloadConfigurationScanSummary[], ScanIndex>();
// Applying exceptions changes the scans in place, which makes the indexes outdated
let exceptionsVersion = 0;

/** To call after the excepted marks of scans changed. */
export function invalidateControlStats() {
  exceptionsVersion++;
}

function statsOf(controls: Map<string, ControlStats>, controlID: string): ControlStats {
  let stats = controls.get(controlID);
  if (!stats) {
    stats = {
      affected: 0,
      passedOrExcluded: 0,
      byStatus: new Map(),
      excluded: 0,
      hasFailed: false,
    };
    controls.set(controlID, stats);
  }
  return stats;
}

function indexScans(workloadScanData: WorkloadConfigurationScanSummary[]): ScanIndex {
  const cached = indexes.get(workloadScanData);
  if (cached && cached.version === exceptionsVersion) return cached;

  const controls = new Map<string, ControlStats>();
  let failed = 0;
  for (const w of workloadScanData) {
    // per control of this workload: whether it passed or is excepted
    const passedOrExcluded = new Map<string, boolean>();
    for (const scan of Object.values(w.spec.controls)) {
      const stats = statsOf(controls, scan.controlID);
      const status = scan.status.status;
      const ok =
        w.exceptedByPolicy ||
        scan.exceptedByPolicy ||
        status === WorkloadConfigurationScanSummary.Status.Passed;
      passedOrExcluded.set(scan.controlID, (passedOrExcluded.get(scan.controlID) ?? false) || ok);

      if (status === 'failed') stats.hasFailed = true;
      if (w.exceptedByPolicy || scan.exceptedByPolicy) {
        stats.excluded++;
      } else {
        stats.byStatus.set(status, (stats.byStatus.get(status) ?? 0) + 1);
        if (status === 'failed') failed++;
      }
    }
    for (const [controlID, ok] of passedOrExcluded) {
      const stats = statsOf(controls, controlID);
      stats.affected++;
      if (ok) stats.passedOrExcluded++;
    }
  }

  const index = { version: exceptionsVersion, controls, failed };
  indexes.set(workloadScanData, index);
  return index;
}

function controlStats(workloadScanData: WorkloadConfigurationScanSummary[], control: Control) {
  return indexScans(workloadScanData).controls.get(control.controlID);
}

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

/** The workloads that passed or are excepted from the control, and all workloads checked. */
export function passedOrExcludedCount(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  const stats = controlStats(workloadScanData, control);
  return [stats?.passedOrExcluded ?? 0, stats?.affected ?? 0];
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
  return controlStats(workloadScanData, control)?.byStatus.get(status) ?? 0;
}

/**
 * Count the number of failed scans across all workloads.
 *
 * @param {WorkloadConfigurationScanSummary[]} workloadScanData
 * @returns {number}
 */
export function countFailedScans(workloadScanData: WorkloadConfigurationScanSummary[]): number {
  return indexScans(workloadScanData).failed;
}

/** The workloads excepted from the control, and the excepted results of the control. */
export function countExcludedWorkloadsForControl(
  workloadScanData: WorkloadConfigurationScanSummary[],
  control: Control
) {
  return controlStats(workloadScanData, control)?.excluded ?? 0;
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
  if (!workloadScanData) return [];
  return frameWork.controls.filter(control => countScans(workloadScanData, control, 'failed') > 0);
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
  if (!workloadScanData) return false;
  return controlStats(workloadScanData, control)?.hasFailed ?? false;
}
