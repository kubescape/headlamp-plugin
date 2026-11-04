import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { Permitted } from '../common/permissions';
import {
  bindingFor,
  bindingName,
  BindingNotInstalledError,
  checkPolicy,
  installPolicy,
  installProblem,
  isInstalled,
  paramsCreationProblem,
  paramsName,
  ParamsState,
  paramsState,
  PolicyObject,
  ValidationAction,
} from './install';

const createCheck = (resource: string) => ({
  group: 'admissionregistration.k8s.io',
  resource,
  verb: 'create',
});

// installing reads every binding first, to find those that would enforce the policy
// (installProblem)
const listBindingsCheck = {
  group: 'admissionregistration.k8s.io',
  resource: 'validatingadmissionpolicybindings',
  verb: 'list',
};

function errorText(error: any) {
  return error?.message ?? String(error);
}

function parse(text: string | undefined): any {
  try {
    return text ? yaml.load(text) : null;
  } catch {
    return null;
  }
}

const paramsProblems: Partial<Record<ParamsState, string>> = {
  'not-served':
    'This policy reads its parameters from a kubescape.io/v1 ControlConfiguration, which this ' +
    'cluster does not serve. Install the ControlConfiguration CRD of the Kubescape CEL ' +
    'admission library first.',
  namespaced:
    'This cluster serves ControlConfigurations per namespace; the playground only installs ' +
    'policies whose parameters are cluster-wide.',
};

/** Installs the policy of the editor in the cluster, with a binding that never rejects. */
export function InstallPolicyButton(
  props: Readonly<{
    getPolicyYaml: () => string | undefined;
    getParamsYaml: () => string | undefined;
    disabled: boolean;
  }>
) {
  const { getPolicyYaml, getParamsYaml, disabled } = props;
  const [policy, setPolicy] = useState<PolicyObject | null>(null);

  return (
    <>
      <Permitted check={[createCheck('validatingadmissionpolicies'), listBindingsCheck]}>
        {allowed => (
          <Button
            variant="outlined"
            disabled={disabled || !allowed}
            onClick={() => setPolicy(parse(getPolicyYaml()))}
          >
            Install in cluster
          </Button>
        )}
      </Permitted>
      {policy !== null && (
        <InstallDialog
          policy={policy}
          params={parse(getParamsYaml())}
          onClose={() => setPolicy(null)}
        />
      )}
    </>
  );
}

function InstallDialog(
  props: Readonly<{ policy: PolicyObject; params: any; onClose: () => void }>
) {
  const { policy, params, onClose } = props;
  const problem = checkPolicy(policy);
  const [actions, setActions] = useState<Record<ValidationAction, boolean>>({
    Warn: true,
    Audit: true,
  });
  const [namespace, setNamespace] = useState('');
  const [paramsStatus, setParamsStatus] = useState<ParamsState | null>(null);
  const [createParams, setCreateParams] = useState(true);
  // why creating the missing parameters could reject requests, null when it cannot or they are
  // not created, undefined while it is checked
  const [paramsConflict, setParamsConflict] = useState<string | null | undefined>(undefined);
  const [installed, setInstalled] = useState<boolean | null>(null);
  // why installing could reject requests, null when it cannot, undefined while it is checked
  const [conflict, setConflict] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    severity: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (problem) return;
    paramsState(policy)
      .then(status => {
        setParamsStatus(status);
        if (status !== 'missing' || !params) return setParamsConflict(null);
        return paramsCreationProblem(policy).then(setParamsConflict, error =>
          setParamsConflict(
            `Unable to check the bindings that read ${paramsName}: ${errorText(error)}`
          )
        );
      })
      .catch(error =>
        setResult({
          severity: 'error',
          text: `Unable to check the parameters: ${errorText(error)}`,
        })
      );
    isInstalled(policy)
      .then(setInstalled)
      .catch(() => setInstalled(null));
    installProblem(policy)
      .then(setConflict)
      .catch(error =>
        setConflict(`Unable to check the bindings of the policy: ${errorText(error)}`)
      );
    // the dialog is opened for one policy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = (Object.keys(actions) as ValidationAction[]).filter(action => actions[action]);
  const paramsProblem = paramsStatus ? paramsProblems[paramsStatus] : undefined;
  const willCreateParams =
    paramsStatus === 'missing' && createParams && !!params && paramsConflict === null;
  const ready =
    !problem &&
    paramsStatus !== null &&
    !paramsProblem &&
    paramsConflict !== undefined &&
    conflict === null &&
    chosen.length > 0 &&
    !busy &&
    !result;

  const install = async () => {
    setBusy(true);
    const binding = bindingFor(policy, chosen, namespace.trim() || undefined);
    try {
      await installPolicy(policy, binding, willCreateParams ? params : null);
      setResult({
        severity: 'success',
        text:
          `Installed ${policy.metadata.name} with binding ${binding.metadata.name} ` +
          `(${chosen.join(', ')}). Requests that violate it are allowed` +
          (actions.Warn ? ' and get a warning' : '') +
          (actions.Audit ? ', and are recorded in the audit log' : '') +
          '.',
      });
    } catch (error) {
      setResult(
        error instanceof BindingNotInstalledError
          ? {
              severity: 'warning',
              text: `${error.message}. Close this dialog and install again to add the binding.`,
            }
          : { severity: 'error', text: `Unable to install the policy: ${errorText(error)}` }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Install policy in cluster</DialogTitle>
      <DialogContent>
        {problem ? (
          <Alert severity="error">{problem}</Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>
              Installs <b>{policy.metadata.name}</b> as it is in the policy editor, with the binding{' '}
              <b>{bindingName(policy)}</b>. The binding only warns or audits, so no request is
              rejected. Deny is not offered here: change the binding with kubectl once the warnings
              show that the policy is right.
            </Typography>
            {conflict && <Alert severity="error">{conflict}</Alert>}
            {installed && !conflict && (
              <Alert severity="info">
                The policy is installed already; installing replaces it and its binding.
              </Alert>
            )}
            <FormGroup row>
              {(['Warn', 'Audit'] as ValidationAction[]).map(action => (
                <FormControlLabel
                  key={action}
                  control={
                    <Checkbox
                      checked={actions[action]}
                      onChange={(_, checked) => setActions({ ...actions, [action]: checked })}
                    />
                  }
                  label={action}
                />
              ))}
            </FormGroup>
            <TextField
              label="Namespace"
              size="small"
              value={namespace}
              onChange={event => setNamespace(event.target.value)}
              helperText="Only check requests in this namespace; empty for all namespaces."
            />
            {paramsProblem && <Alert severity="warning">{paramsProblem}</Alert>}
            {paramsStatus === 'missing' && paramsConflict && (
              <Alert severity="warning">{paramsConflict}</Alert>
            )}
            {paramsStatus === 'missing' && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createParams && !!params && !paramsConflict}
                    disabled={!params || !!paramsConflict}
                    onChange={(_, checked) => setCreateParams(checked)}
                  />
                }
                label={`Create the ControlConfiguration ${paramsName} from the Params tab; without it every request gets a warning that the parameters are missing.`}
              />
            )}
          </Stack>
        )}
        {result && (
          <Alert severity={result.severity} sx={{ mt: 2 }}>
            {result.text}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {result && result.severity !== 'error' ? 'Close' : 'Cancel'}
        </Button>
        {!problem && (
          <Permitted check={createCheck('validatingadmissionpolicybindings')}>
            {allowed => (
              <Button variant="contained" disabled={!ready || !allowed} onClick={install}>
                {busy ? 'Installing…' : 'Install'}
              </Button>
            )}
          </Permitted>
        )}
      </DialogActions>
    </Dialog>
  );
}
