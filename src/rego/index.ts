import { controls } from './controls';
import { frameworks } from './frameworks';

export * from './FrameWork';
export * from './Control';
export * from './Rule';

export * from './frameworks';
export * from './controls';

export const defaultFrameworkNames = ['AllControls', 'cis-v1.10.0', 'MITRE', 'NSA'];

/**
 * Iterate over the frameworks and make sure each framework has a controls array.
 * The controls array is populated by filtering the controls array against the
 * ControlsIDs property of each framework.
 */
export function fitControlsToFrameworks() {
  for (const framework of frameworks) {
    if (framework.controls.length === 0) {
      framework.controls = controls.filter(control =>
        framework.ControlsIDs?.some(id => id === control.controlID)
      );
    }
  }
}
