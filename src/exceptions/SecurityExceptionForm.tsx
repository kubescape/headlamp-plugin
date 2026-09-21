import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { NameValueTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { ErrorContainer } from '../common/ErrorContainer';
import {
  VulnerabilityStatus,
  VulnerabilityJustification,
} from '../softwarecomposition/SecurityException';

type SecurityExceptionKind = 'SecurityException' | 'ClusterSecurityException';
type PostureAction = 'ignore' | 'alert_only';

interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: Array<{
    key: string;
    operator: string;
    values?: string[];
  }>;
}

interface ResourceMatch {
  apiGroup?: string;
  kind: string;
  name?: string;
}

interface SecurityExceptionMatch {
  namespaceSelector?: LabelSelector;
  objectSelector?: LabelSelector;
  resources?: ResourceMatch[];
  images?: string[];
}

interface PostureExceptionEntry {
  controlID: string;
  frameworkName?: string;
  action: PostureAction;
}

interface VulnerabilityExceptionEntry {
  vulnerability: {
    id: string;
    aliases?: string[];
  };
  status: VulnerabilityStatus;
  justification?: VulnerabilityJustification;
  impactStatement?: string;
  expiredOnFix?: boolean;
}

interface SecurityExceptionSpec {
  author?: string;
  reason: string;
  expiresAt?: string;
  match?: SecurityExceptionMatch;
  posture?: PostureExceptionEntry[];
  vulnerabilities?: VulnerabilityExceptionEntry[];
}

interface SecurityExceptionResource {
  apiVersion: 'kubescape.io/v1';
  kind: SecurityExceptionKind;
  metadata: {
    name?: string;
    generateName?: string;
    namespace?: string;
  };
  spec: SecurityExceptionSpec;
}

interface PostureEntryForm {
  controlID: string;
  frameworkName: string;
  action: PostureAction;
}

interface VulnerabilityEntryForm {
import { Icon } from '@iconify/react';
import { post, put } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import {
  ClusterSecurityException,
  PostureException,
  ResourceMatch,
  SecurityException,
  VulnerabilityException,
  VulnerabilityJustification,
  VulnerabilityStatus,
} from '../softwarecomposition/SecurityException';
import {
  JUSTIFICATION_OPTIONS,
  MetadataFields,
  RESOURCE_KINDS,
  sanitizeName,
  SectionTitle,
} from './shared';

export interface SecurityExceptionFormProps {
  // edit mode
  existing?: SecurityException | ClusterSecurityException;
  // compliance context
  controlID?: string;
  frameworkName?: string;
  // vulnerability context
  cveId?: string;
  imageRef?: string;
  vulnerabilityContext?: boolean;
  // shared workload context
  workloadName?: string;
  workloadNamespace?: string;
  workloadKind?: string;
  onClose: () => void;
}

interface ResourceRow {
  kind: string;
  name: string;
}

interface NsSelectorRow {
  key: string;
  value: string;
}

interface PostureRow {
  controlID: string;
  frameworkName: string;
  action: 'ignore' | 'alert_only';
}

interface VulnRow {
  cveId: string;
  status: VulnerabilityStatus;
  justification: VulnerabilityJustification | '';
  impactStatement: string;
  expiredOnFix: boolean;
}

interface SecurityExceptionFormProps {
  prefillControlID?: string;
  prefillCVEID?: string;
  prefillWorkloadKind?: string;
  prefillWorkloadName?: string;
  prefillNamespace?: string;
  onClose?: () => void;
  /** when provided, hide the exception-type chooser and preselect posture or vulnerability */
  defaultType?: 'posture' | 'vulnerability';
}

interface FormErrors {
  [key: string]: string;
}

interface ValidationResult {
  valid: boolean;
  errors: FormErrors;
}

const steps = ['Scope', 'Exception Type', 'Metadata', 'Review'];
const postureActions: PostureAction[] = ['ignore', 'alert_only'];
const vulnerabilityStatuses: VulnerabilityStatus[] = ['not_affected', 'fixed', 'under_investigation'];
const vulnerabilityJustifications: VulnerabilityJustification[] = [
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
];

export function SecurityExceptionForm(props: Readonly<SecurityExceptionFormProps>) {
  const {
    prefillControlID,
    prefillCVEID,
    prefillWorkloadKind,
    prefillWorkloadName,
    prefillNamespace,
    onClose,
    defaultType,
  } = props;

  const [activeStep, setActiveStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdResource, setCreatedResource] = useState<SecurityExceptionResource | null>(null);

  const [kind, setKind] = useState<SecurityExceptionKind>('SecurityException');
  const [namespace, setNamespace] = useState<string>(prefillNamespace ?? '');
  const [workloadKind, setWorkloadKind] = useState<string>(prefillWorkloadKind ?? '');
  const [workloadName, setWorkloadName] = useState<string>(prefillWorkloadName ?? '');

  const [includePosture, setIncludePosture] = useState<boolean>(
    defaultType ? defaultType === 'posture' : Boolean(prefillControlID)
  );
  const [includeVulnerability, setIncludeVulnerability] = useState<boolean>(
    defaultType ? defaultType === 'vulnerability' : Boolean(prefillCVEID)
  );

  const [posture, setPosture] = useState<PostureEntryForm>({
    controlID: prefillControlID ?? '',
    frameworkName: '',
    action: 'alert_only',
  });

  const [vulnerability, setVulnerability] = useState<VulnerabilityEntryForm>({
    cveId: prefillCVEID ?? '',
    status: 'not_affected',
    justification: '',
    impactStatement: '',
    expiredOnFix: false,
  });

  const [author, setAuthor] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');

  const validation = useMemo(
    () => validateStep(activeStep),
    [
      activeStep,
      kind,
      namespace,
      workloadKind,
      workloadName,
      includePosture,
      includeVulnerability,
      posture,
      vulnerability,
      reason,
      expiresAt,
    ]
  );

  function validateStep(step: number): ValidationResult {
    switch (step) {
      case 0:
        return validateScope();
      case 1:
        return validateExceptionType();
      case 2:
        return validateMetadata();
      case 3:
        return validateAll();
      default:
        return { valid: true, errors: {} };
    }
  }

  function validateScope(): ValidationResult {
    const errors: FormErrors = {};
    if (!kind) {
      errors.kind = 'Select a kind';
    }
    if (kind === 'SecurityException' && !namespace.trim()) {
      errors.namespace = 'Namespace is required for SecurityException';
    }
    if (!workloadKind.trim()) {
      errors.workloadKind = 'Workload kind is required';
    }
    if (!workloadName.trim()) {
      errors.workloadName = 'Workload name is required';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateExceptionType(): ValidationResult {
    const errors: FormErrors = {};
    if (!includePosture && !includeVulnerability) {
      errors.exceptionType = 'Select posture, vulnerability, or both';
    }
    if (includePosture) {
      if (!posture.controlID.trim()) {
        errors.controlID = 'Control ID is required';
      }
      if (!postureActions.includes(posture.action)) {
        errors.action = 'Action must be ignore or alert_only';
      }
    }
    if (includeVulnerability) {
      if (!vulnerability.cveId.trim()) {
        errors.cveId = 'CVE ID is required';
      }
      if (!vulnerabilityStatuses.includes(vulnerability.status)) {
        errors.status = 'Status must be not_affected, fixed, or under_investigation';
      }
      if (vulnerability.status === 'not_affected' && !vulnerability.justification) {
        errors.justification = 'Justification is required when status is not_affected';
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateMetadata(): ValidationResult {
    const errors: FormErrors = {};
    if (!reason.trim()) {
      errors.reason = 'Reason is required';
    }
    if (expiresAt && !isFutureDate(expiresAt)) {
      errors.expiresAt = 'Expires at must be a future date';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateAll(): ValidationResult {
    const scope = validateScope();
    const type = validateExceptionType();
    const meta = validateMetadata();
    return {
      valid: scope.valid && type.valid && meta.valid,
      errors: { ...scope.errors, ...type.errors, ...meta.errors },
    };
  }

  async function handleSubmit() {
    const allValidation = validateAll();
    if (!allValidation.valid) {
      setErrorMessage('Fix validation errors before submitting');
      setActiveStep(firstInvalidStep(allValidation.errors));
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const manifest = buildManifest();
      const created = (await postWithVersionFallback(manifest, kind, namespace)) as SecurityExceptionResource;
      setCreatedResource(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create SecurityException';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function postWithVersionFallback(manifest: SecurityExceptionResource, kind: SecurityExceptionKind, ns: string) {
    // try v1 first, then fall back to v1beta1 if 404/not found
    const tryPost = async (version: 'v1' | 'v1beta1') => {
      const m = { ...manifest, apiVersion: `kubescape.io/${version}` };
      const path =
        kind === 'SecurityException'
          ? `/apis/kubescape.io/${version}/namespaces/${encodeURIComponent(ns)}/securityexceptions`
          : `/apis/kubescape.io/${version}/clustersecurityexceptions`;
      return post(path, m);
    };

    try {
      return await tryPost('v1');
    } catch (err: any) {
      const message = err?.message ?? String(err);
      const isNotFound = message.includes('404') || message.toLowerCase().includes('not found');
      if (isNotFound) {
        return await tryPost('v1beta1');
      }
      throw err;
    }
  }

  function buildManifest(): SecurityExceptionResource {
    const match = buildMatch();
    const spec: SecurityExceptionSpec = {
      reason: reason.trim(),
    };
    if (author.trim()) {
      spec.author = author.trim();
    }
    if (expiresAt) {
      spec.expiresAt = new Date(expiresAt).toISOString();
    }
    if (match) {
      spec.match = match;
    }
    if (includePosture) {
      spec.posture = [
        {
          controlID: posture.controlID.trim(),
          frameworkName: posture.frameworkName.trim() || undefined,
          action: posture.action,
        },
      ];
    }
    if (includeVulnerability) {
      spec.vulnerabilities = [
        {
          vulnerability: {
            id: vulnerability.cveId.trim(),
          },
          status: vulnerability.status,
          justification:
            vulnerability.status === 'not_affected'
              ? (vulnerability.justification as VulnerabilityJustification)
              : undefined,
          impactStatement: vulnerability.impactStatement.trim() || undefined,
          expiredOnFix: vulnerability.expiredOnFix,
        },
      ];
    }

    const manifest: SecurityExceptionResource = {
      apiVersion: 'kubescape.io/v1',
      kind,
      metadata: {
        generateName: buildGenerateName(),
      },
      spec,
    };

    if (kind === 'SecurityException') {
      manifest.metadata.namespace = namespace.trim();
    }
    return manifest;
  }

  function buildMatch(): SecurityExceptionMatch | undefined {
    const match: SecurityExceptionMatch = {};
    if (workloadKind.trim()) {
      match.resources = [
        {
          kind: workloadKind.trim(),
          name: workloadName.trim() || undefined,
        },
      ];
    }
    if (kind === 'ClusterSecurityException' && namespace.trim()) {
      match.namespaceSelector = {
        matchLabels: {
          'kubernetes.io/metadata.name': namespace.trim(),
        },
      };
    }
    if (Object.keys(match).length === 0) {
      return undefined;
    }
    return match;
  }

  function buildGenerateName(): string {
    const source = [
      includePosture ? posture.controlID : '',
      includeVulnerability ? vulnerability.cveId : '',
      workloadName,
    ]
      .filter(Boolean)
      .join('-');
    const prefix = sanitizeName(source).slice(0, 45) || 'securityexception';
    return `${prefix}-`;
  }

  function buildApiPath(exceptionKind: SecurityExceptionKind, ns: string): string {
    if (exceptionKind === 'SecurityException') {
      return `/apis/kubescape.io/v1/namespaces/${encodeURIComponent(ns)}/securityexceptions`;
    }
    return '/apis/kubescape.io/v1/clustersecurityexceptions';
  }

  function firstInvalidStep(errors: FormErrors): number {
    if (errors.kind || errors.namespace || errors.workloadKind || errors.workloadName) {
      return 0;
    }
    if (
      errors.exceptionType ||
      errors.controlID ||
      errors.action ||
      errors.cveId ||
      errors.status ||
      errors.justification
    ) {
      return 1;
    }
    if (errors.reason || errors.expiresAt) {
      return 2;
    }
    return 3;
  }

  function isFutureDate(value: string): boolean {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }
    return parsed.getTime() > Date.now();
  }

  function sanitizeName(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildDetailUrl(resource: SecurityExceptionResource): string | null {
    if (!resource.metadata.name) {
      return null;
    }
    const cluster = getCluster() ?? '';
    const plural =
      resource.kind === 'SecurityException' ? 'securityexceptions' : 'clustersecurityexceptions';
    const namespaceSegment =
      resource.kind === 'SecurityException' && resource.metadata.namespace
        ? `/${encodeURIComponent(resource.metadata.namespace)}`
        : '';
    return `/c/${encodeURIComponent(cluster)}/customresources/kubescape.io/v1/${plural}${namespaceSegment}/${encodeURIComponent(
      resource.metadata.name
    )}`;
  }

  const isComplete = Boolean(createdResource);
  const canContinue = validation.valid && !isSubmitting && !isComplete;
  const detailUrl = createdResource ? buildDetailUrl(createdResource) : null;

  return (
    <div className="flex flex-col gap-6">
      <Stepper activeStep={activeStep}>
        {steps.map(step => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {errorMessage && <ErrorContainer> {errorMessage} </ErrorContainer>}

      {createdResource && (
        <Alert severity="success" className="flex flex-col gap-2">
          <Typography variant="body1">
            Created {createdResource.kind}: {createdResource.metadata.name}
          </Typography>
          {detailUrl && <Link href={detailUrl}>View details</Link>}
        </Alert>
      )}

      {activeStep === 0 && (
        <Stack spacing={2} className="rounded border border-slate-200 p-4">
          <FormControl>
            <Typography variant="subtitle1">Kind</Typography>
            <RadioGroup
              row
              value={kind}
              onChange={event => setKind(event.target.value as SecurityExceptionKind)}
            >
              <FormControlLabel
                value="SecurityException"
                control={<Radio />}
                label="SecurityException (namespaced)"
              />
              <FormControlLabel
                value="ClusterSecurityException"
                control={<Radio />}
                label="ClusterSecurityException (cluster-scoped)"
              />
            </RadioGroup>
            {validation.errors.kind && (
              <FormHelperText error>{validation.errors.kind}</FormHelperText>
            )}
          </FormControl>

          {kind === 'SecurityException' && (
            <TextField
              label="Namespace"
              value={namespace}
              onChange={event => setNamespace(event.target.value)}
              error={Boolean(validation.errors.namespace)}
              helperText={validation.errors.namespace}
              fullWidth
            />
          )}

          <TextField
            label="Workload kind"
            value={workloadKind}
            onChange={event => setWorkloadKind(event.target.value)}
            error={Boolean(validation.errors.workloadKind)}
            helperText={validation.errors.workloadKind}
            fullWidth
          />
          <TextField
            label="Workload name"
            value={workloadName}
            onChange={event => setWorkloadName(event.target.value)}
            error={Boolean(validation.errors.workloadName)}
            helperText={validation.errors.workloadName}
            fullWidth
          />
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={3} className="rounded border border-slate-200 p-4">
          {!defaultType ? (
            <>
              <FormControlLabel
                control={
                  <Switch checked={includePosture} onChange={event => setIncludePosture(event.target.checked)} />
                }
                label="Posture exception"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeVulnerability}
                    onChange={event => setIncludeVulnerability(event.target.checked)}
                  />
                }
                label="Vulnerability exception"
              />
            </>
          ) : (
            <Typography variant="body2">
              Creating {defaultType === 'posture' ? 'a posture' : 'a vulnerability'} exception.
            </Typography>
          )}
          {validation.errors.exceptionType && (
            <FormHelperText error>{validation.errors.exceptionType}</FormHelperText>
          )}

          {includePosture && (
            <Box className="flex flex-col gap-3">
              <Typography variant="subtitle1">Posture</Typography>
              <TextField
                label="Control ID"
                value={posture.controlID}
                onChange={event => setPosture({ ...posture, controlID: event.target.value })}
                error={Boolean(validation.errors.controlID)}
                helperText={validation.errors.controlID}
                fullWidth
              />
              <TextField
                label="Framework name"
                value={posture.frameworkName}
                onChange={event => setPosture({ ...posture, frameworkName: event.target.value })}
                fullWidth
              />
              <FormControl error={Boolean(validation.errors.action)}>
                <InputLabel id="posture-action-label">Action</InputLabel>
                <Select
                  labelId="posture-action-label"
                  label="Action"
                  value={posture.action}
                  onChange={event =>
                    setPosture({ ...posture, action: event.target.value as PostureAction })
                  }
                >
                  {postureActions.map(action => (
                    <MenuItem key={action} value={action}>
                      {action}
                    </MenuItem>
                  ))}
                </Select>
                {validation.errors.action && (
                  <FormHelperText>{validation.errors.action}</FormHelperText>
                )}
              </FormControl>
            </Box>
          )}

          {includeVulnerability && (
            <Box className="flex flex-col gap-3">
              <Typography variant="subtitle1">Vulnerability</Typography>
              <TextField
                label="CVE ID"
                value={vulnerability.cveId}
                onChange={event => setVulnerability({ ...vulnerability, cveId: event.target.value })}
                error={Boolean(validation.errors.cveId)}
                helperText={validation.errors.cveId}
                fullWidth
              />
              <FormControl error={Boolean(validation.errors.status)}>
                <InputLabel id="vuln-status-label">Status</InputLabel>
                <Select
                  labelId="vuln-status-label"
                  label="Status"
                  value={vulnerability.status}
                  onChange={event =>
                    setVulnerability({
                      ...vulnerability,
                      status: event.target.value as VulnerabilityStatus,
                    })
                  }
                >
                  {vulnerabilityStatuses.map(status => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
                {validation.errors.status && (
                  <FormHelperText>{validation.errors.status}</FormHelperText>
                )}
              </FormControl>
              {vulnerability.status === 'not_affected' && (
                <FormControl error={Boolean(validation.errors.justification)}>
                  <InputLabel id="vuln-justification-label">Justification</InputLabel>
                  <Select
                    labelId="vuln-justification-label"
                    label="Justification"
                    value={vulnerability.justification}
                    onChange={event =>
                      setVulnerability({
                        ...vulnerability,
                        justification: event.target.value as VulnerabilityJustification,
                      })
                    }
                  >
                    {vulnerabilityJustifications.map(justification => (
                      <MenuItem key={justification} value={justification}>
                        {justification}
                      </MenuItem>
                    ))}
                  </Select>
                  {validation.errors.justification && (
                    <FormHelperText>{validation.errors.justification}</FormHelperText>
                  )}
                </FormControl>
              )}
              <TextField
                label="Impact statement"
                value={vulnerability.impactStatement}
                onChange={event =>
                  setVulnerability({ ...vulnerability, impactStatement: event.target.value })
                }
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={vulnerability.expiredOnFix}
                    onChange={event =>
                      setVulnerability({ ...vulnerability, expiredOnFix: event.target.checked })
                    }
                  />
                }
                label="Expire exception when a fix is available"
              />
            </Box>
          )}
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack spacing={2} className="rounded border border-slate-200 p-4">
          <TextField
            label="Author"
            value={author}
            onChange={event => setAuthor(event.target.value)}
            fullWidth
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            error={Boolean(validation.errors.reason)}
            helperText={validation.errors.reason}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label="Expires at"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={expiresAt}
            onChange={event => setExpiresAt(event.target.value)}
            error={Boolean(validation.errors.expiresAt)}
            helperText={validation.errors.expiresAt}
            fullWidth
          />
        </Stack>
      )}

      {activeStep === 3 && (
        <Stack spacing={2} className="rounded border border-slate-200 p-4">
          <Typography variant="subtitle1">Review</Typography>
          <NameValueTable
            rows={[
              { name: 'Kind', value: kind },
              {
                name: 'Namespace',
                value: kind === 'SecurityException' ? namespace : 'cluster-scoped',
              },
              { name: 'Workload', value: `${workloadKind}/${workloadName}` },
              {
                name: 'Posture',
                value: includePosture
                  ? `${posture.controlID}${posture.frameworkName ? ` (${posture.frameworkName})` : ''}, ${posture.action}`
                  : 'none',
              },
              {
                name: 'Vulnerability',
                value: includeVulnerability
                  ? `${vulnerability.cveId}, ${vulnerability.status}`
                  : 'none',
              },
              { name: 'Justification', value: vulnerability.justification || 'n/a' },
              { name: 'Impact statement', value: vulnerability.impactStatement || 'n/a' },
              { name: 'Expired on fix', value: vulnerability.expiredOnFix ? 'true' : 'false' },
              { name: 'Author', value: author || 'n/a' },
              { name: 'Reason', value: reason },
              { name: 'Expires at', value: expiresAt || 'n/a' },
            ]}
          />
        </Stack>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={() => setActiveStep(prev => Math.max(prev - 1, 0))}
          disabled={activeStep === 0 || isSubmitting || isComplete}
        >
          Back
        </Button>
        {activeStep < steps.length - 1 && (
          <Button
            variant="contained"
            onClick={() => {
              if (canContinue) {
                setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
              } else {
                setErrorMessage('Fix validation errors before continuing');
              }
            }}
            disabled={!canContinue}
          >
            Next
          </Button>
        )}
        {activeStep === steps.length - 1 && (
          <Button variant="contained" onClick={handleSubmit} disabled={!canContinue}>
            Confirm and Create
          </Button>
        )}
      </Stack>
    </div>
export function SecurityExceptionForm(props: Readonly<SecurityExceptionFormProps>) {
  const {
    existing,
    controlID,
    frameworkName,
    cveId,
    imageRef,
    vulnerabilityContext,
    workloadName,
    workloadNamespace,
    workloadKind,
    onClose,
  } = props;
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = !!existing;
  const isFromCompliance = !!controlID;
  const isFromVuln = !!cveId || !!vulnerabilityContext;

  const [clusterScoped, setClusterScoped] = useState(
    existing ? existing.kind === 'ClusterSecurityException' : false
  );
  const [name, setName] = useState(() => {
    if (existing?.metadata.name) return existing.metadata.name;
    if (cveId && workloadName) return sanitizeName(`${cveId}-${workloadName}`);
    if (controlID && workloadName) return sanitizeName(`${controlID}-${workloadName}`);
    if (workloadName) return sanitizeName(workloadName);
    return '';
  });
  const [namespace, setNamespace] = useState(
    existing?.kind === 'SecurityException' ? existing.metadata.namespace : workloadNamespace ?? ''
  );
  const [reason, setReason] = useState(existing?.spec.reason ?? '');
  const [expiresDate, setExpiresDate] = useState(
    existing?.spec.expiresAt ? existing.spec.expiresAt.split('T')[0] : ''
  );

  const [namespaceSelectorRows, setNamespaceSelectorRows] = useState<NsSelectorRow[]>(
    existing?.kind === 'ClusterSecurityException' &&
      existing.spec.match?.namespaceSelector?.matchLabels
      ? Object.entries(existing.spec.match.namespaceSelector.matchLabels).map(([key, value]) => ({
          key,
          value,
        }))
      : []
  );

  const [resources, setResources] = useState<ResourceRow[]>(
    existing?.spec.match?.resources?.map(r => ({ kind: r.kind, name: r.name ?? '' })) ??
      (workloadName && workloadKind ? [{ kind: workloadKind, name: workloadName }] : [])
  );

  const [images, setImages] = useState<string[]>(
    existing?.spec.match?.images ?? (imageRef ? [imageRef] : [])
  );

  const [postureEntries, setPostureEntries] = useState<PostureRow[]>(
    existing?.spec.posture?.map(p => ({
      controlID: p.controlID,
      frameworkName: p.frameworkName ?? '',
      action: p.action,
    })) ??
      (isFromCompliance && controlID
        ? [{ controlID, frameworkName: frameworkName ?? '', action: 'ignore' as const }]
        : [])
  );

  const [vulnEntries, setVulnEntries] = useState<VulnRow[]>(
    existing?.spec.vulnerabilities?.map(v => ({
      cveId: v.vulnerability.id,
      status: v.status,
      justification: v.justification ?? '',
      impactStatement: v.impactStatement ?? '',
      expiredOnFix: v.expiredOnFix ?? false,
    })) ??
      (isFromVuln && cveId
        ? [
            {
              cveId,
              status: 'under_investigation' as const,
              justification: '',
              impactStatement: '',
              expiredOnFix: false,
            },
          ]
        : [])
  );

  function buildScopeSummary(): string {
    const activeResources = resources.filter(r => r.kind);
    const activeNsSelector = namespaceSelectorRows.filter(r => r.key);

    const resourceDesc =
      activeResources.length === 0
        ? 'all workloads'
        : activeResources
            .map(r => (r.name ? `${r.kind}/${r.name}` : `all ${r.kind} resources`))
            .join(', ');

    if (clusterScoped) {
      const nsDesc =
        activeNsSelector.length > 0
          ? `namespaces labelled ${activeNsSelector
              .map(r => `${r.key}=${r.value || '…'}`)
              .join(', ')}`
          : 'all namespaces';
      return `Applies to ${resourceDesc} in ${nsDesc}`;
    }
    if (!namespace) return '';
    return `Applies to ${resourceDesc} in namespace "${namespace}"`;
  }

  const handleSubmit = async () => {
    if (!name) {
      enqueueSnackbar('Name is required', { variant: 'error' });
      return;
    }
    if (!clusterScoped && !namespace) {
      enqueueSnackbar('Namespace is required for namespaced exceptions', { variant: 'error' });
      return;
    }
    const missingJustification = vulnEntries.find(
      v => v.cveId && v.status === 'not_affected' && !v.justification
    );
    if (missingJustification) {
      enqueueSnackbar(
        `Justification is required for "${missingJustification.cveId}" when status is not_affected`,
        { variant: 'error' }
      );
      return;
    }

    const validResources = resources.filter(r => r.kind);
    const validNsSelector = namespaceSelectorRows.filter(r => r.key);

    const matchSpec: Record<string, any> = {};
    if (clusterScoped && validNsSelector.length > 0) {
      matchSpec.namespaceSelector = {
        matchLabels: Object.fromEntries(validNsSelector.map(r => [r.key, r.value])),
      };
    }
    if (validResources.length > 0) {
      matchSpec.resources = validResources.map(r => ({
        kind: r.kind,
        ...(r.name && { name: r.name }),
      })) as ResourceMatch[];
    }
    const validImages = images.filter(Boolean);
    if (validImages.length > 0) {
      matchSpec.images = validImages;
    }

    const validPosture = postureEntries.filter(p => p.controlID);
    const validVulns = vulnEntries.filter(v => v.cveId);

    const spec = {
      ...(reason && { reason }),
      ...(expiresDate && { expiresAt: `${expiresDate}T00:00:00Z` }),
      match: matchSpec,
      ...(validPosture.length > 0 && {
        posture: validPosture.map(p => ({
          controlID: p.controlID,
          ...(p.frameworkName && { frameworkName: p.frameworkName }),
          action: p.action,
        })) as PostureException[],
      }),
      ...(validVulns.length > 0 && {
        vulnerabilities: validVulns.map(v => ({
          vulnerability: { id: v.cveId },
          status: v.status,
          ...(v.justification && { justification: v.justification }),
          ...(v.impactStatement && { impactStatement: v.impactStatement }),
          ...(v.expiredOnFix && { expiredOnFix: v.expiredOnFix }),
        })) as VulnerabilityException[],
      }),
    };

    try {
      if (clusterScoped) {
        const obj: ClusterSecurityException = {
          ...(existing as ClusterSecurityException),
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'ClusterSecurityException',
          metadata: { ...existing?.metadata, name },
          spec,
        };
        if (isEdit) {
          await put(`/apis/kubescape.io/v1beta1/clustersecurityexceptions/${name}`, obj as any);
        } else {
          await post('/apis/kubescape.io/v1beta1/clustersecurityexceptions', obj);
        }
      } else {
        const obj: SecurityException = {
          ...(existing as SecurityException),
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'SecurityException',
          metadata: { ...existing?.metadata, name, namespace },
          spec,
        };
        if (isEdit) {
          await put(
            `/apis/kubescape.io/v1beta1/namespaces/${namespace}/securityexceptions/${name}`,
            obj as any
          );
        } else {
          await post(`/apis/kubescape.io/v1beta1/namespaces/${namespace}/securityexceptions`, obj);
        }
      }
      enqueueSnackbar(`Security exception ${isEdit ? 'updated' : 'created'}`, {
        variant: 'success',
      });
      onClose();
    } catch (err: any) {
      enqueueSnackbar(`Failed to ${isEdit ? 'update' : 'create'}: ${err?.message ?? err}`, {
        variant: 'error',
      });
    }
  };

  const scopeSummary = buildScopeSummary();
  const dialogTitle = `${isEdit ? 'Edit' : 'Create'} ${
    isFromVuln ? 'Vulnerability' : 'Security'
  } Exception`;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Scope */}
          <FormControlLabel
            control={
              <Switch
                checked={clusterScoped}
                onChange={e => setClusterScoped(e.target.checked)}
                disabled={isEdit}
              />
            }
            label="Cluster-scoped"
          />
          <MetadataFields
            name={name}
            onNameChange={setName}
            nameDisabled={isEdit}
            namespace={clusterScoped ? undefined : namespace}
            onNamespaceChange={isEdit ? undefined : setNamespace}
            reason={reason}
            onReasonChange={setReason}
            expiresDate={expiresDate}
            onExpiresDateChange={setExpiresDate}
          />

          {/* Namespace selector (ClusterSecurityException only) */}
          {clusterScoped && (
            <>
              <SectionTitle title="Match — Namespace Selector" />
              {namespaceSelectorRows.map((r, i) => (
                <Stack key={`nssel-${i}`} direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Label key"
                    value={r.key}
                    onChange={e => {
                      const updated = [...namespaceSelectorRows];
                      updated[i] = { ...r, key: e.target.value };
                      setNamespaceSelectorRows(updated);
                    }}
                  />
                  <TextField
                    label="Label value"
                    value={r.value}
                    onChange={e => {
                      const updated = [...namespaceSelectorRows];
                      updated[i] = { ...r, value: e.target.value };
                      setNamespaceSelectorRows(updated);
                    }}
                  />
                  <IconButton
                    onClick={() =>
                      setNamespaceSelectorRows(namespaceSelectorRows.filter((_, idx) => idx !== i))
                    }
                  >
                    <Icon icon="mdi:delete" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<Icon icon="mdi:plus" />}
                onClick={() =>
                  setNamespaceSelectorRows([...namespaceSelectorRows, { key: '', value: '' }])
                }
                size="small"
              >
                Add namespace label
              </Button>
            </>
          )}

          {/* Scope summary */}
          {scopeSummary && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {scopeSummary}
            </Typography>
          )}

          {/* Match — Resources */}
          <SectionTitle title="Match — Resources" />
          {resources.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No resources added — exception applies to all workloads in scope. Add a resource to
              narrow the match.
            </Typography>
          ) : (
            resources.map((r, i) => (
              <Stack key={`res-${i}`} direction="row" spacing={1} alignItems="center">
                <FormControl sx={{ minWidth: 160 }}>
                  <InputLabel>Kind</InputLabel>
                  <Select
                    value={r.kind}
                    label="Kind"
                    onChange={e => {
                      const updated = [...resources];
                      updated[i] = { ...r, kind: e.target.value };
                      setResources(updated);
                    }}
                  >
                    {RESOURCE_KINDS.map(k => (
                      <MenuItem key={k} value={k}>
                        {k}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Name"
                  placeholder="any (matches all)"
                  value={r.name}
                  onChange={e => {
                    const updated = [...resources];
                    updated[i] = { ...r, name: e.target.value };
                    setResources(updated);
                  }}
                />
                <IconButton onClick={() => setResources(resources.filter((_, idx) => idx !== i))}>
                  <Icon icon="mdi:delete" />
                </IconButton>
              </Stack>
            ))
          )}
          <Button
            startIcon={<Icon icon="mdi:plus" />}
            onClick={() => setResources([...resources, { kind: '', name: '' }])}
            size="small"
          >
            Add resource
          </Button>

          {/* Match — Images */}
          <SectionTitle title="Match — Images" />
          {images.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No image patterns — exception applies to all images. Add a pattern to narrow the
              match.
            </Typography>
          ) : (
            images.map((img, i) => (
              <Stack key={`img-${i}`} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Image glob"
                  placeholder="docker.io/library/nginx:*"
                  fullWidth
                  value={img}
                  onChange={e => {
                    const updated = [...images];
                    updated[i] = e.target.value;
                    setImages(updated);
                  }}
                />
                <Tooltip title="Patterns are matched against fully-qualified image references, e.g. docker.io/library/nginx:1.25">
                  <Icon icon="mdi:information-outline" />
                </Tooltip>
                <IconButton onClick={() => setImages(images.filter((_, idx) => idx !== i))}>
                  <Icon icon="mdi:delete" />
                </IconButton>
              </Stack>
            ))
          )}
          <Button
            startIcon={<Icon icon="mdi:plus" />}
            onClick={() => setImages([...images, ''])}
            size="small"
          >
            Add image pattern
          </Button>

          {/* Posture exceptions */}
          {(isFromCompliance || postureEntries.length > 0) && (
            <>
              <SectionTitle title="Posture Exceptions" />
              {postureEntries.map((p, i) => (
                <Stack key={`posture-${i}`} direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Control ID"
                    value={p.controlID}
                    onChange={e => {
                      const updated = [...postureEntries];
                      updated[i] = { ...p, controlID: e.target.value };
                      setPostureEntries(updated);
                    }}
                  />
                  <TextField
                    label="Framework"
                    value={p.frameworkName}
                    onChange={e => {
                      const updated = [...postureEntries];
                      updated[i] = { ...p, frameworkName: e.target.value };
                      setPostureEntries(updated);
                    }}
                  />
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Action</InputLabel>
                    <Select
                      value={p.action}
                      label="Action"
                      onChange={e => {
                        const updated = [...postureEntries];
                        updated[i] = { ...p, action: e.target.value as 'ignore' | 'alert_only' };
                        setPostureEntries(updated);
                      }}
                    >
                      <MenuItem value="ignore">ignore</MenuItem>
                      <MenuItem value="alert_only">alert_only</MenuItem>
                    </Select>
                  </FormControl>
                  <IconButton
                    onClick={() => setPostureEntries(postureEntries.filter((_, idx) => idx !== i))}
                  >
                    <Icon icon="mdi:delete" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<Icon icon="mdi:plus" />}
                onClick={() =>
                  setPostureEntries([
                    ...postureEntries,
                    { controlID: '', frameworkName: '', action: 'ignore' },
                  ])
                }
                size="small"
              >
                Add posture entry
              </Button>
            </>
          )}

          {/* Vulnerability exceptions */}
          {(isFromVuln || vulnEntries.length > 0) && (
            <>
              <SectionTitle title="Vulnerability Exceptions" />
              {vulnEntries.map((v, i) => (
                <Stack
                  key={`vuln-${i}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <TextField
                    label="CVE ID"
                    value={v.cveId}
                    onChange={e => {
                      const updated = [...vulnEntries];
                      updated[i] = { ...v, cveId: e.target.value };
                      setVulnEntries(updated);
                    }}
                  />
                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={v.status}
                      label="Status"
                      onChange={e => {
                        const updated = [...vulnEntries];
                        updated[i] = { ...v, status: e.target.value as VulnerabilityStatus };
                        setVulnEntries(updated);
                      }}
                    >
                      <MenuItem value="not_affected">not_affected</MenuItem>
                      <MenuItem value="fixed">fixed</MenuItem>
                      <MenuItem value="under_investigation">under_investigation</MenuItem>
                    </Select>
                  </FormControl>
                  {v.status === 'not_affected' && (
                    <FormControl sx={{ minWidth: 240 }}>
                      <InputLabel>Justification</InputLabel>
                      <Select
                        value={v.justification}
                        label="Justification"
                        required
                        onChange={e => {
                          const updated = [...vulnEntries];
                          updated[i] = {
                            ...v,
                            justification: e.target.value as VulnerabilityJustification,
                          };
                          setVulnEntries(updated);
                        }}
                      >
                        {JUSTIFICATION_OPTIONS.map(opt => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  <TextField
                    label="Impact statement"
                    value={v.impactStatement}
                    onChange={e => {
                      const updated = [...vulnEntries];
                      updated[i] = { ...v, impactStatement: e.target.value };
                      setVulnEntries(updated);
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={v.expiredOnFix}
                        onChange={e => {
                          const updated = [...vulnEntries];
                          updated[i] = { ...v, expiredOnFix: e.target.checked };
                          setVulnEntries(updated);
                        }}
                      />
                    }
                    label="Expired on fix"
                  />
                  <IconButton
                    onClick={() => setVulnEntries(vulnEntries.filter((_, idx) => idx !== i))}
                  >
                    <Icon icon="mdi:delete" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<Icon icon="mdi:plus" />}
                onClick={() =>
                  setVulnEntries([
                    ...vulnEntries,
                    {
                      cveId: '',
                      status: 'under_investigation',
                      justification: '',
                      impactStatement: '',
                      expiredOnFix: false,
                    },
                  ])
                }
                size="small"
              >
                Add vulnerability entry
              </Button>
            </>
          )}

          {/* Add-section buttons when sections are hidden */}
          {!isFromCompliance && !isFromVuln && postureEntries.length === 0 && (
            <Button
              startIcon={<Icon icon="mdi:plus" />}
              onClick={() =>
                setPostureEntries([{ controlID: '', frameworkName: '', action: 'ignore' }])
              }
              size="small"
            >
              Add posture entry
            </Button>
          )}
          {!isFromVuln && vulnEntries.length === 0 && (
            <Button
              startIcon={<Icon icon="mdi:plus" />}
              onClick={() =>
                setVulnEntries([
                  {
                    cveId: '',
                    status: 'under_investigation',
                    justification: '',
                    impactStatement: '',
                    expiredOnFix: false,
                  },
                ])
              }
              size="small"
            >
              Add vulnerability entry
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
