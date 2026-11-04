/* 
  Kubescape definitions for resources with basic methods for querying. 
*/
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getAllowedNamespaces } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/k8s/crd';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';

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

export const containerProfileClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'containerprofile',
  pluralName: 'containerprofiles',
  kind: 'ContainerProfile',
  customResourceDefinition: undefined as any,
});

// Older supported Storage releases serve the separate resources. Keep these
// classes for installations where ContainerProfile is not yet available.
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

// Kubescape stores seccomp profiles in a CRD or in its storage, depending on the
// seccompProfileBackend setting of the operator chart (src/runtimedetection/seccomp.ts).
export const seccompProfileClass = makeCustomResourceClass({
  apiInfo: [{ group: 'kubescape.io', version: 'v1' }],
  isNamespaced: true,
  singularName: 'seccompprofile',
  pluralName: 'seccompprofiles',
  kind: 'SeccompProfile',
  customResourceDefinition: undefined as any,
});

export const seccompProfileStorageClass = makeCustomResourceClass({
  apiInfo: spdxGroupVersions,
  isNamespaced: true,
  singularName: 'seccompprofile',
  pluralName: 'seccompprofiles',
  kind: 'SeccompProfile',
  customResourceDefinition: undefined as any,
});

export const rulesClass = makeCustomResourceClass({
  apiInfo: [{ group: 'kubescape.io', version: 'v1' }],
  isNamespaced: true,
  singularName: 'rules',
  pluralName: 'rules',
  kind: 'Rules',
  customResourceDefinition: undefined as any,
});

export const runtimeRuleAlertBindingClass = makeCustomResourceClass({
  apiInfo: [{ group: 'kubescape.io', version: 'v1' }],
  isNamespaced: false,
  singularName: 'runtimerulealertbinding',
  pluralName: 'runtimerulealertbindings',
  kind: 'RuntimeRuleAlertBinding',
  customResourceDefinition: undefined as any,
});

const kubescapeGroup = 'kubescape.io';
const kubescapeVersion = 'v1beta1';
const kubescapeGroupVersions = [{ group: kubescapeGroup, version: kubescapeVersion }];

export const securityExceptionClass = makeCustomResourceClass({
  apiInfo: kubescapeGroupVersions,
  isNamespaced: true,
  singularName: 'securityexception',
  pluralName: 'securityexceptions',
  kind: 'SecurityException',
  customResourceDefinition: undefined as any,
});

export const clusterSecurityExceptionClass = makeCustomResourceClass({
  apiInfo: kubescapeGroupVersions,
  isNamespaced: false,
  singularName: 'clustersecurityexception',
  pluralName: 'clustersecurityexceptions',
  kind: 'ClusterSecurityException',
  customResourceDefinition: undefined as any,
});

/**
 * Lists all objects of the given class in one cluster, restricted to the allowed
 * namespaces of that cluster when those are configured.
 *
 * @param objectClass - The class of objects to list.
 * @param cluster - The cluster to query, the current cluster by default.
 */
export async function listQuery(
  objectClass: KubeObjectClass,
  cluster: string | null = getCluster()
): Promise<any> {
  const namespaces: string[] = getAllowedNamespaces(cluster);
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;
  const pluralName = objectClass.pluralName;
  const requestOptions = cluster ? { cluster } : {};

  let items: any[];
  if (namespaces?.length > 0) {
    const listOfLists: any[] = await Promise.all(
      namespaces.map(namespace =>
        request(`/apis/${group}/${version}/namespaces/${namespace}/${pluralName}`, requestOptions)
      )
    );
    items = listOfLists.flatMap(list => list.items);
  } else {
    const overviewList = await request(`/apis/${group}/${version}/${pluralName}`, requestOptions);
    items = overviewList.items;
  }
  for (const item of items) {
    item.metadata.cluster = cluster ?? '';
  }
  return items;
}

export type ClusterError = { cluster: string; message: string };

export function fetchObject(
  name: string,
  namespace: string,
  cluster: string,
  objectClass: KubeObjectClass
): Promise<any> {
  const group = objectClass.apiEndpoint.apiInfo[0].group;
  const version = objectClass.apiEndpoint.apiInfo[0].version;
  const namespacePath = namespace ? `namespaces/${namespace}/` : '';

  return request(`/apis/${group}/${version}/${namespacePath}${objectClass.pluralName}/${name}`, {
    cluster: cluster,
  });
}
