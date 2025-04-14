export interface FrameWork {
  name: string;
  description: string;
  attributes: any;
  scanningScope: any;
  typeTags: string[];
  version: any;
  controls: Control[];
  ControlsIDs: string[];
  subSections?: any;
}

export interface Control {
  name: string;
  attributes: {
    actionRequired?: string;
    attackTracks?: any[];
    controlTypeTags?: string[];
    isFixedByNetworkPolicy?: boolean;
    microsoftMitreColumns?: string[];
    rbacQuery?: string;
  };
  description: string;
  remediation: string;
  manual_test?: string;

  long_description?: string;
  test?: string;
  controlID: string;
  category?: {
    name: string;
    id: string;
    subCategory?: {
      name: string;
      id: string;
    };
  };
  baseScore: number;
  example?: string;
  scanningScope: {
    matches: string[];
  };
  references?: string[];
  rules: [];
  impact_statement?: string;
  default_value?: string;
}
