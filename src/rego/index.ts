import { controls } from './controls';
import { FrameWork } from './FrameWork';
import { frameworks } from './frameworks';

export * from './FrameWork';
export * from './Control';
export * from './Rule';

export * from './frameworks';
export * from './controls';

// Create All Frameworks by collecting all unique control IDs from all frameworks
const allFrameworksControlIds = [
  ...new Set(frameworks.flatMap(framework => framework.ControlsIDs || [])),
];

// Internal framework containing all regolibrary controls, used as fallback when no framework is selected
export const fullRegolibraryFramework: FrameWork = {
  name: 'Full Regolibrary',
  description: 'Contains all Kubescape controls from all frameworks combined',
  controls: [],
  ControlsIDs: allFrameworksControlIds,
};

export const defaultFrameworkNames = ['cis-v1.10.0', 'MITRE', 'NSA'];

/**
 * Iterate over the frameworks and make sure each framework has a controls array.
 * The controls array is populated by filtering the controls array against the
 * ControlsIDs property of each framework.
 */
export function fitControlsToFrameworks() {
  // Populate controls for all frameworks in the main array
  for (const framework of frameworks) {
    if (framework.controls.length === 0) {
      framework.controls = controls.filter(control =>
        framework.ControlsIDs?.some(id => id === control.controlID)
      );
    }
  }

  // Also populate controls for the internal full regolibrary framework
  if (fullRegolibraryFramework.controls.length === 0) {
    fullRegolibraryFramework.controls = controls.filter(control =>
      fullRegolibraryFramework.ControlsIDs?.some(id => id === control.controlID)
    );
  }
}
