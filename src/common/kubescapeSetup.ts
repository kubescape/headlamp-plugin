import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getKubescapeNamespace } from '../custom-objects/api-queries';

export type Feature =
  | 'compliance'
  | 'vulnerabilities'
  | 'networkPolicies'
  | 'runtime'
  | 'exceptions';

interface FeatureRequirements {
  title: string;
  // the feature works when one of these resources is served; empty when it needs none
  resources: string[];
  // capabilities without which Kubescape produces no results for the feature
  required: string[];
  recommended: Array<{ capability: string; benefit: string }>;
}

const requirements: Record<Feature, FeatureRequirements> = {
  compliance: {
    title: 'Compliance',
    resources: ['workloadconfigurationscansummaries'],
    required: ['configurationScan'],
    recommended: [
      {
        capability: 'continuousScan',
        benefit: 'compliance results follow changes to workloads instead of the scan schedule',
      },
    ],
  },
  vulnerabilities: {
    title: 'Vulnerabilities',
    resources: ['vulnerabilitymanifestsummaries'],
    required: ['vulnerabilityScan'],
    recommended: [
      { capability: 'relevancy', benefit: 'you can see which CVEs are in code that is used' },
    ],
  },
  networkPolicies: {
    title: 'Network Policies',
    resources: ['generatednetworkpolicies'],
    required: ['networkPolicyService'],
    recommended: [],
  },
  runtime: {
    title: 'Runtime Detection',
    resources: ['containerprofiles', 'applicationprofiles'],
    required: ['runtimeObservability'],
    recommended: [
      { capability: 'runtimeDetection', benefit: 'rule violations raise alerts' },
      {
        capability: 'seccompProfileService',
        benefit: 'Kubescape generates seccomp profiles for the workloads',
      },
    ],
  },
  exceptions: {
    title: 'Exceptions',
    resources: [],
    required: [],
    recommended: [
      {
        capability: 'riskAcceptance',
        benefit:
          'the scans apply the exceptions. Until then, scan results ignore them; the Compliance page of this plugin applies them and the vulnerability pages mark the CVEs they cover',
      },
    ],
  },
};

/** Whether the Kubescape scanners apply SecurityExceptions to the results they store. */
export function scannersApplyExceptions(setup: ClusterSetup): boolean {
  return setup.capabilities?.riskAcceptance === 'enable';
}

export interface ClusterSetup {
  // undefined when the storage API is not served
  servedResources?: Set<string>;
  storageError?: string;
  operatorNamespace?: string;
  // undefined when the capabilities could not be read
  capabilities?: Record<string, string>;
}

export interface SetupIssue {
  severity: 'error' | 'warning';
  message: string;
  // a command that fixes the issue
  fix?: string;
}

const storageGroupVersion = 'spdx.softwarecomposition.kubescape.io/v1beta1';

function enableCommand(capability: string, namespace = 'kubescape') {
  return `helm upgrade kubescape kubescape/kubescape-operator -n ${namespace} --reuse-values --set capabilities.${capability}=enable`;
}

/** The problems with the Kubescape installation that keep the feature from working well. */
export function setupIssues(feature: Feature, setup: ClusterSetup): SetupIssue[] {
  const { title, resources, required, recommended } = requirements[feature];

  if (!setup.servedResources) {
    return [
      {
        severity: 'error',
        message: `The Kubescape storage API (${storageGroupVersion}) is not available${
          setup.storageError ? ` (${setup.storageError})` : ''
        }. Is the Kubescape operator installed and running?`,
        fix: 'helm upgrade --install kubescape kubescape/kubescape-operator -n kubescape --create-namespace --set capabilities.continuousScan=enable',
      },
    ];
  }

  const issues: SetupIssue[] = [];
  if (resources.length > 0 && !resources.some(resource => setup.servedResources!.has(resource))) {
    issues.push({
      severity: 'error',
      message: `The installed Kubescape storage does not serve ${resources.join(
        ' or '
      )}, which ${title} needs. Upgrade the Kubescape operator.`,
    });
  }

  const capabilities = setup.capabilities;
  if (capabilities) {
    for (const capability of required.filter(c => capabilities[c] !== 'enable')) {
      issues.push({
        severity: 'error',
        message: `The ${capability} capability of the Kubescape operator is disabled, so there are no ${title} results.`,
        fix: enableCommand(capability, setup.operatorNamespace),
      });
    }
    for (const { capability, benefit } of recommended.filter(
      r => capabilities[r.capability] !== 'enable'
    )) {
      issues.push({
        severity: 'warning',
        message: `Enable the ${capability} capability of the Kubescape operator, so that ${benefit}.`,
        fix: enableCommand(capability, setup.operatorNamespace),
      });
    }
  }
  return issues;
}

/** Reads the capabilities from the ks-capabilities ConfigMap, preferring the effective ones. */
/**
 * The capabilities in the ks-capabilities ConfigMap. effectiveCapabilities only lists the
 * capabilities whose effective value differs from, or depends on more than, the configured
 * one (such as those that need a backend), so it overrides capabilities instead of replacing it.
 */
export function parseCapabilities(json: string | undefined): Record<string, string> | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    if (!parsed.capabilities && !parsed.effectiveCapabilities) return undefined;
    return { ...parsed.capabilities, ...parsed.effectiveCapabilities };
  } catch {
    return undefined;
  }
}

// Every page checks the setup when it opens; moving between pages reuses a recent answer
const setupMaxAge = 30 * 1000;
const setups = new Map<string, { setup: Promise<ClusterSetup>; readAt: number }>();

/**
 * Looks up how Kubescape is installed in the cluster. Facts it cannot read are left out.
 * Answers are reused for half a minute.
 */
export function readClusterSetup(cluster: string, now: number = Date.now()): Promise<ClusterSetup> {
  const cached = setups.get(cluster);
  if (cached && now - cached.readAt < setupMaxAge) return cached.setup;
  const setup = lookUpClusterSetup(cluster);
  setups.set(cluster, { setup, readAt: now });
  return setup;
}

/** Forgets the setups read, for tests. */
export function clearClusterSetups() {
  setups.clear();
}

async function lookUpClusterSetup(cluster: string): Promise<ClusterSetup> {
  const setup: ClusterSetup = {};
  const [discovery, namespace] = await Promise.all([
    request(`/apis/${storageGroupVersion}`, { cluster }).catch((error: any) => {
      setup.storageError = error?.message ?? String(error);
      return null;
    }),
    getKubescapeNamespace(cluster),
  ]);

  if (Array.isArray(discovery?.resources)) {
    setup.servedResources = new Set(discovery.resources.map((r: { name: string }) => r.name));
  }
  setup.operatorNamespace = namespace.kubeScapeNamespace;
  if (setup.operatorNamespace) {
    const configMap = await request(
      `/api/v1/namespaces/${setup.operatorNamespace}/configmaps/ks-capabilities`,
      { cluster }
    ).catch(() => null);
    setup.capabilities = parseCapabilities(configMap?.data?.capabilities);
  }
  return setup;
}
