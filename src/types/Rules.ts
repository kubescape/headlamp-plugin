export interface Rules {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec: RulesSpec;
}

export interface RulesSpec {
  rules: Rule[];
}

export interface Rule {
  name: string;
  id: string;
  enabled: boolean;
  description: string;
  expressions: RuleExpressions;
  profileDependency: ProfileDependency;
  severity: number;
  supportPolicy: boolean;
  isTriggerAlert: boolean;
  mitreTactic?: string;
  mitreTechnique?: string;
  tags?: string[];
}

export interface RuleExpressions {
  message: string;
  uniqueId: string;
  ruleExpression: RuleExpression[];
}

export interface RuleExpression {
  eventType: EventType;
  expression: string;
}

export type EventType =
  | 'exec'
  | 'open'
  | 'syscall'
  | 'capabilities'
  | 'dns'
  | 'network'
  | 'bpf'
  | 'kmod'
  | 'ssh'
  | 'symlink'
  | 'hardlink'
  | 'ptrace'
  | 'randomx'
  | 'unshare'
  | 'iouring'
  | 'http'
  | 'fork'
  | 'exit';

// 0 = Required (rule always needs a profile), 1 = Optional, 2 = NotRequired
export type ProfileDependency = 0 | 1 | 2;

// --- CEL evaluation result types (mirror go/rules/Evaluator.go) ---

export interface RuleExprResult {
  eventType: string;
  expression: string;
  result: boolean | null;
  error?: string;
}

export interface StringExprResult {
  result: string;
  error?: string;
}

export interface RuleEvalResults {
  error?: string;
  eventTypeMismatch?: string;
  ruleExpression: RuleExprResult[];
  message: StringExprResult;
  uniqueId: StringExprResult;
}

// --- Mock data types for the playground (mirror go/rules/Libraries.go) ---

export interface MockProfile {
  containers: Record<string, MockContainer>;
}

export interface MockContainer {
  execs?: Array<{ path: string; args?: string[] }>;
  opens?: Array<{ path: string; flags?: string[] }>;
  syscalls?: string[];
  capabilities?: string[];
}

export interface MockNetwork {
  containers: Record<string, MockNetworkContainer>;
}

export interface MockNetworkContainer {
  egress?: Array<{ ipAddress?: string; dns?: string[] }>;
  ingress?: Array<{ ipAddress?: string; dns?: string[] }>;
}

// Default event data templates for each event type, used to pre-populate the editor.
export const defaultEventData: Record<EventType, object> = {
  exec: {
    comm: 'bash',
    pid: 1234,
    exepath: '/bin/bash',
    cwd: '/',
    args: ['/bin/bash'],
    upperlayer: false,
    pupperlayer: false,
    pcomm: 'containerd-shim',
    containerId: 'abc123',
    containerName: 'my-container',
    namespace: 'default',
    podName: 'my-pod',
  },
  open: {
    comm: 'cat',
    pid: 1234,
    path: '/etc/shadow',
    flags: ['O_RDONLY'],
    flagsRaw: 0,
    containerId: 'abc123',
    containerName: 'my-container',
  },
  syscall: {
    comm: 'bash',
    pid: 1234,
    syscallName: 'ptrace',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  capabilities: {
    comm: 'bash',
    pid: 1234,
    capName: 'CAP_NET_ADMIN',
    syscallName: 'socket',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  dns: {
    comm: 'curl',
    name: 'pool.supportxmr.com.',
    containerName: 'my-container',
    containerId: 'abc123',
  },
  network: {
    comm: 'curl',
    pktType: 'OUTGOING',
    dstAddr: '8.8.8.8',
    dstPort: 443,
    proto: 'TCP',
    dstIp: '8.8.8.8',
    containerName: 'my-container',
    containerId: 'abc123',
  },
  bpf: {
    comm: 'bpftool',
    cmd: 5,
    containerId: 'abc123',
    containerName: 'my-container',
  },
  kmod: {
    comm: 'insmod',
    module: 'evil.ko',
    syscallName: 'init_module',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  ssh: {
    comm: 'ssh',
    srcPort: 45000,
    dstPort: 22,
    dstIp: '10.0.0.1',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  symlink: {
    comm: 'ln',
    oldPath: '/etc/shadow',
    newPath: '/tmp/shadow-link',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  hardlink: {
    comm: 'ln',
    oldPath: '/etc/shadow',
    newPath: '/tmp/shadow-hard',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  ptrace: {
    comm: 'strace',
    exepath: '/usr/bin/strace',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  randomx: {
    containerId: 'abc123',
    containerName: 'my-container',
  },
  unshare: {
    comm: 'unshare',
    pcomm: 'bash',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  iouring: {
    comm: 'app',
    opcode: 1,
    flagsRaw: 0,
    containerId: 'abc123',
    containerName: 'my-container',
  },
  http: {
    comm: 'nginx',
    containerId: 'abc123',
    containerName: 'my-container',
  },
  fork: {
    comm: 'bash',
    pid: 1234,
    containerId: 'abc123',
    containerName: 'my-container',
  },
  exit: {
    comm: 'bash',
    pid: 1234,
    containerId: 'abc123',
    containerName: 'my-container',
  },
};
