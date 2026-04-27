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
        const url = `/apis/kubescape.io/v1beta1/clustersecurityexceptions/${name}`;
        isEdit
          ? await put(url, obj as any)
          : await post('/apis/kubescape.io/v1beta1/clustersecurityexceptions', obj);
      } else {
        const obj: SecurityException = {
          ...(existing as SecurityException),
          apiVersion: 'kubescape.io/v1beta1',
          kind: 'SecurityException',
          metadata: { ...existing?.metadata, name, namespace },
          spec,
        };
        const url = `/apis/kubescape.io/v1beta1/namespaces/${namespace}/securityexceptions/${name}`;
        isEdit
          ? await put(url, obj as any)
          : await post(
              `/apis/kubescape.io/v1beta1/namespaces/${namespace}/securityexceptions`,
              obj
            );
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
