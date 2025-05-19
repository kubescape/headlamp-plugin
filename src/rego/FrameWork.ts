import { Control } from './Control';

export interface FrameWork {
  configmapManifestName?: any;
  name: string;
  description?: string;
  attributes?: any;
  scanningScope?: any;
  typeTags?: string[];
  version?: any;
  controls: Control[];
  ControlsIDs?: string[];
  subSections?: any;
}
