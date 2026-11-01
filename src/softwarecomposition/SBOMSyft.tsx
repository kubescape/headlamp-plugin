import { Metadata } from './Metadata';

export interface SBOMSyft {
  metadata: Metadata;
  spec: {
    metadata: {
      report: {
        createdAt: string;
      };
    };
    syft: SBOMSyft.Syft;
  };
}

export namespace SBOMSyft {
  export interface Syft {
    artifacts: Artifact[] | null; // null when there are no packages, e.g. none in use
    distro: Distro;
  }

  export interface Artifact {
    foundBy: string;
    id: string;
    language: string;
    licenses: License[];
    name: string;
    purl: string;
    type: string;
    version: string;
  }

  export interface License {
    value: string;
    spdxExpression: string;
    urls: string[];
  }

  export interface Distro {
    id: string;
    name: string;
    prettyName: string;
    version: string;
    versionID: string;
  }
}
