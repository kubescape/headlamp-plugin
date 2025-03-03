/* 
  Show vulnerability scan results for a workload. 
*/
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  NameValueTable,
  SectionBox,
  ShowHideLabel,
  Table as HeadlampTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { createRouteURL } from '@kinvolk/headlamp-plugin/lib/Router';
import { FormControlLabel, Link, Switch } from '@mui/material';
import { useEffect, useState } from 'react';
import makeSeverityLabel from '../common/SeverityLabel';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { VulnerabilityManifest } from '../softwarecomposition/VulnerabilityManifest';
import { VulnerabilityManifestSummary } from '../softwarecomposition/VulnerabilityManifestSummary';
import { getCVESummary } from './CVESummary';

export default function KubescapeVulnerabilityDetails() {
  const [name, namespace] = getURLSegments(-1, -2);

  const [summary, setSummary] = useState<VulnerabilityManifestSummary | null>(null);
  const [manifestAll, setManifestAll] = useState<VulnerabilityManifest | null>(null);
  const [manifestRelevant, setManifestRelevant] = useState<VulnerabilityManifest | null>(null);

  useEffect(() => {
    fetchVulnerabilityManifest(name, namespace).then((response: any[]) => {
      setSummary(response[0]);
      setManifestAll(response[1]);
      setManifestRelevant(response[2]);
    });
  }, []);

  return (
    summary && (
      <>
        <SectionBox
          title="Vulnerabilities"
          backLink={createRouteURL(RoutingName.KubescapeVulnerabilities)}
        >
          <NameValueTable
            rows={[
              {
                name: 'Workload',
                value: summary.metadata.labels['kubescape.io/workload-name'],
              },
              {
                name: 'Namespace',
                value: summary.metadata.labels['kubescape.io/workload-namespace'],
              },
              {
                name: 'Container',
                value: summary.metadata.labels['kubescape.io/workload-container-name'],
              },
              {
                name: 'Kind',
                value: summary.metadata.labels['kubescape.io/workload-kind'],
              },
              {
                name: 'Image',
                value: summary.metadata.annotations['kubescape.io/image-tag'],
              },
              {
                name: 'Last scan',
                value: summary.metadata.creationTimestamp,
              },
              {
                name: 'Type',
                value: manifestAll?.spec.payload.source.type,
              },
              {
                name: 'CVE',
                value: getCVESummary(summary, true, true),
              },
              {
                name: 'Relevant CVE',
                value: getCVESummary(summary, true, true, true),
              },
            ]}
          />

          {manifestAll && <Matches manifest={manifestAll} relevant={manifestRelevant} />}
        </SectionBox>

        {/* <SectionBox title="Summary">
          <pre>{manifestAll ? YAML.stringify(manifestAll) : 'Not found'}</pre>
        </SectionBox>

        <SectionBox title="Manifest Relevant">
          <pre>{manifestRelevant ? YAML.stringify(manifestRelevant) : 'Not found'}</pre>
        </SectionBox> */}
      </>
    )
  );
}

function Matches(props: {
  manifest: VulnerabilityManifest;
  relevant: VulnerabilityManifest | null;
}) {
  const { manifest, relevant } = props;
  const results: VulnerabilityManifest.Match[] = manifest?.spec.payload.matches;
  const [isRelevantCVESwitchChecked, setIsRelevantCVESwitchChecked] = useState(true);

  let relevantResults;
  if (isRelevantCVESwitchChecked && relevant?.spec.payload.matches && results) {
    relevantResults = results.filter(r =>
      relevant.spec.payload.matches.some(m => m.vulnerability.id === r.vulnerability.id)
    );
  }

  return (
    <SectionBox title="Findings">
      <FormControlLabel
        checked={isRelevantCVESwitchChecked}
        control={<Switch color="primary" />}
        label={'Relevant CVE'}
        onChange={(event: any, checked: boolean) => {
          setIsRelevantCVESwitchChecked(checked);
        }}
      />
      <HeadlampTable
        data={relevantResults ?? results}
        columns={[
          {
            header: 'Severity',
            accessorKey: 'vulnerability.severity',
            Cell: ({ cell }: any) => makeSeverityLabel(cell.getValue()),
            gridTemplate: 'auto',
          },
          {
            header: 'CVE',
            accessorKey: 'vulnerability.id',
            Cell: ({ cell }: any) => (
              <Link target="_blank" href={cell.row.original.vulnerability.dataSource}>
                {cell.getValue()}
              </Link>
            ),
            gridTemplate: 'auto',
          },
          {
            id: 'Score',
            header: 'CVSS',
            accessorFn: (match: VulnerabilityManifest.Match) =>
              match.vulnerability.cvss ? match.vulnerability.cvss[0].metrics.baseScore : 0,
            gridTemplate: 'auto',
          },
          {
            header: 'Artifact',
            accessorKey: 'artifact.name',
            gridTemplate: 'auto',
          },
          {
            header: 'Version',
            accessorKey: 'artifact.version',
            gridTemplate: 'auto',
          },
          {
            header: 'Relevant',
            accessorFn: (item: VulnerabilityManifest.Match) => {
              if (!relevant) return 'Unknown';

              return relevant.spec.payload.matches &&
                relevant.spec.payload.matches.some(
                  m => m.vulnerability.id === item.vulnerability.id
                )
                ? 'Yes'
                : 'No';
            },
            gridTemplate: 'auto',
          },
          {
            header: 'Fix',
            accessorKey: 'vulnerability.fix.state',
            gridTemplate: 'auto',
          },
          {
            header: 'Fix in version',
            accessorFn: (item: VulnerabilityManifest.Match) =>
              item.vulnerability.fix?.versions && Array.isArray(item.vulnerability.fix?.versions)
                ? item.vulnerability.fix.versions.join(', ')
                : '',
            gridTemplate: 'auto',
          },
          {
            header: 'Description',
            accessorKey: 'vulnerability.description',
            Cell: ({ cell }: any) => <ShowHideLabel>{cell.getValue()}</ShowHideLabel>,
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'Score',
              desc: true,
            },
          ],
        }}
      />
    </SectionBox>
  );
}

// Fetch vulnerabilitymanifestsummary and then vulnerabilitymanifest (if available)
async function fetchVulnerabilityManifest(name: string, namespace: string) {
  function getVulnerabilityManifestSummary(): Promise<any> {
    return ApiProxy.request(
      `/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/${namespace}/vulnerabilitymanifestsummaries/${name}`
    );
  }

  function getVulnerabilityManifest(name: string): Promise<any> {
    if (name === '') {
      return Promise.resolve();
    }
    return ApiProxy.request(
      `/apis/spdx.softwarecomposition.kubescape.io/v1beta1/namespaces/kubescape/vulnerabilitymanifests/${name}`
    );
  }

  const summary = await getVulnerabilityManifestSummary();
  let allManifest: VulnerabilityManifest | null = null;
  await getVulnerabilityManifest(summary.spec.vulnerabilitiesRef.all.name)
    .then(result => {
      allManifest = result;
    })
    .catch(error => console.log(error.message));
  let relevantManifest: VulnerabilityManifest | null = null;
  await getVulnerabilityManifest(summary.spec.vulnerabilitiesRef.relevant.name)
    .then(result => {
      relevantManifest = result;
    })
    .catch(error => console.log(error.message));

  return [summary, allManifest, relevantManifest];
}
