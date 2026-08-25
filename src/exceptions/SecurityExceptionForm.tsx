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
  LabelSelectorRequirement,
  PostureException,
  SecurityException,
  SecurityExceptionSpec,
  VulnerabilityException,
  VulnerabilityJustification,
  VulnerabilityStatus,
} from '../softwarecomposition/SecurityException';
import {
  expiresAtToDate,
  JUSTIFICATION_OPTIONS,
  LabelRow,
  LabelSelectorEditor,
  matchLabelsToRows,
  MetadataFields,
  PostureActionSelect,
  ResourceKindInput,
  rowsToMatchLabels,
  sanitizeName,
  SectionTitle,
  toExpiresAt,
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

export interface ResourceRow {
  kind: string;
  name: string;
  // Not editable in the UI, carried so editing does not drop it.
  apiGroup?: string;
}

export interface PostureRow {
  controlID: string;
  frameworkName: string;
  action: 'ignore' | 'alert_only';
  original?: PostureException;
}

export interface VulnRow {
  cveId: string;
  status: VulnerabilityStatus;
  justification: VulnerabilityJustification | '';
  impactStatement: string;
  expiredOnFix: boolean;
  // Not editable in the UI, carried so editing does not drop them.
  aliases?: string[];
  original?: VulnerabilityException;
}

export interface ExceptionSpecInput {
  /** The spec as stored, so fields with no editor here survive an edit. */
  existingSpec?: SecurityExceptionSpec;
  clusterScoped: boolean;
  author: string;
  reason: string;
  expiresDate: string;
  namespaceSelectorRows: LabelRow[];
  objectSelectorRows: LabelRow[];
  preservedNamespaceExpressions: LabelSelectorRequirement[];
  preservedObjectExpressions: LabelSelectorRequirement[];
  resources: ResourceRow[];
  images: string[];
  postureEntries: PostureRow[];
  vulnEntries: VulnRow[];
}

function setOrDelete(target: Record<string, any>, key: string, value: any) {
  if (value === undefined || value === '' || value === false) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function buildSelector(rows: LabelRow[], expressions: LabelSelectorRequirement[]) {
  const matchLabels = rowsToMatchLabels(rows);
  const hasLabels = Object.keys(matchLabels).length > 0;
  if (!hasLabels && expressions.length === 0) return undefined;
  return {
    ...(hasLabels && { matchLabels }),
    ...(expressions.length > 0 && { matchExpressions: expressions }),
  };
}

/**
 * Builds the spec on top of the stored one so fields this form has no editor for
 * (anything the CRD gains later, and the selector matchExpressions) survive an
 * edit instead of being silently dropped.
 */
export function buildExceptionSpec(input: ExceptionSpecInput): Record<string, any> {
  const {
    existingSpec,
    clusterScoped,
    author,
    reason,
    expiresDate,
    namespaceSelectorRows,
    objectSelectorRows,
    preservedNamespaceExpressions,
    preservedObjectExpressions,
    resources,
    images,
    postureEntries,
    vulnEntries,
  } = input;

  const spec: Record<string, any> = { ...(existingSpec ?? {}) };

  setOrDelete(spec, 'author', author.trim());
  setOrDelete(spec, 'reason', reason.trim());
  setOrDelete(spec, 'expiresAt', expiresDate ? toExpiresAt(expiresDate) : '');

  const match: Record<string, any> = { ...(existingSpec?.match ?? {}) };

  // namespaceSelector is rejected by admission on a namespaced SecurityException.
  setOrDelete(
    match,
    'namespaceSelector',
    clusterScoped ? buildSelector(namespaceSelectorRows, preservedNamespaceExpressions) : undefined
  );
  setOrDelete(match, 'objectSelector', buildSelector(objectSelectorRows, preservedObjectExpressions));

  const validResources = resources.filter(r => r.kind);
  setOrDelete(
    match,
    'resources',
    validResources.length > 0
      ? validResources.map(r => ({
          ...(r.apiGroup && { apiGroup: r.apiGroup }),
          kind: r.kind,
          ...(r.name && { name: r.name }),
        }))
      : undefined
  );

  const validImages = images.filter(Boolean);
  setOrDelete(match, 'images', validImages.length > 0 ? validImages : undefined);

  spec.match = match;

  const validPosture = postureEntries.filter(p => p.controlID);
  setOrDelete(
    spec,
    'posture',
    validPosture.length > 0
      ? validPosture.map(p => {
          const entry: Record<string, any> = { ...(p.original ?? {}) };
          entry.controlID = p.controlID;
          entry.action = p.action;
          setOrDelete(entry, 'frameworkName', p.frameworkName.trim());
          return entry as PostureException;
        })
      : undefined
  );

  const validVulns = vulnEntries.filter(v => v.cveId);
  setOrDelete(
    spec,
    'vulnerabilities',
    validVulns.length > 0
      ? validVulns.map(v => {
          const entry: Record<string, any> = { ...(v.original ?? {}) };
          entry.vulnerability = {
            id: v.cveId,
            ...(v.aliases && v.aliases.length > 0 && { aliases: v.aliases }),
          };
          entry.status = v.status;
          setOrDelete(entry, 'justification', v.justification);
          setOrDelete(entry, 'impactStatement', v.impactStatement.trim());
          setOrDelete(entry, 'expiredOnFix', v.expiredOnFix);
          return entry as VulnerabilityException;
        })
      : undefined
  );

  return spec;
}

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
  const [author, setAuthor] = useState(existing?.spec.author ?? '');
  const [reason, setReason] = useState(existing?.spec.reason ?? '');
  const [expiresDate, setExpiresDate] = useState(expiresAtToDate(existing?.spec.expiresAt));

  const [namespaceSelectorRows, setNamespaceSelectorRows] = useState<LabelRow[]>(
    existing?.kind === 'ClusterSecurityException'
      ? matchLabelsToRows(existing.spec.match?.namespaceSelector?.matchLabels)
      : []
  );
  const [objectSelectorRows, setObjectSelectorRows] = useState<LabelRow[]>(
    matchLabelsToRows(existing?.spec.match?.objectSelector?.matchLabels)
  );

  // matchExpressions have no editor here, so keep them verbatim.
  const preservedNamespaceExpressions: LabelSelectorRequirement[] =
    existing?.spec.match?.namespaceSelector?.matchExpressions ?? [];
  const preservedObjectExpressions: LabelSelectorRequirement[] =
    existing?.spec.match?.objectSelector?.matchExpressions ?? [];

  const [resources, setResources] = useState<ResourceRow[]>(
    existing?.spec.match?.resources?.map(r => ({
      kind: r.kind,
      name: r.name ?? '',
      apiGroup: r.apiGroup,
    })) ?? (workloadName && workloadKind ? [{ kind: workloadKind, name: workloadName }] : [])
  );

  const [images, setImages] = useState<string[]>(
    existing?.spec.match?.images ?? (imageRef ? [imageRef] : [])
  );

  const [postureEntries, setPostureEntries] = useState<PostureRow[]>(
    existing?.spec.posture?.map(p => ({
      controlID: p.controlID,
      frameworkName: p.frameworkName ?? '',
      action: p.action,
      original: p,
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
      aliases: v.vulnerability.aliases,
      original: v,
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
    const activeObjSelector = objectSelectorRows.filter(r => r.key);

    let resourceDesc =
      activeResources.length === 0
        ? 'all workloads'
        : activeResources
            .map(r => (r.name ? `${r.kind}/${r.name}` : `all ${r.kind} resources`))
            .join(', ');

    if (activeObjSelector.length > 0) {
      resourceDesc += ` labelled ${activeObjSelector
        .map(r => `${r.key}=${r.value || '…'}`)
        .join(', ')}`;
    }

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

  function buildSpec(): Record<string, any> {
    return buildExceptionSpec({
      existingSpec: existing?.spec,
      clusterScoped,
      author,
      reason,
      expiresDate,
      namespaceSelectorRows,
      objectSelectorRows,
      preservedNamespaceExpressions,
      preservedObjectExpressions,
      resources,
      images,
      postureEntries,
      vulnEntries,
    });
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

    const spec = buildSpec();

    try {
      if (clusterScoped) {
        const obj = {
          ...(existing as ClusterSecurityException),
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'ClusterSecurityException',
          metadata: { ...existing?.metadata, name },
          spec,
        } as ClusterSecurityException;
        if (isEdit) {
          await put(`/apis/kubescape.io/v1beta1/clustersecurityexceptions/${name}`, obj as any);
        } else {
          await post('/apis/kubescape.io/v1beta1/clustersecurityexceptions', obj);
        }
      } else {
        const obj = {
          ...(existing as SecurityException),
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'SecurityException',
          metadata: { ...existing?.metadata, name, namespace },
          spec,
        } as SecurityException;
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
            author={author}
            onAuthorChange={setAuthor}
            reason={reason}
            onReasonChange={setReason}
            expiresDate={expiresDate}
            onExpiresDateChange={setExpiresDate}
          />

          {/* Namespace selector (ClusterSecurityException only) */}
          {clusterScoped && (
            <>
              <SectionTitle title="Match — Namespace Selector" />
              <LabelSelectorEditor
                rows={namespaceSelectorRows}
                onChange={setNamespaceSelectorRows}
                addLabel="Add namespace label"
                emptyHint="No namespace labels — the exception applies in every namespace."
                preservedExpressions={preservedNamespaceExpressions}
              />
            </>
          )}

          {/* Object selector (labels on the workload itself) */}
          <SectionTitle title="Match — Object Selector" />
          <LabelSelectorEditor
            rows={objectSelectorRows}
            onChange={setObjectSelectorRows}
            addLabel="Add workload label"
            emptyHint="No workload labels — the exception is not narrowed by labels."
            preservedExpressions={preservedObjectExpressions}
          />

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
                <ResourceKindInput
                  value={r.kind}
                  onChange={value => {
                    const updated = [...resources];
                    updated[i] = { ...r, kind: value };
                    setResources(updated);
                  }}
                />
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
                  <PostureActionSelect
                    value={p.action}
                    onChange={action => {
                      const updated = [...postureEntries];
                      updated[i] = { ...p, action };
                      setPostureEntries(updated);
                    }}
                  />
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
