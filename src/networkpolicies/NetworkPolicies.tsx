/* 
  List generated network policies. 
*/
import './style.css';
import {
  Link as HeadlampLink,
  SectionBox,
  Tabs as HeadlampTabs,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObjectClass } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { ClusterErrors } from '../common/ClusterErrors';
import { clusterColumns, useItemsInClusters } from '../common/clusters';
import { SetupCheck } from '../common/SetupCheck';
import HeadlampTable from '../common/Table';
import { RoutingName } from '../index';
import { generatedNetworkPolicyClass, knownServersClass, listQuery } from '../model';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import { KnownServer } from '../softwarecomposition/KnownServer';

export default function KubescapeNetworkPolicies() {
  return (
    <>
      <h1>Generated Network Policies</h1>
      <SetupCheck features={['networkPolicies']} />
      <HeadlampTabs
        tabs={[
          {
            label: 'Policies',
            component: <NetworkPolicyList />,
          },
          {
            label: 'Known Servers',
            component: <KnownServerList />,
          },
        ]}
        ariaLabel="Navigation Tabs"
      />
    </>
  );
}

// Lists the objects of the class in all selected clusters
function useListInClusters<T>(objectClass: KubeObjectClass) {
  return useItemsInClusters<T>(cluster => listQuery(objectClass, cluster), objectClass.pluralName);
}

function NetworkPolicyList() {
  const {
    items: networkPolicies,
    errors,
    clusters,
  } = useListInClusters<GeneratedNetworkPolicy>(generatedNetworkPolicyClass);

  return (
    <SectionBox>
      <ClusterErrors errors={errors} what="generated network policies" />
      <HeadlampTable
        data={networkPolicies}
        columns={[
          {
            header: 'Name',
            accessorFn: (networkPolicy: GeneratedNetworkPolicy) => {
              return (
                <HeadlampLink
                  routeName={RoutingName.KubescapeNetworkPolicyDiagram}
                  activeCluster={networkPolicy.metadata.cluster}
                  params={{
                    name: networkPolicy.metadata.name,
                    namespace: networkPolicy.metadata.namespace,
                  }}
                >
                  {networkPolicy.metadata.labels['kubescape.io/workload-name']}
                </HeadlampLink>
              );
            },
            gridTemplate: 'auto',
          },
          ...clusterColumns<GeneratedNetworkPolicy>(clusters, policy => policy.metadata.cluster),
          {
            header: 'Kind',
            accessorFn: (networkPolicy: GeneratedNetworkPolicy) =>
              networkPolicy.metadata.labels['kubescape.io/workload-kind'],
            gridTemplate: 'auto',
          },
          {
            header: 'Namespace',
            accessorFn: (networkPolicy: GeneratedNetworkPolicy) =>
              networkPolicy.metadata.labels['kubescape.io/workload-namespace'],
            gridTemplate: 'auto',
          },
          {
            header: 'Ingresses',
            accessorFn: (networkPolicy: GeneratedNetworkPolicy) =>
              networkPolicy.spec.spec.ingress?.length,
            gridTemplate: 'min-content',
          },
          {
            header: 'Egresses',
            accessorFn: (networkPolicy: GeneratedNetworkPolicy) =>
              networkPolicy.spec.spec.egress?.length,
            gridTemplate: 'min-content',
          },
        ]}
      />
    </SectionBox>
  );
}

class KnownServerEntry {
  knownServer: KnownServer;
  entry: KnownServer.Entry;

  constructor(knownServer: KnownServer, entry: KnownServer.Entry) {
    this.knownServer = knownServer;
    this.entry = entry;
  }
}

function KnownServerList() {
  const {
    items: knownServers,
    errors,
    clusters,
  } = useListInClusters<KnownServer>(knownServersClass);

  const serverEntries = knownServers.flatMap(ks =>
    (ks.spec ?? []).map(entry => new KnownServerEntry(ks, entry))
  );

  return (
    <SectionBox>
      <ClusterErrors errors={errors} what="known servers" />
      <HeadlampTable
        data={serverEntries}
        columns={[
          {
            header: 'Item',
            accessorFn: (item: KnownServerEntry) => item.knownServer.metadata.name,
            gridTemplate: 'auto',
          },
          ...clusterColumns<KnownServerEntry>(clusters, item => item.knownServer.metadata.cluster),
          {
            header: 'Name',
            accessorFn: (item: KnownServerEntry) => item.entry.name,
            gridTemplate: 'auto',
          },
          {
            header: 'Server',
            accessorFn: (item: KnownServerEntry) => item.entry.server,
            gridTemplate: 'auto',
          },
          {
            header: 'IPBlock',
            accessorFn: (item: KnownServerEntry) => item.entry.ipBlock,
            gridTemplate: 'auto',
          },
        ]}
      />
    </SectionBox>
  );
}
