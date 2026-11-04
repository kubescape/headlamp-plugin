/* 
  Show fix suggestion for a workload. 
*/
import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { DiffEditor } from '@monaco-editor/react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
} from '@mui/material';
import * as yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { saveToFile } from '../common/filedialog';
import { configurationScanCommand } from '../common/operatorCommands';
import { AccessCheck, Permitted } from '../common/permissions';
import { ScanNowButton } from '../common/ScanNowButton';
import { useEditorTheme } from '../common/theme';
import { getURLSegments } from '../common/url';
import { fetchObject, workloadConfigurationScanClass } from '../model';
import { useRegoData } from '../rego';
import { WorkloadConfigurationScan } from '../softwarecomposition/WorkloadConfigurationScan';

export default function KubescapeWorkloadConfigurationScanFixes() {
  const [controlID, name, namespace, cluster] = getURLSegments(-1, -2, -3, -5);
  const { controls } = useRegoData();

  console.log(controlID, name, namespace, cluster);
  const [workloadConfigurationScan, setWorkloadConfigurationScan] =
    useState<WorkloadConfigurationScan | null>(null);

  useEffect(() => {
    fetchObject(name, namespace, cluster, workloadConfigurationScanClass).then(
      (result: WorkloadConfigurationScan) => {
        setWorkloadConfigurationScan(result);
      }
    );
  }, []);

  const control = controls.find(element => element.controlID === controlID);

  if (!workloadConfigurationScan) {
    return <></>;
  }

  return (
    <>
      <SectionBox title={control?.name} backLink>
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
                  href={'https://kubescape.io/docs/controls/' + control?.controlID.toLowerCase()}
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

      {fixes(workloadConfigurationScan, controlID, cluster)}
    </>
  );
}

function fixes(
  workloadConfigurationScan: WorkloadConfigurationScan,
  controlID: string,
  cluster: string
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
      key="primary-fix"
      control={control}
      kind={labels['kubescape.io/workload-kind']}
      name={labels['kubescape.io/workload-name']}
      namespace={labels['kubescape.io/workload-namespace']}
      cluster={cluster}
    />
  );
  if (primaryFix) {
    fixes.push(primaryFix);
  }
  if (workloadConfigurationScan.spec.relatedObjects) {
    workloadConfigurationScan.spec.relatedObjects.forEach((obj, index) => {
      const fix = (
        <Fix
          key={`fix-${index}`}
          control={control}
          kind={obj.kind}
          name={obj.name}
          namespace={obj.namespace}
          cluster={cluster}
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
    cluster: string;
    rulePathPrefix?: string; // to filter rules for relatedObjects
  }>
) {
  const { control, kind, name, namespace, cluster, rulePathPrefix } = props;
  const editorTheme = useEditorTheme();
  const [resource, setResource] = useState<any>(null);
  // @ts-ignore
  const kubeObjectClass = K8s.ResourceClasses[kind];
  const group: string = kubeObjectClass?.apiEndpoint.apiInfo[0].group ?? '';
  const version: string = kubeObjectClass?.apiEndpoint.apiInfo[0].version ?? '';
  // the core API group has no group in the path
  const path = `${group ? `/apis/${group}` : '/api'}/${version}/${
    namespace ? `namespaces/${namespace}/` : ''
  }${kubeObjectClass?.pluralName}/${name}`;

  useEffect(() => {
    if (!kubeObjectClass) {
      console.log('Fix view is not supported yet for:' + kind);
      return;
    }
    request(path, { cluster }).then((result: any) => setResource(result));
  }, [path, cluster]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <FixActions
        kind={kind}
        name={name}
        namespace={namespace}
        cluster={cluster}
        path={path}
        updateCheck={{
          group,
          resource: kubeObjectClass.pluralName,
          verb: 'update',
          namespace: namespace || undefined,
          name,
        }}
        fixedYAML={fixedYAML}
        unchanged={fixedYAML === original}
      />
      <DiffEditor
        theme={editorTheme}
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

// Download the fixed resource, or replace the resource in the cluster with it
function FixActions(
  props: Readonly<{
    kind: string;
    name: string;
    namespace: string;
    cluster: string;
    path: string;
    updateCheck: AccessCheck;
    fixedYAML: string;
    unchanged: boolean;
  }>
) {
  const { kind, name, namespace, cluster, path, updateCheck, fixedYAML, unchanged } = props;
  const { enqueueSnackbar } = useSnackbar();
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const fullName = namespace ? `${namespace}/${name}` : name;

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      // the resource version makes the update fail when the resource changed meanwhile
      await put(path, yaml.load(fixedYAML) as any, true, { cluster });
      setConfirming(false);
      setApplied(true);
      enqueueSnackbar(`Fix applied to ${kind} ${fullName}`, { variant: 'success' });
    } catch (err: any) {
      setError(
        err?.status === 409
          ? `The ${kind} changed since this page was opened. Reload the page to see the current fix.`
          : err?.message ?? String(err)
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ my: 1 }} alignItems="center">
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:download" />}
          onClick={() => saveToFile(fixedYAML, `${name}-fixed.yaml`, enqueueSnackbar)}
        >
          Download fixed YAML
        </Button>
        <Permitted check={updateCheck} cluster={cluster}>
          {allowed => (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              disabled={!allowed || unchanged || applied}
              startIcon={<Icon icon="mdi:wrench-check-outline" />}
              onClick={() => setConfirming(true)}
            >
              {applied ? 'Fix applied' : 'Apply fix'}
            </Button>
          )}
        </Permitted>
        {applied && (
          <ScanNowButton
            clusters={[cluster]}
            command={configurationScanCommand}
            tooltip="Ask Kubescape to scan again, so the compliance results show the fix"
          />
        )}
      </Stack>

      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>
          Apply fix to {kind} {fullName}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1 }}>
            This replaces the {kind} in cluster {cluster} with the fixed version shown on this page.
            Kubernetes then rolls out the change, which restarts the pods of a workload. Check that
            the fix suits the workload before you apply it.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={applying} onClick={apply}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
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

/**
 * The value of a fix path, which Kubescape gives as text, as the type the field has: "false"
 * is a boolean and "1000" a number, while "RuntimeDefault" stays text.
 */
export function parseFixValue(fixPathValue: string): unknown {
  try {
    const value = yaml.load(fixPathValue, { schema: yaml.JSON_SCHEMA });
    return value === undefined ? fixPathValue : value;
  } catch {
    return fixPathValue;
  }
}

function evaluateRule(resource: any, path: string, fixPathText: string) {
  const parts = path.split('.');
  const fixPathValue = parseFixValue(fixPathText);

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
