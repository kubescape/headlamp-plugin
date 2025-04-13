/* 
  Show fix suggestion for a workload. 
*/
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { DiffEditor } from '@monaco-editor/react';
import { Link } from '@mui/material';
import * as yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { useEffect, useState } from 'react';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { fetchObject, proxyRequest, workloadConfigurationScanClass } from '../model';
import { WorkloadConfigurationScan } from '../softwarecomposition/WorkloadConfigurationScan';
import { controlLibrary } from './controlLibrary';

const { createRouteURL } = Router;

export default function KubescapeWorkloadConfigurationScanFixes() {
  const [controlID, name, namespace] = getURLSegments(-1, -2, -3);
  const [workloadConfigurationScan, setWorkloadConfigurationScan] =
    useState<WorkloadConfigurationScan | null>(null);

  const control = controlLibrary.find(element => element.controlID === controlID);

  useEffect(() => {
    fetchObject(name, namespace, workloadConfigurationScanClass).then(
      (result: WorkloadConfigurationScan) => {
        setWorkloadConfigurationScan(result);
      }
    );
  }, []);

  if (!workloadConfigurationScan) {
    return <></>;
  }

  return (
    <>
      <SectionBox
        title={control?.name}
        backLink={createRouteURL(RoutingName.KubescapeWorkloadConfigurationScanDetails, {
          name: workloadConfigurationScan.metadata.name,
          namespace: workloadConfigurationScan.metadata.namespace,
        })}
      >
        <NameValueTable
          rows={[
            {
              name: 'Name',
              value: workloadConfigurationScan.metadata.labels['kubescape.io/workload-name'],
            },
            {
              name: 'Namespace',
              value: workloadConfigurationScan.metadata.labels['kubescape.io/workload-namespace'],
            },
            {
              name: 'Kind',
              value: workloadConfigurationScan.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              name: 'Control',
              value: (
                <Link
                  target="_blank"
                  href={'https://hub.armosec.io/docs/' + control?.controlID.toLowerCase()}
                >
                  {control?.controlID} {control?.name}
                </Link>
              ),
            },
            {
              name: 'Explain',
              value: control?.description,
            },
            {
              name: 'Category',
              value: control?.category?.name,
            },
            {
              name: 'Remediation',
              value: control?.remediation,
            },
            // {
            //   name: 'Scan',
            //   value: workloadConfigurationScan.metadata.name,
            // },
            {
              name: 'Related objects',
              value: workloadConfigurationScan.spec.relatedObjects
                ? workloadConfigurationScan.spec.relatedObjects
                    .map(object => `${object.name}: ${object.kind}`)
                    .join(', ')
                : '',
            },
          ]}
        />
      </SectionBox>

      {fixes(workloadConfigurationScan, controlID)}
    </>
  );
}

function fixes(
  workloadConfigurationScan: WorkloadConfigurationScan,
  controlID: string
): JSX.Element[] {
  const fixes: JSX.Element[] = [];
  const control = Object.values(workloadConfigurationScan.spec.controls).find(
    item => item.controlID === controlID
  );

  if (!control) {
    return fixes;
  }

  const labels = workloadConfigurationScan.metadata.labels;
  const primaryFix = (
    <Fix
      control={control}
      kind={labels['kubescape.io/workload-kind']}
      name={labels['kubescape.io/workload-name']}
      namespace={labels['kubescape.io/workload-namespace']}
    />
  );
  if (primaryFix) {
    fixes.push(primaryFix);
  }
  if (workloadConfigurationScan.spec.relatedObjects) {
    workloadConfigurationScan.spec.relatedObjects.forEach((obj, index) => {
      const fix = (
        <Fix
          control={control}
          kind={obj.kind}
          name={obj.name}
          namespace={obj.namespace}
          rulePathPrefix={`relatedObjects[${index}].`}
        />
      );
      if (fix) {
        fixes.push(fix);
      }
    });
  }

  return fixes;
}

function Fix(
  props: Readonly<{
    control: WorkloadConfigurationScan.Control;
    kind: string;
    name: string;
    namespace: string;
    rulePathPrefix?: string; // to filter rules for relatedObjects
  }>
) {
  const { control, kind, name, namespace, rulePathPrefix } = props;
  const [resource, setResource] = useState<any>(null);

  useEffect(() => {
    // @ts-ignore
    const kubeObjectClass = K8s.ResourceClasses[kind];
    if (!kubeObjectClass) {
      console.log('Fix view is not supported yet for:' + kind);
      return;
    }

    proxyRequest(
      name,
      kubeObjectClass.isNamespaced ? namespace : '',
      kubeObjectClass.apiEndpoint.apiInfo[0].group,
      kubeObjectClass.apiEndpoint.apiInfo[0].version,
      kubeObjectClass.pluralName
    ).then((result: any) => {
      setResource(result);
    });
  }, []);

  if (!resource || !control?.rules) {
    return <></>;
  }

  // strip status
  const strippedResource: any = Object.fromEntries(
    Object.entries(resource).filter(([key]) => key !== 'status')
  );
  // strip managedFields
  strippedResource.metadata = Object.fromEntries(
    Object.entries(strippedResource.metadata).filter(([key]) => key !== 'managedFields')
  );

  const original = yaml.dump(strippedResource);

  const fixedYAML = fixResource(cloneDeep(strippedResource), control, rulePathPrefix ?? '');
  const lines = fixedYAML.match(/\n/g)?.length ?? 10;

  return (
    <>
      {/* <Editor theme="vs-dark" language="yaml" value={yaml.dump(control)} height={500} /> */}

      <DiffEditor
        theme={localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : ''}
        language="yaml"
        original={original}
        modified={fixedYAML}
        height={lines * 30}
        options={{
          renderSideBySide: true,
        }}
      />
    </>
  );
}

// Amend the resource as per fixPath recommendations
export function fixResource(
  resource: any,
  control: WorkloadConfigurationScan.Control,
  prefix: string
): string {
  if (control.rules) {
    for (const rule of control.rules) {
      if (!rule.paths) {
        continue;
      }
      for (const rulePath of rule.paths) {
        let path = rulePath.fixPath.length > 0 ? rulePath.fixPath : rulePath.failedPath;
        if (path) {
          const isRelatedObjectFix = path.startsWith('relatedObjects');

          if ((prefix && path.startsWith(prefix)) || (!prefix && !isRelatedObjectFix)) {
            path = path.replace(prefix, '');
            evaluateRule(resource, path, rulePath.fixPathValue);
          }
        }
      }
    }
  }

  return yaml.dump(resource);
}

function evaluateRule(resource: any, path: string, fixPathValue: string) {
  const parts = path.split('.');

  let element: any = resource;
  for (const part of parts) {
    const arrayMatch = part.match(/(\w+)\[([0-9]+)\]/); // e.g. containers[0]
    if (arrayMatch) {
      const field = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);

      if (field in element) {
        const list: [] = element[field];
        if (list.length > index) {
          if (part === parts[parts.length - 1]) {
            element[field][index] = fixPathValue;
            return; // done
          }
          element = element[field][index];
        } else {
          return; // the rule has a mismatch
        }
      } else {
        element[field] = [{}]; // new array with 1 object
        element = element[field][0];
      }
    } else {
      if (part === parts[parts.length - 1]) {
        element[part] = fixPathValue;
        return; // done
      }
      if (!(part in element)) {
        element[part] = {};
      }
      element = element[part];
    }
  }
}
