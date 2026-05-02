import { Icon } from '@iconify/react';
import { post, put, request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Editor from '@monaco-editor/react';
import { TabContext, TabList } from '@mui/lab';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import * as yaml from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabPanel } from '../common/TabPanel';
import { getURLSegments } from '../common/url';
import {
  defaultEventData,
  EventType,
  ProfileDependency,
  Rule,
  RuleEvalResults,
  RuleExpression,
} from '../types/Rules';
import { loadWasm } from '../wasm/initWasmModule';

const EVENT_TYPES = Object.keys(defaultEventData) as EventType[];

const DEFAULT_NAMESPACE = 'kubescape';

const MITRE_TACTICS: { id: string; name: string }[] = [
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0040', name: 'Impact' },
  { id: 'TA0042', name: 'Resource Development' },
  { id: 'TA0043', name: 'Reconnaissance' },
];

const MITRE_TECHNIQUES: { id: string; name: string }[] = [
  { id: 'T1005', name: 'Data from Local System' },
  { id: 'T1021.001', name: 'Remote Services: Remote Desktop Protocol' },
  { id: 'T1036', name: 'Masquerading' },
  { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
  { id: 'T1055', name: 'Process Injection' },
  { id: 'T1059', name: 'Command and Scripting Interpreter' },
  { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
  { id: 'T1071', name: 'Application Layer Protocol' },
  { id: 'T1071.004', name: 'Application Layer Protocol: DNS' },
  { id: 'T1078', name: 'Valid Accounts' },
  { id: 'T1098', name: 'Account Manipulation' },
  { id: 'T1190', name: 'Exploit Public-Facing Application' },
  { id: 'T1210', name: 'Exploitation of Remote Services' },
  { id: 'T1218', name: 'System Binary Proxy Execution' },
  { id: 'T1496', name: 'Resource Hijacking' },
  { id: 'T1525', name: 'Implant Internal Image' },
  { id: 'T1528', name: 'Steal Application Access Token' },
  { id: 'T1543', name: 'Create or Modify System Process' },
  { id: 'T1547.006', name: 'Boot or Logon Autostart: Kernel Modules and Extensions' },
  { id: 'T1552.001', name: 'Unsecured Credentials: Credentials In Files' },
  { id: 'T1574.006', name: 'Hijack Execution Flow: Dynamic Linker Hijacking' },
  { id: 'T1609', name: 'Container Administration Command' },
  { id: 'T1610', name: 'Deploy Container' },
  { id: 'T1611', name: 'Escape to Host' },
  { id: 'T1613', name: 'Container and Resource Discovery' },
  { id: 'T1622', name: 'Debugger Evasion' },
];

const EMPTY_RULE: Rule = {
  name: '',
  id: '',
  enabled: true,
  description: '',
  expressions: {
    message: '',
    uniqueId: '',
    ruleExpression: [{ eventType: 'exec', expression: '' }],
  },
  profileDependency: 2,
  severity: 5,
  supportPolicy: false,
  isTriggerAlert: true,
  mitreTactic: '',
  mitreTechnique: '',
  tags: [],
};

const EMPTY_PROFILE_YAML = `# ApplicationProfile mock data (keyed by containerId)
# containers:
#   abc123:
#     execs:
#       - path: /bin/bash
#     syscalls:
#       - read
`;

const EMPTY_NETWORK_YAML = `# NetworkNeighborhood mock data (keyed by containerId)
# containers:
#   abc123:
#     egress:
#       - ipAddress: "8.8.8.8"
#         dns:
#           - "dns.google."
`;

function editorTheme() {
  return localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : '';
}

function MonacoEditor(
  props: Readonly<{
    editorRef?: React.MutableRefObject<any>;
    language: string;
    defaultValue: string;
    height: number;
    onChange: (value: string) => void;
  }>
) {
  const { editorRef, language, defaultValue, height, onChange } = props;
  return (
    <Editor
      language={language}
      defaultValue={defaultValue}
      height={height}
      theme={editorTheme()}
      onMount={(editor: any) => {
        if (editorRef) editorRef.current = editor;
      }}
      onChange={(value: string | undefined) => onChange(value ?? '')}
      options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
    />
  );
}

export function RuleNew() {
  return <RuleFormPage />;
}

export function RuleEdit() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [initialMeta, setInitialMeta] = useState<{
    name: string;
    namespace: string;
    resourceVersion: string;
  } | null>(null);
  const [initialRules, setInitialRules] = useState<Rule[] | null>(null);

  useEffect(() => {
    request(`/apis/kubescape.io/v1/namespaces/${namespace}/rules/${name}`)
      .then((crd: any) => {
        setInitialMeta({
          name: crd.metadata.name,
          namespace: crd.metadata.namespace,
          resourceVersion: crd.metadata.resourceVersion,
        });
        setInitialRules(crd.spec?.rules?.length ? crd.spec.rules : [EMPTY_RULE]);
      })
      .catch((err: any) => console.error('Failed to load rule:', err));
  }, [name, namespace]);

  if (!initialMeta || !initialRules) return null;
  return <RuleFormPage initialMeta={initialMeta} initialRules={initialRules} isEdit />;
}

function RuleFormPage({
  initialMeta,
  initialRules,
  isEdit = false,
}: Readonly<{
  initialMeta?: { name: string; namespace: string; resourceVersion?: string };
  initialRules?: Rule[];
  isEdit?: boolean;
}>) {
  const [ruleMeta, setRuleMeta] = useState(
    initialMeta ?? {
      name: '',
      namespace: DEFAULT_NAMESPACE,
      resourceVersion: undefined as string | undefined,
    }
  );
  const [rules, setRules] = useState<Rule[]>(initialRules ?? [EMPTY_RULE]);
  const [expanded, setExpanded] = useState<number>(0);
  const [tabValue, setTabValue] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const ruleYAML = useMemo(
    () =>
      yaml.dump({
        apiVersion: 'kubescape.io/v1',
        kind: 'Rules',
        metadata: { name: ruleMeta.name, namespace: ruleMeta.namespace },
        spec: { rules },
      }),
    [rules, ruleMeta]
  );

  const updateRule = <K extends keyof Rule>(idx: number, key: K, value: Rule[K]) => {
    setRules(rs => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
    setSaved(false);
  };

  const addRule = () => {
    setRules(rs => [...rs, { ...EMPTY_RULE }]);
    setExpanded(rules.length);
    setSaved(false);
  };

  const removeRule = (idx: number) => {
    setRules(rs => rs.filter((_, i) => i !== idx));
    setExpanded(Math.max(0, idx - 1));
    setSaved(false);
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!ruleMeta.name) return setErrorMessage('Name is required');
    for (const r of rules) {
      if (!r.name) return setErrorMessage('Every rule must have a name');
      if (!r.id) return setErrorMessage('Every rule must have an ID');
      if (!r.mitreTactic) return setErrorMessage(`Rule "${r.name || r.id}": Tactic is required`);
      if (!r.mitreTechnique)
        return setErrorMessage(`Rule "${r.name || r.id}": Technique is required`);
    }

    const body: any = {
      apiVersion: 'kubescape.io/v1',
      kind: 'Rules',
      metadata: {
        name: ruleMeta.name,
        namespace: ruleMeta.namespace,
        ...(ruleMeta.resourceVersion ? { resourceVersion: ruleMeta.resourceVersion } : {}),
      },
      spec: { rules },
    };

    try {
      if (isEdit) {
        const origName = initialMeta?.name ?? ruleMeta.name;
        const origNamespace = initialMeta?.namespace ?? ruleMeta.namespace;
        await put(`/apis/kubescape.io/v1/namespaces/${origNamespace}/rules/${origName}`, body);
      } else {
        await post(`/apis/kubescape.io/v1/namespaces/${ruleMeta.namespace}/rules`, body);
      }
      setErrorMessage('');
      setSaved(true);
    } catch (err: any) {
      setErrorMessage(err.message ?? String(err));
    }
  };

  const isReadOnly =
    isEdit && initialMeta?.name === 'default-rules' && initialMeta?.namespace === 'kubescape';

  return (
    <SectionBox backLink>
      <Stack direction="row" alignItems="center" sx={{ mt: 2, mb: 2 }} spacing={0}>
        <Typography variant="h4" sx={{ mr: 2, fontWeight: 'bold' }}>
          {isEdit ? 'Edit Rule' : 'New Rule'}
        </Typography>
        {!isReadOnly && (
          <Tooltip title="Save to cluster">
            <IconButton onClick={handleSave}>
              <Icon icon="mdi:content-save" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Test rule in playground">
          <IconButton onClick={() => setPlaygroundOpen(true)}>
            <Icon icon="mdi:play-circle-outline" />
          </IconButton>
        </Tooltip>
      </Stack>

      {isReadOnly && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <Icon icon="mdi:lock-outline" style={{ verticalAlign: 'middle', marginRight: 4 }} />
          <strong>default-rules</strong> is system-managed and cannot be edited here. Deploy a
          custom Rules CRD to override individual rules.
        </Typography>
      )}

      <PlaygroundDialog
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
        rules={rules}
        ruleMeta={ruleMeta}
      />

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Saved successfully
        </Alert>
      )}

      <TabContext value={tabValue}>
        <TabList onChange={(_: any, v: number) => setTabValue(v)} sx={{ minHeight: 36 }}>
          <Tab label="Form" value={1} sx={{ minHeight: 36, py: 0 }} />
          <Tab label="YAML" value={2} sx={{ minHeight: 36, py: 0 }} />
        </TabList>
        <TabPanel value={1}>
          <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Name"
                value={ruleMeta.name}
                onChange={e => {
                  setRuleMeta(m => ({ ...m, name: e.target.value }));
                  setSaved(false);
                }}
                size="small"
                fullWidth
                required
                error={submitted && !ruleMeta.name}
              />
              <TextField
                label="Namespace"
                value={ruleMeta.namespace}
                onChange={e => {
                  setRuleMeta(m => ({ ...m, namespace: e.target.value }));
                  setSaved(false);
                }}
                size="small"
                fullWidth
              />
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {/* Rules accordion */}
            {rules.map((r, idx) => (
              <Accordion
                key={idx}
                expanded={expanded === idx}
                onChange={() => setExpanded(expanded === idx ? -1 : idx)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={2}
                    sx={{ width: '100%', pr: 1 }}
                  >
                    <Typography sx={{ fontWeight: 500 }}>{r.name || `Rule ${idx + 1}`}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.id}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        removeRule(idx);
                      }}
                      disabled={rules.length <= 1}
                    >
                      <Icon icon="mdi:delete-outline" />
                    </IconButton>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <RuleForm
                    rule={r}
                    onRuleChange={(key, value) => updateRule(idx, key, value)}
                    submitted={submitted}
                  />
                </AccordionDetails>
              </Accordion>
            ))}
            <Button
              size="small"
              startIcon={<Icon icon="mdi:plus" />}
              onClick={addRule}
              sx={{ mt: 1 }}
            >
              Add rule
            </Button>
          </Box>
        </TabPanel>
        <TabPanel value={2}>
          <Editor
            language="yaml"
            value={ruleYAML}
            height={700}
            theme={editorTheme()}
            options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }}
          />
        </TabPanel>
      </TabContext>
    </SectionBox>
  );
}

function RuleForm({
  rule,
  onRuleChange,
  submitted,
}: Readonly<{
  rule: Rule;
  onRuleChange: <K extends keyof Rule>(key: K, value: Rule[K]) => void;
  submitted: boolean;
}>) {
  const setExpr = (patch: Partial<Rule['expressions']>) =>
    onRuleChange('expressions', { ...rule.expressions, ...patch });

  const updateExpression = (idx: number, field: keyof RuleExpression, value: string) => {
    const exprs = [...rule.expressions.ruleExpression];
    exprs[idx] = { ...exprs[idx], [field]: value };
    setExpr({ ruleExpression: exprs });
  };

  const addExpression = () =>
    setExpr({
      ruleExpression: [
        ...rule.expressions.ruleExpression,
        { eventType: 'exec' as EventType, expression: '' },
      ],
    });

  const removeExpression = (idx: number) =>
    setExpr({
      ruleExpression: rule.expressions.ruleExpression.filter((_, i) => i !== idx),
    });

  const [syntaxErrors, setSyntaxErrors] = useState<{
    message?: string;
    uniqueId?: string;
    expressions: (string | undefined)[];
  }>({ expressions: [] });

  useEffect(() => {
    void loadWasm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!window.RuleEval) return;
      try {
        const ruleYAML = yaml.dump({
          apiVersion: 'kubescape.io/v1',
          kind: 'Rules',
          metadata: { name: 'validate', namespace: 'kubescape' },
          spec: { rules: [rule] },
        });

        const distinctTypes = [...new Set(rule.expressions.ruleExpression.map(e => e.eventType))];

        const exprErrors: (string | undefined)[] = rule.expressions.ruleExpression.map(
          () => undefined
        );
        let messageError: string | undefined;
        let uniqueIdError: string | undefined;

        for (const et of distinctTypes) {
          const result: RuleEvalResults = JSON.parse(
            window.RuleEval(ruleYAML, et, JSON.stringify(defaultEventData[et] ?? {}), '', '')
          );

          // Go's Evaluate() returns only expressions matching `et`, in their original order.
          // Reconstruct which original indices those correspond to.
          const matchingIndices = rule.expressions.ruleExpression
            .map((e, i) => (e.eventType === et ? i : -1))
            .filter(i => i !== -1);

          result.ruleExpression.forEach((r, j) => {
            const origIdx = matchingIndices[j];
            if (origIdx !== undefined && rule.expressions.ruleExpression[origIdx].expression) {
              exprErrors[origIdx] = r.error || undefined;
            }
          });

          if (!messageError && rule.expressions.message && result.message?.error)
            messageError = result.message.error;
          if (!uniqueIdError && rule.expressions.uniqueId && result.uniqueId?.error)
            uniqueIdError = result.uniqueId.error;
        }

        setSyntaxErrors({
          message: messageError,
          uniqueId: uniqueIdError,
          expressions: exprErrors,
        });
      } catch {
        // WASM not ready yet
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [rule.expressions]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = { mb: 2 };
  const mono = { style: { fontFamily: 'monospace', fontSize: 13 } };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={row}>
        <TextField
          label="Name"
          value={rule.name}
          onChange={e => onRuleChange('name', e.target.value)}
          size="small"
          fullWidth
          required
          error={submitted && !rule.name}
        />
        <TextField
          label="ID"
          value={rule.id}
          onChange={e => onRuleChange('id', e.target.value)}
          size="small"
          sx={{ minWidth: 110 }}
          required
          error={submitted && !rule.id}
        />
      </Stack>
      <TextField
        label="Description"
        value={rule.description}
        onChange={e => onRuleChange('description', e.target.value)}
        size="small"
        fullWidth
        multiline
        rows={2}
        sx={row}
      />

      {/* Toggles */}
      <Stack direction="row" spacing={3} sx={row}>
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={rule.enabled}
              onChange={e => onRuleChange('enabled', e.target.checked)}
              size="small"
            />
          }
          label="Enabled"
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={rule.isTriggerAlert}
              onChange={e => onRuleChange('isTriggerAlert', e.target.checked)}
              size="small"
            />
          }
          label="Trigger alert"
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={rule.supportPolicy}
              onChange={e => onRuleChange('supportPolicy', e.target.checked)}
              size="small"
            />
          }
          label="Support policy"
        />
      </Stack>

      {/* Severity */}
      <TextField
        label="Severity (1–10)"
        type="number"
        value={rule.severity}
        onChange={e => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onRuleChange('severity', Math.min(10, Math.max(1, next)));
        }}
        size="small"
        sx={{ ...row, width: 160 }}
        inputProps={{ min: 1, max: 10 }}
      />

      {/* Profile dependency */}
      <FormControl size="small" sx={{ ...row, minWidth: 220 }}>
        <InputLabel>Profile dependency</InputLabel>
        <Select
          label="Profile dependency"
          value={rule.profileDependency}
          onChange={e =>
            onRuleChange('profileDependency', Number(e.target.value) as ProfileDependency)
          }
        >
          <MenuItem value={0}>Required</MenuItem>
          <MenuItem value={1}>Optional</MenuItem>
          <MenuItem value={2}>Not required</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" spacing={2} sx={row}>
        <Autocomplete
          freeSolo
          options={MITRE_TACTICS}
          getOptionLabel={o => (typeof o === 'string' ? o : `${o.id} — ${o.name}`)}
          inputValue={rule.mitreTactic}
          onInputChange={(_, v, reason) => {
            if (reason !== 'reset') onRuleChange('mitreTactic', v);
          }}
          onChange={(_, v) =>
            onRuleChange('mitreTactic', typeof v === 'string' ? v : v ? v.id : '')
          }
          size="small"
          fullWidth
          renderInput={params => (
            <TextField
              {...params}
              label="Tactic"
              required
              error={submitted && !rule.mitreTactic}
              helperText={submitted && !rule.mitreTactic ? 'Required' : ''}
              placeholder="e.g. TA0002"
            />
          )}
        />
        <Autocomplete
          freeSolo
          options={MITRE_TECHNIQUES}
          getOptionLabel={o => (typeof o === 'string' ? o : `${o.id} — ${o.name}`)}
          inputValue={rule.mitreTechnique}
          onInputChange={(_, v, reason) => {
            if (reason !== 'reset') onRuleChange('mitreTechnique', v);
          }}
          onChange={(_, v) =>
            onRuleChange('mitreTechnique', typeof v === 'string' ? v : v ? v.id : '')
          }
          size="small"
          fullWidth
          renderInput={params => (
            <TextField
              {...params}
              label="Technique"
              required
              error={submitted && !rule.mitreTechnique}
              helperText={submitted && !rule.mitreTechnique ? 'Required' : ''}
              placeholder="e.g. T1059"
            />
          )}
        />
      </Stack>

      {/* Tags */}
      <TextField
        label="Tags (comma-separated)"
        value={(rule.tags ?? []).join(', ')}
        onChange={e =>
          onRuleChange(
            'tags',
            e.target.value
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
          )
        }
        size="small"
        fullWidth
        sx={row}
      />

      <Divider sx={{ mb: 2 }} />

      <TextField
        label="Message"
        value={rule.expressions.message}
        onChange={e => setExpr({ message: e.target.value })}
        size="small"
        fullWidth
        sx={row}
        inputProps={mono}
        error={!!syntaxErrors.message}
        helperText={syntaxErrors.message}
      />
      <TextField
        label="Unique ID"
        value={rule.expressions.uniqueId}
        onChange={e => setExpr({ uniqueId: e.target.value })}
        size="small"
        fullWidth
        sx={row}
        inputProps={mono}
        error={!!syntaxErrors.uniqueId}
        helperText={syntaxErrors.uniqueId}
      />

      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="body2">Rule expressions</Typography>
        <LibraryReferenceButton />
      </Stack>
      {rule.expressions.ruleExpression.map((expr, idx) => (
        <Box
          key={`expr-${idx}`}
          sx={{ mb: 2, pl: 1, borderLeft: '3px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              select
              label="Event type"
              value={expr.eventType}
              onChange={e => updateExpression(idx, 'eventType', e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              {EVENT_TYPES.map(et => (
                <MenuItem key={et} value={et}>
                  {et}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              onClick={() => removeExpression(idx)}
              disabled={rule.expressions.ruleExpression.length <= 1}
            >
              <Icon icon="mdi:delete-outline" />
            </IconButton>
          </Stack>
          <TextField
            value={expr.expression}
            onChange={e => updateExpression(idx, 'expression', e.target.value)}
            size="small"
            fullWidth
            placeholder="CEL expression"
            multiline
            minRows={2}
            inputProps={mono}
            error={!!syntaxErrors.expressions[idx]}
            helperText={syntaxErrors.expressions[idx]}
          />
        </Box>
      ))}
      <IconButton size="small" onClick={addExpression} sx={{ mt: 0.5 }}>
        <Icon icon="mdi:plus-circle-outline" />
      </IconButton>
    </Box>
  );
}

const GROUP_DESCRIPTIONS: Record<string, string> = {
  ap: 'ApplicationProfile — baseline of what a container normally executes, opens, and calls. Use ap.* to detect activity that was never seen during the learning phase.',
  nn: 'NetworkNeighborhood — baseline of which IPs and domains a container normally contacts. Use nn.* to detect unexpected network destinations.',
  k8s: 'Kubernetes metadata helpers — access cluster-level information such as the API server address or container mount paths.',
  parse: 'Parsing utilities for extracting values from event fields.',
  net: 'Network utilities for classifying IP addresses.',
  process: 'Process-level helpers (return empty values in the browser playground).',
};

const LIBRARY_FUNCTIONS: Array<{ group: string; signature: string; description: string }> = [
  {
    group: 'ap',
    signature: 'ap.was_executed(containerId, path) bool',
    description: 'Path was executed by container in baseline',
  },
  {
    group: 'ap',
    signature: 'ap.was_path_opened(containerId, path) bool',
    description: 'Path was opened by container in baseline',
  },
  {
    group: 'ap',
    signature: 'ap.was_path_opened_with_suffix(containerId, suffix) bool',
    description: 'Any opened path ends with suffix',
  },
  {
    group: 'ap',
    signature: 'ap.was_path_opened_with_prefix(containerId, prefix) bool',
    description: 'Any opened path starts with prefix',
  },
  {
    group: 'ap',
    signature: 'ap.was_syscall_used(containerId, syscallName) bool',
    description: 'Syscall was used by container in baseline',
  },
  {
    group: 'ap',
    signature: 'ap.was_capability_used(containerId, capName) bool',
    description: 'Capability was used by container in baseline',
  },
  {
    group: 'nn',
    signature: 'nn.is_domain_in_egress(containerId, domain) bool',
    description: 'Domain appeared in egress DNS in baseline',
  },
  {
    group: 'nn',
    signature: 'nn.was_address_in_egress(containerId, addr) bool',
    description: 'IP address appeared in egress in baseline',
  },
  {
    group: 'k8s',
    signature: 'k8s.is_api_server_address(addr) bool',
    description: 'Address matches the cluster API server',
  },
  {
    group: 'k8s',
    signature: 'k8s.get_container_mount_paths(ns, pod, container) list',
    description: 'Returns the mount paths for a container',
  },
  {
    group: 'parse',
    signature: 'parse.get_exec_path(args, comm) string',
    description: 'Returns args[0] if non-empty, otherwise comm',
  },
  {
    group: 'net',
    signature: 'net.is_private_ip(ip) bool',
    description: 'True if the IP is in a private range or loopback',
  },
  {
    group: 'process',
    signature: 'process.get_ld_hook_var(pid) string',
    description: 'Returns the LD_PRELOAD hook variable (empty in playground)',
  },
];

function LibraryReferenceButton() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const groups = [...new Set(LIBRARY_FUNCTIONS.map(f => f.group))];

  return (
    <>
      <Tooltip title="CEL function reference">
        <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}>
          <Icon icon="mdi:information-outline" />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: '60vw', maxWidth: 900, maxHeight: '70vh', overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Available CEL functions
          </Typography>
          <Table size="small">
            <TableBody>
              {groups.flatMap(group => [
                <TableRow key={`hdr-${group}`}>
                  <TableCell colSpan={2} sx={{ pt: 1.5, pb: 0.25, borderBottom: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {group}.*
                    </Typography>
                    {GROUP_DESCRIPTIONS[group] && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {GROUP_DESCRIPTIONS[group]}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>,
                ...LIBRARY_FUNCTIONS.filter(f => f.group === group).map(f => (
                  <TableRow key={f.signature}>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        verticalAlign: 'top',
                        py: 0.5,
                        borderBottom: 0,
                      }}
                    >
                      {f.signature}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        verticalAlign: 'top',
                        py: 0.5,
                        borderBottom: 0,
                      }}
                    >
                      {f.description}
                    </TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </Box>
      </Popover>
    </>
  );
}

type RuleTestResult = {
  rule: Rule;
  evalResult: RuleEvalResults | null;
  evalError: string;
};

const SPDX_API = 'spdx.softwarecomposition.kubescape.io/v1beta1';

function apCrdToMockYAML(crd: any): string {
  const containers: Record<string, any> = {};
  for (const c of crd.spec?.containers ?? []) {
    containers[c.name] = {
      execs: (c.execs ?? []).map((e: any) => ({ path: e.path, args: e.args ?? [] })),
      opens: (c.opens ?? []).map((o: any) => ({ path: o.path, flags: o.flags ?? [] })),
      syscalls: c.syscalls ?? [],
      capabilities: c.capabilities ?? [],
    };
  }
  return yaml.dump({ containers });
}

function nnCrdToMockYAML(crd: any): string {
  const containers: Record<string, any> = {};
  for (const c of crd.spec?.containers ?? []) {
    containers[c.name] = {
      egress: (c.egress ?? []).map((e: any) => ({
        ipAddress: e.ipAddress ?? '',
        dns: Array.isArray(e.dns) ? e.dns : [],
      })),
      ingress: (c.ingress ?? []).map((i: any) => ({
        ipAddress: i.ipAddress ?? '',
        dns: Array.isArray(i.dns) ? i.dns : [],
      })),
    };
  }
  return yaml.dump({ containers });
}

type LoadMeta = { namespace: string; workload: string; containerName: string };

function ClusterMockLoader({
  crdKind,
  onLoad,
}: Readonly<{
  crdKind: 'applicationprofiles' | 'networkneighborhoods';
  onLoad: (yaml: string, meta: LoadMeta) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('');
  const [workloads, setWorkloads] = useState<string[]>([]);
  const [workload, setWorkload] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    request('/api/v1/namespaces')
      .then((res: any) => setNamespaces(res.items?.map((ns: any) => ns.metadata.name) ?? []))
      .catch(() => setNamespaces([]));
  };

  useEffect(() => {
    if (!namespace) return;
    setWorkload('');
    setWorkloads([]);
    request(`/apis/${SPDX_API}/namespaces/${namespace}/${crdKind}`).then((res: any) =>
      setWorkloads(res.items?.map((i: any) => i.metadata.name) ?? [])
    );
  }, [namespace, crdKind]);

  const emptyComment =
    crdKind === 'networkneighborhoods'
      ? [
          '# No NetworkNeighborhood baseline found for this workload.',
          '# Network baseline is recorded by Kubescape after observing the',
          '# workload during its learning phase. The nn.* functions will',
          '# return false until baseline data is available.',
        ].join('\n')
      : [
          '# No ApplicationProfile baseline found for this workload.',
          '# The profile is recorded by Kubescape during the learning phase.',
          '# The ap.* functions will return false until baseline data is available.',
        ].join('\n');

  const handleLoad = async () => {
    if (!namespace || !workload) return;
    setLoading(true);
    try {
      const crd = await request(`/apis/${SPDX_API}/namespaces/${namespace}/${crdKind}/${workload}`);
      const converted =
        crdKind === 'applicationprofiles' ? apCrdToMockYAML(crd) : nnCrdToMockYAML(crd);
      const parsed = yaml.load(converted) as any;
      const containerName = Object.keys(parsed?.containers ?? {})[0] ?? '';
      const hasData = !!containerName;
      onLoad(hasData ? converted : emptyComment, { namespace, workload, containerName });
    } catch {
      onLoad(emptyComment, { namespace, workload, containerName: '' });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Button
        size="small"
        startIcon={<Icon icon="mdi:cloud-download-outline" />}
        onClick={handleOpen}
        sx={{ mb: 1 }}
      >
        Load from cluster
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
      <TextField
        select
        label="Namespace"
        value={namespace}
        onChange={e => setNamespace(e.target.value)}
        size="small"
        sx={{ minWidth: 160 }}
      >
        {namespaces.map(ns => (
          <MenuItem key={ns} value={ns}>
            {ns}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Workload"
        value={workload}
        onChange={e => setWorkload(e.target.value)}
        size="small"
        sx={{ minWidth: 200 }}
        disabled={!workloads.length}
      >
        {workloads.map(w => (
          <MenuItem key={w} value={w}>
            {w}
          </MenuItem>
        ))}
      </TextField>
      <Button variant="contained" size="small" onClick={handleLoad} disabled={!workload || loading}>
        Load
      </Button>
      <Button size="small" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </Stack>
  );
}

function ruleChip(item: RuleTestResult) {
  if (item.rule.enabled === false) return <Chip label="disabled" color="default" size="small" />;
  if (item.evalError || item.evalResult?.error)
    return <Chip label="error" color="error" size="small" />;
  if (item.evalResult?.eventTypeMismatch) return <Chip label="N/A" color="default" size="small" />;
  if (item.evalResult?.ruleExpression?.some(r => r.result === true))
    return <Chip label="fired" color="warning" size="small" />;
  if (item.evalResult) return <Chip label="not fired" color="success" size="small" />;
  return null;
}

function PlaygroundDialog({
  open,
  onClose,
  rules,
  ruleMeta,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  rules: Rule[];
  ruleMeta: { name: string; namespace: string };
}>) {
  useEffect(() => {
    void loadWasm();
  }, []);

  const [eventType, setEventType] = useState<EventType>('exec');
  const [eventData, setEventData] = useState(JSON.stringify(defaultEventData.exec, null, 2));
  const [profileYAML, setProfileYAML] = useState(EMPTY_PROFILE_YAML);
  const [networkYAML, setNetworkYAML] = useState(EMPTY_NETWORK_YAML);
  const [results, setResults] = useState<RuleTestResult[]>([]);
  const [hideNA, setHideNA] = useState(true);
  const [mockTabValue, setMockTabValue] = useState(1);
  const eventEditorRef = useRef<any>(null);
  const profileEditorRef = useRef<any>(null);
  const networkEditorRef = useRef<any>(null);

  const patchEventData = (meta: LoadMeta) => {
    if (!meta.containerName && !meta.namespace && !meta.workload) return;
    try {
      const parsed = JSON.parse(eventData);
      if (meta.containerName) {
        parsed.containerId = meta.containerName;
        parsed.containerName = meta.containerName;
      }
      if (meta.namespace) parsed.namespace = meta.namespace;
      if (meta.workload) parsed.podName = meta.workload;
      const updated = JSON.stringify(parsed, null, 2);
      setEventData(updated);
      eventEditorRef.current?.setValue(updated);
    } catch {
      // malformed event data — skip
    }
  };

  const onEventTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const et = e.target.value as EventType;
    setEventType(et);
    const newEventData = JSON.stringify(defaultEventData[et] ?? {}, null, 2);
    setEventData(newEventData);
    eventEditorRef.current?.setValue(newEventData);
    setResults([]);
  };

  const evaluate = useCallback(() => {
    if (!window.RuleEval) {
      setResults([]);
      return;
    }
    const next: RuleTestResult[] = rules.map(rule => {
      if (rule.enabled === false) return { rule, evalResult: null, evalError: '' };
      const singleYAML = yaml.dump({
        apiVersion: 'kubescape.io/v1',
        kind: 'Rules',
        metadata: ruleMeta,
        spec: { rules: [rule] },
      });
      try {
        const evalResult: RuleEvalResults = JSON.parse(
          window.RuleEval(singleYAML, eventType, eventData, profileYAML, networkYAML)
        );
        return { rule, evalResult, evalError: '' };
      } catch (err: any) {
        return { rule, evalResult: null, evalError: err.message ?? String(err) };
      }
    });
    setResults(next);
  }, [rules, ruleMeta, eventType, eventData, profileYAML, networkYAML]);

  useEffect(() => {
    if (open) evaluate();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) evaluate();
  }, [eventType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <span>Test Rules</span>
          <IconButton size="small" onClick={onClose}>
            <Icon icon="mdi:close" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Event Data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          The runtime event that triggered the rule — for example an exec call, a file open, or a
          network connection. Select the event type to load a template, then edit the fields to
          match the scenario you want to test.
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <TextField
            select
            value={eventType}
            onChange={onEventTypeChange}
            label="Event type"
            size="small"
            sx={{ minWidth: 140 }}
          >
            {EVENT_TYPES.map(et => (
              <MenuItem key={et} value={et}>
                {et}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <MonacoEditor
          editorRef={eventEditorRef}
          language="json"
          defaultValue={JSON.stringify(defaultEventData.exec, null, 2)}
          height={200}
          onChange={v => {
            setEventData(v);
            setResults([]);
          }}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          Baseline mock data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Rules that use <code>ap.*</code> or <code>nn.*</code> functions compare the event against
          a learned baseline. Populate these mocks to simulate what the baseline contains — leave
          them empty to simulate a container with no baseline activity.
        </Typography>
        <TabContext value={mockTabValue}>
          <TabList onChange={(_: any, v: number) => setMockTabValue(v)} sx={{ minHeight: 36 }}>
            <Tab label="ApplicationProfile mock" value={1} sx={{ minHeight: 36, py: 0 }} />
            <Tab label="NetworkNeighborhood mock" value={2} sx={{ minHeight: 36, py: 0 }} />
          </TabList>
          <TabPanel value={1}>
            <ClusterMockLoader
              crdKind="applicationprofiles"
              onLoad={(v, meta) => {
                setProfileYAML(v);
                profileEditorRef.current?.setValue(v);
                patchEventData(meta);
                setResults([]);
              }}
            />
            <MonacoEditor
              editorRef={profileEditorRef}
              language="yaml"
              defaultValue={EMPTY_PROFILE_YAML}
              height={150}
              onChange={v => {
                setProfileYAML(v);
                setResults([]);
              }}
            />
          </TabPanel>
          <TabPanel value={2}>
            <ClusterMockLoader
              crdKind="networkneighborhoods"
              onLoad={(v, meta) => {
                setNetworkYAML(v);
                networkEditorRef.current?.setValue(v);
                patchEventData(meta);
                setResults([]);
              }}
            />
            <MonacoEditor
              editorRef={networkEditorRef}
              language="yaml"
              defaultValue={EMPTY_NETWORK_YAML}
              height={150}
              onChange={v => {
                setNetworkYAML(v);
                setResults([]);
              }}
            />
          </TabPanel>
        </TabContext>

        <Box sx={{ mt: 2, mb: results.length ? 2 : 0 }}>
          <Button variant="contained" onClick={evaluate}>
            Evaluate
          </Button>
        </Box>

        {results.length > 0 &&
          (() => {
            const errors = results.flatMap(item => {
              const msg =
                item.evalError ||
                item.evalResult?.error ||
                item.evalResult?.ruleExpression?.find(r => r.error)?.error;
              return msg ? [`${item.rule.name}: ${msg}`] : [];
            });

            if (errors.length > 0) {
              return (
                <Box sx={{ mt: 2 }}>
                  {errors.map((e, i) => (
                    <Alert key={i} severity="error" sx={{ mb: 1 }}>
                      {e}
                    </Alert>
                  ))}
                </Box>
              );
            }

            return (
              <>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Button
                    size="small"
                    variant={hideNA ? 'contained' : 'outlined'}
                    onClick={() => setHideNA(h => !h)}
                  >
                    {hideNA ? 'Show N/A' : 'Hide N/A'}
                  </Button>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results
                      .filter(item => !hideNA || !item.evalResult?.eventTypeMismatch)
                      .map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.rule.name}</TableCell>
                          <TableCell>{ruleChip(item)}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {item.evalResult?.ruleExpression?.some(r => r.result === true)
                              ? item.evalResult?.message?.result
                              : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}
