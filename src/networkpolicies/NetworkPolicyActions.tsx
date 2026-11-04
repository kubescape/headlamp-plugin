/*
  Download a generated network policy, or create it in the cluster.
*/
import { Icon } from '@iconify/react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import * as yaml from 'js-yaml';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { copyToClipboard } from '../common/clipboard';
import { saveToFile } from '../common/filedialog';
import { Permitted } from '../common/permissions';
import { GeneratedNetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';
import {
  applyNetworkPolicy,
  getExistingNetworkPolicy,
  NetworkPolicyObject,
  toNetworkPolicy,
} from './apply';

export function NetworkPolicyActions(
  props: Readonly<{ generatedNetworkPolicy: GeneratedNetworkPolicy }>
) {
  const policy = toNetworkPolicy(props.generatedNetworkPolicy);
  const policyYaml = yaml.dump(policy);
  const { enqueueSnackbar } = useSnackbar();
  // undefined: dialog closed, null: open and no policy with this name exists yet
  const [existing, setExisting] = useState<NetworkPolicyObject | null | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const openDialog = async () => {
    setError('');
    try {
      setExisting(await getExistingNetworkPolicy(policy));
    } catch (err: any) {
      enqueueSnackbar(`Unable to check for an existing NetworkPolicy: ${err?.message ?? err}`, {
        variant: 'error',
      });
    }
  };

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      await applyNetworkPolicy(policy, existing ?? null);
      enqueueSnackbar(
        `NetworkPolicy ${policy.metadata.namespace}/${policy.metadata.name} ${
          existing ? 'replaced' : 'created'
        }`,
        { variant: 'success' }
      );
      setExisting(undefined);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setApplying(false);
    }
  };

  // the suggested policy, to paste into a GitOps repository instead of creating it here
  const copy = async () => {
    try {
      await copyToClipboard(policyYaml);
      enqueueSnackbar('NetworkPolicy YAML copied to the clipboard', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(`Unable to copy the YAML: ${err?.message ?? err}`, { variant: 'error' });
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:download" />}
          onClick={() =>
            saveToFile(policyYaml, `${policy.metadata.name}-networkpolicy.yaml`, enqueueSnackbar)
          }
        >
          Download YAML
        </Button>
        <Permitted
          check={{
            group: 'networking.k8s.io',
            resource: 'networkpolicies',
            verb: 'create',
            namespace: policy.metadata.namespace,
          }}
        >
          {allowed => (
            <Button
              size="small"
              variant="outlined"
              disabled={!allowed}
              startIcon={<Icon icon="mdi:shield-plus-outline" />}
              onClick={openDialog}
            >
              Create NetworkPolicy
            </Button>
          )}
        </Permitted>
      </Stack>

      <Dialog open={existing !== undefined} onClose={() => setExisting(undefined)} maxWidth="md">
        <DialogTitle>
          {existing ? 'Replace' : 'Create'} NetworkPolicy {policy.metadata.namespace}/
          {policy.metadata.name}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1 }}>
            The policy allows the traffic Kubescape observed while learning the behavior of the
            workload. Other traffic of the workload will be blocked.
            {existing && ' It replaces the existing NetworkPolicy with this name.'}
          </Alert>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          <pre style={{ margin: 0 }}>{policyYaml}</pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExisting(undefined)}>Cancel</Button>
          <Button startIcon={<Icon icon="mdi:content-copy" />} onClick={copy}>
            Copy YAML
          </Button>
          <Button variant="contained" color="warning" disabled={applying} onClick={apply}>
            {existing ? 'Replace' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
