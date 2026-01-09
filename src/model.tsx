/* 
  Kubescape definitions for resources with basic methods for querying. 
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/k8s/crd';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';

const spdxGroup = 'spdx.softwarecomposition.kubescape.io';
const spdxVersion = 'v1beta1';
const spdxGroupVersions = [{ group: spdxGroup, version: spdxVersion }];

export const customObjectLabel = 'kubescape.io/custom-object';

export const vulnerabilityManifestClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'vulnerabilitymanifest',
  pluralName: 'vulnerabilitymanifests',
  kind: 'VulnerabilityManifest',
  customResourceDefinition: undefined as any,
});

export const vulnerabilityManifestSummaryClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'vulnerabilitymanifestsummary',
  pluralName: 'vulnerabilitymanifestsummaries',
  kind: 'VulnerabilityManifestSummary',
  customResourceDefinition: undefined as any,
});

export const vulnerabilitySummaryClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: false,
  singularName: 'vulnerabilitysummary',
  pluralName: 'vulnerabilitysummaries',
  kind: 'VulnerabilitySummary',
  customResourceDefinition: undefined as any,
});

export const openVulnerabilityExchangeContainerClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true, // kubescape
  singularName: 'openvulnerabilityexchangecontainer',
  pluralName: 'openvulnerabilityexchangecontainers',
  kind: 'OpenVulnerabilityExchangeContainer',
  customResourceDefinition: undefined as any,
});

export const workloadConfigurationScanSummaryClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'workloadconfigurationscansummary',
  pluralName: 'workloadconfigurationscansummaries',
  kind: 'WorkloadConfigurationScanSummary',
  customResourceDefinition: undefined as any,
});

export const workloadConfigurationScanClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'workloadconfigurationscan',
  pluralName: 'workloadconfigurationscans',
  kind: 'WorkloadConfigurationScan',
  customResourceDefinition: undefined as any,
});

export const configurationScanSummariesClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: false,
  singularName: 'configurationscansummary',
  pluralName: 'configurationscansummaries',
  kind: 'ConfigurationScanSummary',
  customResourceDefinition: undefined as any,
});

export const generatedNetworkPolicyClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'generatednetworkpolicy',
  pluralName: 'generatednetworkpolicies',
  kind: 'GeneratedNetworkPolicy',
  customResourceDefinition: undefined as any,
});

export const networkNeighborhoodsClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'networkneighborhood',
  pluralName: 'networkneighborhoods',
  kind: 'NetworkNeighborhood',
  customResourceDefinition: undefined as any,
});

export const sbomSyftClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'sbomsyft',
  pluralName: 'sbomsyfts',
  kind: 'SBOMSyft',
  customResourceDefinition: undefined as any,
});

export const sbomSyftFilteredClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'sbomsyftfiltered',
  pluralName: 'sbomsyftfiltereds',
  kind: 'SBOMSyftFiltered',
  customResourceDefinition: undefined as any,
});

export const applicationProfileClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'applicationprofile',
  pluralName: 'applicationprofiles',
  kind: 'ApplicationProfile',
  customResourceDefinition: undefined as any,
});

export const knownServersClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'knownserver',
  pluralName: 'knownservers',
  kind: 'KnownServer',
  customResourceDefinition: undefined as any,
});

export async function listQuery(objectClass: KubeObjectClass): Promise<any> {
  const namespaces: string[] = getAllowedNamespaces();
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;
  const pluralName = objectClass.pluralName;

  if (namespaces?.length > 0) {
    const listOfLists: any[] = await Promise.all(
      namespaces.map(namespace =>
        request(`/apis/${group}/${version}/namespaces/${namespace}/${pluralName}`)
      )
    );

    return listOfLists.flatMap(list => list.items);
  } else {
    const overviewList = await request(`/apis/${group}/${version}/${pluralName}`);
    return overviewList.items;
  }
}
export function fetchObject(
  name: string,
  namespace: string,
  cluster: string,
  objectClass: KubeObjectClass
): Promise<any> {
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;

  return request(
    `/apis/${group}/${version}/${namespace ? 'namespaces/' : ''}${namespace}/${
      objectClass.pluralName
    }/${name}`,
    {
      cluster: cluster,
    }
  );
}
