import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import {
  controlComplianceScore,
  countExcludedWorkloadsForControl,
  countFailedScans,
  countScans,
  frameworkComplianceScore,
  getControlsWithFindings,
  hasFailedScans,
  invalidateControlStats,
  passedOrExcludedCount,
} from './workload-scanning';

// The aggregations as they were before the scans were indexed, to compare against
const reference = {
  passedOrExcludedCount(scans: WorkloadConfigurationScanSummary[], controlID: string) {
    const affected = scans.filter(w =>
      Object.values(w.spec.controls).some(scan => scan.controlID === controlID)
    );
    const passed = affected.filter(
      w =>
        w.exceptedByPolicy ||
        Object.values(w.spec.controls).some(
          scan =>
            scan.controlID === controlID &&
            (scan.exceptedByPolicy || scan.status.status === 'passed')
        )
    ).length;
    return [passed, affected.length];
  },
  countScans(scans: WorkloadConfigurationScanSummary[], controlID: string, status: string) {
    return scans
      .filter(w => !w.exceptedByPolicy)
      .flatMap(w => Object.values(w.spec.controls))
      .filter(scan => !scan.exceptedByPolicy)
      .filter(scan => scan.controlID === controlID)
      .filter(scan => scan.status.status === status).length;
  },
  countExcluded(scans: WorkloadConfigurationScanSummary[], controlID: string) {
    let excluded = 0;
    scans.forEach(w =>
      Object.values(w.spec.controls).forEach(scan => {
        if (scan.controlID === controlID && (w.exceptedByPolicy || scan.exceptedByPolicy))
          excluded++;
      })
    );
    return excluded;
  },
  hasFailed(scans: WorkloadConfigurationScanSummary[], controlID: string) {
    return scans.some(w =>
      Object.values(w.spec.controls).some(
        scan => scan.controlID === controlID && scan.status.status === 'failed'
      )
    );
  },
};

let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const controlIDs = ['C-0001', 'C-0002', 'C-0003', 'C-0004', 'C-0005', 'C-0006'];

function randomScans(count: number): WorkloadConfigurationScanSummary[] {
  return Array.from({ length: count }, (_, index) => {
    const controls: WorkloadConfigurationScanSummary.Controls = {};
    for (const controlID of controlIDs) {
      if (random() < 0.3) continue;
      controls[controlID] = {
        controlID,
        severity: { scoreFactor: 5, severity: 'High' },
        status: {
          status: (random() < 0.5 ? 'failed' : 'passed') as WorkloadConfigurationScanSummary.Status,
        },
        exceptedByPolicy: random() < 0.15,
      };
    }
    return {
      metadata: { name: `w${index}` } as any,
      spec: { controls, severities: {} as any },
      exceptedByPolicy: random() < 0.1,
    };
  });
}

const controls = [...controlIDs, 'C-9999'].map(controlID => ({ controlID } as any));

it('gives the same results as counting over all scans', () => {
  const scans = randomScans(200);
  for (const control of controls) {
    const id = control.controlID;
    expect(passedOrExcludedCount(scans, control)).toEqual(
      reference.passedOrExcludedCount(scans, id)
    );
    expect(countScans(scans, control, 'failed')).toBe(reference.countScans(scans, id, 'failed'));
    expect(countScans(scans, control, 'passed')).toBe(reference.countScans(scans, id, 'passed'));
    expect(countExcludedWorkloadsForControl(scans, control)).toBe(
      reference.countExcluded(scans, id)
    );
    expect(hasFailedScans(scans, control)).toBe(reference.hasFailed(scans, id));
  }
  expect(countFailedScans(scans)).toBe(
    controlIDs.reduce((sum, id) => sum + reference.countScans(scans, id, 'failed'), 0)
  );
  expect(getControlsWithFindings(scans, { controls } as any).map(c => c.controlID)).toEqual(
    controlIDs.filter(id => reference.countScans(scans, id, 'failed') > 0)
  );
  expect(controlComplianceScore(scans, controls[6])).toBe(100);
});

it('counts again after exceptions changed the scans', () => {
  const scans = randomScans(50);
  const control = controls[0];
  const before = countScans(scans, control, 'failed');

  scans.forEach(w => {
    w.exceptedByPolicy = false;
    Object.values(w.spec.controls).forEach(scan => (scan.exceptedByPolicy = false));
  });
  invalidateControlStats();

  expect(countScans(scans, control, 'failed')).toBe(
    reference.countScans(scans, 'C-0001', 'failed')
  );
  expect(countScans(scans, control, 'failed')).toBeGreaterThanOrEqual(before);
});

it('scores a framework by the average score of its controls', () => {
  const pass = (controlID: string, status: string) =>
    ({
      metadata: {},
      spec: { controls: { [controlID]: { controlID, status: { status } } } },
    } as any);
  const scans = [pass('C-0001', 'passed'), pass('C-0001', 'failed'), pass('C-0002', 'passed')];

  expect(
    frameworkComplianceScore(scans, {
      controls: [{ controlID: 'C-0001' }, { controlID: 'C-0002' }],
    } as any)
  ).toBe(75);
});
