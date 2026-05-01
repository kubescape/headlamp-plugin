import { Icon } from '@iconify/react';
import { post, put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getURLSegments } from '../common/url';

const SEVERITIES = ['', 'Critical', 'High', 'Medium', 'Low'];
const API_PATH = '/apis/kubescape.io/v1/runtimerulealertbindings';

type LabelEntry = { key: string; value: string };
type ExprEntry = { key: string; operator: string; values: string };
type RuleEntry = { ruleName: string; severity: string };

const OPERATORS = ['In', 'NotIn', 'Exists', 'DoesNotExist'];

function labelsToEntries(matchLabels: Record<string, string> | undefined): LabelEntry[] {
  return Object.entries(matchLabels ?? {}).map(([key, value]) => ({ key, value }));
}

function expressionsToEntries(matchExpressions: any[] | undefined): ExprEntry[] {
  return (matchExpressions ?? []).map(e => ({
    key: e.key ?? '',
    operator: e.operator ?? 'In',
    values: (e.values ?? []).join(', '),
  }));
}

function entriesToMatchLabels(entries: LabelEntry[]): Record<string, string> {
  return Object.fromEntries(entries.filter(e => e.key).map(e => [e.key, e.value]));
}

function entriesToMatchExpressions(entries: ExprEntry[]): any[] {
  return entries
    .filter(e => e.key)
    .map(e => ({
      key: e.key,
      operator: e.operator,
      ...(e.operator === 'In' || e.operator === 'NotIn'
        ? {
            values: e.values
              .split(',')
              .map(v => v.trim())
              .filter(Boolean),
          }
        : {}),
    }));
}

function SelectorEditor({
  label,
  labels,
  expressions,
  onLabelsChange,
  onExpressionsChange,
}: Readonly<{
  label: string;
  labels: LabelEntry[];
  expressions: ExprEntry[];
  onLabelsChange: (v: LabelEntry[]) => void;
  onExpressionsChange: (v: ExprEntry[]) => void;
}>) {
  const updateLabel = (idx: number, field: 'key' | 'value', val: string) =>
    onLabelsChange(labels.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));
  const addLabel = () => onLabelsChange([...labels, { key: '', value: '' }]);
  const removeLabel = (idx: number) => onLabelsChange(labels.filter((_, i) => i !== idx));

  const updateExpr = (idx: number, field: keyof ExprEntry, val: string) =>
    onExpressionsChange(expressions.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));
  const addExpr = () =>
    onExpressionsChange([...expressions, { key: '', operator: 'In', values: '' }]);
  const removeExpr = (idx: number) => onExpressionsChange(expressions.filter((_, i) => i !== idx));

  const isEmpty = labels.length === 0 && expressions.length === 0;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      {isEmpty && (
        <Typography variant="caption" color="text.secondary">
          No selector — matches all
        </Typography>
      )}

      {/* matchLabels */}
      {labels.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          matchLabels
        </Typography>
      )}
      {labels.map((e, idx) => (
        <Stack key={idx} direction="row" spacing={1} sx={{ mb: 0.5 }}>
          <TextField
            size="small"
            label="Key"
            value={e.key}
            onChange={ev => updateLabel(idx, 'key', ev.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Value"
            value={e.value}
            onChange={ev => updateLabel(idx, 'value', ev.target.value)}
            sx={{ flex: 1 }}
          />
          <IconButton size="small" onClick={() => removeLabel(idx)}>
            <Icon icon="mdi:delete-outline" />
          </IconButton>
        </Stack>
      ))}

      {/* matchExpressions */}
      {expressions.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.5, mt: labels.length ? 1 : 0 }}
        >
          matchExpressions
        </Typography>
      )}
      {expressions.map((e, idx) => (
        <Stack key={idx} direction="row" spacing={1} sx={{ mb: 0.5 }} alignItems="center">
          <TextField
            size="small"
            label="Key"
            value={e.key}
            onChange={ev => updateExpr(idx, 'key', ev.target.value)}
            sx={{ flex: 2 }}
          />
          <TextField
            select
            size="small"
            label="Operator"
            value={e.operator}
            onChange={ev => updateExpr(idx, 'operator', ev.target.value)}
            sx={{ flex: 1, minWidth: 130 }}
          >
            {OPERATORS.map(op => (
              <MenuItem key={op} value={op}>
                {op}
              </MenuItem>
            ))}
          </TextField>
          {(e.operator === 'In' || e.operator === 'NotIn') && (
            <TextField
              size="small"
              label="Values (comma-separated)"
              value={e.values}
              onChange={ev => updateExpr(idx, 'values', ev.target.value)}
              sx={{ flex: 2 }}
            />
          )}
          <IconButton size="small" onClick={() => removeExpr(idx)}>
            <Icon icon="mdi:delete-outline" />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Tooltip title="Add matchLabel">
          <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addLabel}>
            Label
          </Button>
        </Tooltip>
        <Tooltip title="Add matchExpression">
          <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addExpr}>
            Expression
          </Button>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function RuleBindingForm({
  initialName = '',
  initialNsLabels = [],
  initialNsExpressions = [],
  initialPodLabels = [],
  initialPodExpressions = [],
  initialRules = [],
  resourceVersion,
  isEdit = false,
}: Readonly<{
  initialName?: string;
  initialNsLabels?: LabelEntry[];
  initialNsExpressions?: ExprEntry[];
  initialPodLabels?: LabelEntry[];
  initialPodExpressions?: ExprEntry[];
  initialRules?: RuleEntry[];
  resourceVersion?: string;
  isEdit?: boolean;
}>) {
  const history = useHistory();
  const [name, setName] = useState(initialName);
  const [nsLabels, setNsLabels] = useState<LabelEntry[]>(initialNsLabels);
  const [nsExpressions, setNsExpressions] = useState<ExprEntry[]>(initialNsExpressions);
  const [podLabels, setPodLabels] = useState<LabelEntry[]>(initialPodLabels);
  const [podExpressions, setPodExpressions] = useState<ExprEntry[]>(initialPodExpressions);
  const [rules, setRules] = useState<RuleEntry[]>(initialRules);
  const [errorMessage, setErrorMessage] = useState('');
  const [availableRuleNames, setAvailableRuleNames] = useState<string[]>([]);

  // Fetch available rule names from Rules CRDs for autocomplete
  useEffect(() => {
    request('/apis/kubescape.io/v1/rules')
      .then((res: any) => {
        const names: string[] = (res.items ?? []).flatMap((crd: any) =>
          (crd.spec?.rules ?? []).map((r: any) => r.name ?? r.id).filter(Boolean)
        );
        setAvailableRuleNames([...new Set(names)]);
      })
      .catch(() => {});
  }, []);

  const addRule = () => setRules(r => [...r, { ruleName: '', severity: '' }]);
  const removeRule = (idx: number) => setRules(r => r.filter((_, i) => i !== idx));
  const updateRule = (idx: number, field: keyof RuleEntry, val: string) =>
    setRules(r => r.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));

  const handleSave = async () => {
    if (!name.trim()) return setErrorMessage('Name is required');
    if (rules.some(r => !r.ruleName.trim())) return setErrorMessage('All rules must have a name');
    const hasEmptyInNotIn = [...nsExpressions, ...podExpressions].some(
      e =>
        (e.operator === 'In' || e.operator === 'NotIn') &&
        e.values
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean).length === 0
    );
    if (hasEmptyInNotIn) return setErrorMessage('In/NotIn expressions require at least one value');

    const body: any = {
      apiVersion: 'kubescape.io/v1',
      kind: 'RuntimeRuleAlertBinding',
      metadata: {
        name: name.trim(),
        ...(resourceVersion ? { resourceVersion } : {}),
      },
      spec: {
        namespaceSelector: {
          matchLabels: entriesToMatchLabels(nsLabels),
          ...(nsExpressions.length
            ? { matchExpressions: entriesToMatchExpressions(nsExpressions) }
            : {}),
        },
        podSelector: {
          matchLabels: entriesToMatchLabels(podLabels),
          ...(podExpressions.length
            ? { matchExpressions: entriesToMatchExpressions(podExpressions) }
            : {}),
        },
        rules: rules.map(r => ({
          ruleName: r.ruleName.trim(),
          ...(r.severity ? { severity: r.severity } : {}),
        })),
      },
    };

    try {
      if (isEdit) {
        await put(`${API_PATH}/${name.trim()}`, body);
      } else {
        await post(API_PATH, body);
      }
      history.goBack();
    } catch (err: any) {
      setErrorMessage(err.message ?? String(err));
    }
  };

  return (
    <SectionBox backLink title={isEdit ? 'Edit Rule Binding' : 'New Rule Binding'}>
      <Stack spacing={3} sx={{ maxWidth: 700, mt: 2 }}>
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <TextField
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          size="small"
          required
          disabled={isEdit}
          fullWidth
        />

        <Divider />

        <SelectorEditor
          label="Namespace Selector"
          labels={nsLabels}
          expressions={nsExpressions}
          onLabelsChange={setNsLabels}
          onExpressionsChange={setNsExpressions}
        />

        <SelectorEditor
          label="Pod Selector"
          labels={podLabels}
          expressions={podExpressions}
          onLabelsChange={setPodLabels}
          onExpressionsChange={setPodExpressions}
        />

        <Divider />

        <Box>
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Rules
            </Typography>
            <Tooltip title="Add rule">
              <IconButton size="small" onClick={addRule}>
                <Icon icon="mdi:plus" />
              </IconButton>
            </Tooltip>
          </Stack>
          {rules.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No rules bound yet
            </Typography>
          )}
          {rules.map((r, idx) => (
            <Stack key={idx} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Autocomplete
                freeSolo
                options={availableRuleNames}
                value={r.ruleName}
                onInputChange={(_, val) => updateRule(idx, 'ruleName', val)}
                renderInput={params => (
                  <TextField {...params} size="small" label="Rule Name" required />
                )}
                sx={{ flex: 2 }}
              />
              <TextField
                select
                size="small"
                label="Severity"
                value={r.severity}
                onChange={e => updateRule(idx, 'severity', e.target.value)}
                sx={{ flex: 1, minWidth: 120 }}
              >
                {SEVERITIES.map(s => (
                  <MenuItem key={s} value={s}>
                    {s || '(default)'}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton size="small" onClick={() => removeRule(idx)}>
                <Icon icon="mdi:delete-outline" />
              </IconButton>
            </Stack>
          ))}
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
          <Button onClick={() => history.goBack()}>Cancel</Button>
        </Stack>
      </Stack>
    </SectionBox>
  );
}

export function RuleBindingNew() {
  return <RuleBindingForm />;
}

export function RuleBindingEdit() {
  const [name] = getURLSegments(-1);
  const [loaded, setLoaded] = useState(false);
  const [nsLabels, setNsLabels] = useState<LabelEntry[]>([]);
  const [nsExpressions, setNsExpressions] = useState<ExprEntry[]>([]);
  const [podLabels, setPodLabels] = useState<LabelEntry[]>([]);
  const [podExpressions, setPodExpressions] = useState<ExprEntry[]>([]);
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [resourceVersion, setResourceVersion] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    request(`${API_PATH}/${name}`)
      .then((b: any) => {
        setResourceVersion(b.metadata.resourceVersion ?? '');
        setNsLabels(labelsToEntries(b.spec?.namespaceSelector?.matchLabels));
        setNsExpressions(expressionsToEntries(b.spec?.namespaceSelector?.matchExpressions));
        setPodLabels(labelsToEntries(b.spec?.podSelector?.matchLabels));
        setPodExpressions(expressionsToEntries(b.spec?.podSelector?.matchExpressions));
        setRules(
          (b.spec?.rules ?? []).map((r: any) => ({
            ruleName: r.ruleName ?? '',
            severity: r.severity ?? '',
          }))
        );
        setLoaded(true);
      })
      .catch((err: any) => setError(err.message ?? String(err)));
  }, [name]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!loaded) return null;

  return (
    <RuleBindingForm
      initialName={name}
      initialNsLabels={nsLabels}
      initialNsExpressions={nsExpressions}
      initialPodLabels={podLabels}
      initialPodExpressions={podExpressions}
      initialRules={rules}
      resourceVersion={resourceVersion}
      isEdit
    />
  );
}
