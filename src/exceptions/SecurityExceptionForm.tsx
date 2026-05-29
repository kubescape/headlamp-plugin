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

type SecurityExceptionKind = 'SecurityException' | 'ClusterSecurityException';
type PostureAction = 'ignore' | 'alert_only';
type VulnerabilityStatus = 'not_affected' | 'fixed' | 'under_investigation';
type VulnerabilityJustification =
  | 'component_not_present'
  | 'vulnerable_code_not_present'
  | 'vulnerable_code_not_in_execute_path'
  | 'vulnerable_code_cannot_be_controlled_by_adversary'
  | 'inline_mitigations_already_exist';

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
const vulnerabilityStatuses: VulnerabilityStatus[] = [
  'not_affected',
  'fixed',
  'under_investigation',
];
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
  } = props;

  const [activeStep, setActiveStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdResource, setCreatedResource] = useState<SecurityExceptionResource | null>(null);

  const [kind, setKind] = useState<SecurityExceptionKind>('SecurityException');
  const [namespace, setNamespace] = useState<string>(prefillNamespace ?? '');
  const [workloadKind, setWorkloadKind] = useState<string>(prefillWorkloadKind ?? '');
  const [workloadName, setWorkloadName] = useState<string>(prefillWorkloadName ?? '');

  const [includePosture, setIncludePosture] = useState<boolean>(Boolean(prefillControlID));
  const [includeVulnerability, setIncludeVulnerability] = useState<boolean>(Boolean(prefillCVEID));

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
      const path = buildApiPath(kind, namespace);
      const created = (await post(path, manifest)) as SecurityExceptionResource;
      setCreatedResource(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create SecurityException';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
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
    const cluster = getCluster();
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

  const canContinue = validation.valid && !isSubmitting;
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
          disabled={activeStep === 0 || isSubmitting}
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
  );
}
