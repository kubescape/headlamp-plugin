import Editor from '@monaco-editor/react';
import { TabContext, TabList } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  MenuItem,
  Stack,
  Tab,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import * as yaml from 'js-yaml';
import { useEffect, useRef, useState } from 'react';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { TabPanel } from '../common/TabPanel';
import { defaultEventData, EventType, Rule, RuleEvalResults } from '../types/Rules';
import { loadWasm } from '../wasm/initWasmModule';
import { EvaluationResults } from './EvaluationResults';

const EVENT_TYPES: EventType[] = [
  'exec',
  'open',
  'syscall',
  'capabilities',
  'dns',
  'network',
  'bpf',
  'kmod',
  'ssh',
  'symlink',
  'hardlink',
  'ptrace',
  'randomx',
  'unshare',
  'iouring',
];

const EMPTY_PROFILE_YAML = `# ApplicationProfile mock data (keyed by containerId)
# Uncomment and populate to test "activity in baseline" scenarios.
#
# containers:
#   abc123:
#     execs:
#       - path: /bin/bash
#     opens:
#       - path: /etc/passwd
#     syscalls:
#       - read
#       - write
#     capabilities:
#       - CAP_NET_ADMIN
`;

const EMPTY_NETWORK_YAML = `# NetworkNeighborhood mock data (keyed by containerId)
# Uncomment and populate to test "address in egress" scenarios.
#
# containers:
#   abc123:
#     egress:
#       - ipAddress: "8.8.8.8"
#         dns:
#           - "dns.google."
`;

// Stable module-level constant — never recomputed on re-render.
const INITIAL_RULE_YAML = yaml.dump({
  apiVersion: 'kubescape.io/v1',
  kind: 'Rules',
  metadata: { name: 'my-rule', namespace: 'kubescape' },
  spec: {
    rules: [
      {
        name: 'My custom rule',
        id: 'R9999',
        enabled: true,
        description: 'Describe what this rule detects',
        expressions: {
          message: "'Event detected: ' + event.comm",
          uniqueId: 'event.comm',
          ruleExpression: [{ eventType: 'exec', expression: "event.comm == 'bash'" }],
        },
        profileDependency: 2,
        severity: 5,
        supportPolicy: false,
        isTriggerAlert: true,
        mitreTactic: 'TA0002',
        mitreTechnique: 'T1059',
        tags: ['context:kubernetes'],
      },
    ],
  },
});

function editorTheme() {
  return localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : '';
}

export function RuleEditor() {
  loadWasm();

  const [sampleRules, setSampleRules] = useState<Rule[]>([]);
  const [selectedSample, setSelectedSample] = useState('');
  const [eventType, setEventType] = useState<EventType>('exec');
  const [evalResults, setEvalResults] = useState<RuleEvalResults | null>(null);
  const [ruleError, setRuleError] = useState('');

  // Track the current content of each editor in state so evaluate() always
  // reads the latest value regardless of any Monaco re-render behaviour.
  const [ruleYAML, setRuleYAML] = useState(INITIAL_RULE_YAML);
  const [eventData, setEventData] = useState(JSON.stringify(defaultEventData.exec, null, 2));
  const [profileYAML, setProfileYAML] = useState(EMPTY_PROFILE_YAML);
  const [networkYAML, setNetworkYAML] = useState(EMPTY_NETWORK_YAML);

  // Refs are still needed for imperative setValue() calls (e.g. sample loading).
  const ruleEditorRef = useRef<any>(null);
  const eventEditorRef = useRef<any>(null);

  const [mockTabValue, setMockTabValue] = useState(1);

  useEffect(() => {
    fetch(getKubescapePluginUrl() + '/rules-crd.yaml')
      .then(r => r.text())
      .then(text => {
        const doc = yaml.load(text) as any;
        setSampleRules(doc?.spec?.rules ?? []);
      })
      .catch(() => {
        /* rules-crd.yaml not yet downloaded */
      });
  }, []);

  const onSampleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setSelectedSample(id);
    const rule = sampleRules.find(r => r.id === id);
    if (!rule) return;

    const doc = {
      apiVersion: 'kubescape.io/v1',
      kind: 'Rules',
      metadata: { name: rule.id.toLowerCase() + '-rule', namespace: 'kubescape' },
      spec: { rules: [rule] },
    };
    const newRuleYAML = yaml.dump(doc);

    // Update state (used by evaluate) AND the editor model imperatively.
    setRuleYAML(newRuleYAML);
    ruleEditorRef.current?.setValue(newRuleYAML);

    // Auto-select the first event type the rule handles.
    const firstEventType = rule.expressions?.ruleExpression?.[0]?.eventType as EventType;
    if (firstEventType && EVENT_TYPES.includes(firstEventType)) {
      const newEventData = JSON.stringify(defaultEventData[firstEventType] ?? {}, null, 2);
      setEventType(firstEventType);
      setEventData(newEventData);
      eventEditorRef.current?.setValue(newEventData);
    }

    setEvalResults(null);
    setRuleError('');
  };

  const onEventTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const et = e.target.value as EventType;
    const newEventData = JSON.stringify(defaultEventData[et] ?? {}, null, 2);
    setEventType(et);
    setEventData(newEventData);
    eventEditorRef.current?.setValue(newEventData);
    setEvalResults(null);
  };

  const evaluate = () => {
    try {
      const response = window.RuleEval(ruleYAML, eventType, eventData, profileYAML, networkYAML);
      const parsed: RuleEvalResults = JSON.parse(response);
      setEvalResults(parsed);
      setRuleError('');
    } catch (err: any) {
      setRuleError(err.message ?? String(err));
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Toolbar disableGutters>
        <Stack spacing={1}>
          <Typography variant="h5">Rule Editor</Typography>
          <Typography variant="body2" color="text.secondary">
            Author and test <code>kubescape.io/v1 Rules</code> custom resources. CEL expressions are
            evaluated in-browser — no cluster connection required.
          </Typography>
        </Stack>
      </Toolbar>

      {sampleRules.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <FormControl variant="outlined" sx={{ minWidth: 400 }}>
            <TextField
              select
              value={selectedSample}
              onChange={onSampleChange}
              label="Load sample rule"
              size="small"
            >
              {sampleRules.map(r => (
                <MenuItem key={r.id} value={r.id}>
                  {r.id} — {r.name}
                </MenuItem>
              ))}
            </TextField>
          </FormControl>
        </Box>
      )}

      <Grid container spacing={4}>
        <Grid item xs={6}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Rule YAML
          </Typography>
          <MonacoEditor
            editorRef={ruleEditorRef}
            language="yaml"
            defaultValue={INITIAL_RULE_YAML}
            height={550}
            onChange={v => {
              setRuleYAML(v);
              setEvalResults(null);
              setRuleError('');
            }}
          />
        </Grid>

        <Grid item xs={6}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Event Data</Typography>
            <FormControl size="small">
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
            </FormControl>
          </Stack>

          <MonacoEditor
            editorRef={eventEditorRef}
            language="json"
            defaultValue={JSON.stringify(defaultEventData.exec, null, 2)}
            height={250}
            onChange={v => {
              setEventData(v);
              setEvalResults(null);
            }}
          />

          <TabContext value={mockTabValue}>
            <TabList
              onChange={(_: any, v: number) => setMockTabValue(v)}
              sx={{ mt: 1, minHeight: 36 }}
            >
              <Tab label="ApplicationProfile mock" value={1} sx={{ minHeight: 36, py: 0 }} />
              <Tab label="NetworkNeighborhood mock" value={2} sx={{ minHeight: 36, py: 0 }} />
            </TabList>
            <TabPanel value={1}>
              <MonacoEditor
                language="yaml"
                defaultValue={EMPTY_PROFILE_YAML}
                height={200}
                onChange={v => {
                  setProfileYAML(v);
                  setEvalResults(null);
                }}
              />
            </TabPanel>
            <TabPanel value={2}>
              <MonacoEditor
                language="yaml"
                defaultValue={EMPTY_NETWORK_YAML}
                height={200}
                onChange={v => {
                  setNetworkYAML(v);
                  setEvalResults(null);
                }}
              />
            </TabPanel>
          </TabContext>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={evaluate} size="large">
          Evaluate
        </Button>
      </Box>

      {ruleError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {ruleError}
        </Alert>
      )}

      <EvaluationResults results={evalResults} />
    </Box>
  );
}

function MonacoEditor(props: {
  editorRef?: React.MutableRefObject<any>;
  language: string;
  defaultValue: string;
  height: number;
  onChange: (value: string) => void;
}) {
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
      // Use Monaco's own onChange prop — always fires with the correct current
      // value and is not subject to stale-closure issues from manual listeners.
      onChange={(value: string | undefined) => onChange(value ?? '')}
      options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
    />
  );
}
