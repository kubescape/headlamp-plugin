import { describe, expect, it } from 'vitest';
import {
  alertDomain,
  alertMessage,
  alertRule,
  alertSeverity,
  alertTrace,
  alertWorkload,
  indexRules,
  mitreUrl,
  processId,
  ruleDescription,
  workloadOfPod,
} from './alertFields';
import type { AlertmanagerAlert } from './alertmanager';

function alert(
  labels: Record<string, string>,
  annotations: Record<string, string> = {}
): AlertmanagerAlert {
  return {
    labels: { alertname: 'KubescapeRuleViolated', ...labels },
    annotations,
    startsAt: '2026-10-31T17:19:17Z',
    endsAt: '2026-10-31T18:19:17Z',
    status: { state: 'active' },
    fingerprint: 'abc',
  };
}

describe('alertSeverity', () => {
  it('maps the priorities of the node-agent like the node-agent', () => {
    const severities = ['0', '1', '3', '5', '7', '8', '10', '1000'].map(severity =>
      alertSeverity(alert({ severity }))
    );
    expect(severities).toEqual([
      'None',
      'Low',
      'Low',
      'Medium',
      'Medium',
      'High',
      'Critical',
      'System issue',
    ]);
  });

  it('reads severities sent as names', () => {
    expect(alertSeverity(alert({ severity: 'critical' }))).toBe('Critical');
    expect(alertSeverity(alert({ severity: 'High' }))).toBe('High');
    expect(alertSeverity(alert({}))).toBeUndefined();
  });
});

describe('workloadOfPod', () => {
  it('reads the workload from the names Kubernetes generates for pods', () => {
    expect(workloadOfPod('cert-watch-b576bb668-5f2s6')).toBe('cert-watch');
    expect(workloadOfPod('ci-77c6d8899b-r27xt')).toBe('ci');
    expect(workloadOfPod('api-gateway-3efdba8be467-74bb68cdb9-rpxlm')).toBe(
      'api-gateway-3efdba8be467'
    );
    expect(workloadOfPod('shop-nightly-sync-29888835-kxll6')).toBe('shop-nightly-sync');
    expect(workloadOfPod('node-agent-tr5nd')).toBe('node-agent');
    expect(workloadOfPod('chat-0')).toBe('chat');
    expect(workloadOfPod('pg-app-database-1')).toBe('pg-app-database');
  });

  it('keeps names that Kubernetes did not generate', () => {
    expect(workloadOfPod('debug-shell')).toBe('debug-shell');
  });
});

describe('alertWorkload', () => {
  it('prefers the workload the exporter names', () => {
    expect(alertWorkload(alert({ workload_name: 'web', pod_name: 'api-0' }))).toBe('web');
    expect(alertWorkload(alert({ pod_name: 'api-0' }))).toBe('api');
    expect(alertWorkload(alert({}))).toBeUndefined();
  });
});

describe('alertMessage', () => {
  it('shows what the rule found rather than the summary', () => {
    expect(
      alertMessage(
        alert(
          {},
          {
            description:
              'Unexpected domain communication: _acme-challenge.example.com. from: watcher',
            summary:
              "Rule 'DNS Anomalies in container' in 'cert-watch' namespace 'certificates' failed",
          }
        )
      )
    ).toBe('Unexpected domain communication: _acme-challenge.example.com. from: watcher');
    expect(alertMessage(alert({}, { description: '', summary: 'Rule failed' }))).toBe(
      'Rule failed'
    );
  });
});

describe('alertDomain', () => {
  it('reads the domain from the message of the DNS rule, without the trailing dot', () => {
    expect(
      alertDomain(
        alert({}, { description: 'Unexpected domain communication: golang.org. from: proxy' })
      )
    ).toBe('golang.org');
    expect(
      alertDomain(
        alert({}, { message: 'Unexpected domain communication: API.Example.com from: app' })
      )
    ).toBe('api.example.com');
    expect(
      alertDomain(alert({}, { description: 'Unexpected process launched: sh' }))
    ).toBeUndefined();
  });
});

describe('processId', () => {
  it('leaves out the memory addresses recent node-agents send as ids', () => {
    expect(processId('0')).toBe('0');
    expect(processId('1000')).toBe('1000');
    expect(processId('824701441376')).toBeUndefined();
    expect(processId(undefined)).toBeUndefined();
  });
});

describe('alertRule', () => {
  it('finds the rule of an alert in the cluster of the alert, by id or by name', () => {
    const index = indexRules([
      {
        cluster: 'a',
        rules: [{ id: 'R0005', name: 'DNS Anomalies in container', description: 'A' }],
      },
      {
        cluster: 'b',
        rules: [{ id: 'R0005', name: 'DNS Anomalies in container', description: 'B' }],
      },
    ]);
    const inCluster = (cluster: string, labels: Record<string, string>) =>
      alertRule(index, { ...alert(labels), cluster })?.description;
    expect(inCluster('a', { rule_id: 'R0005' })).toBe('A');
    expect(inCluster('b', { rule_name: 'DNS Anomalies in container' })).toBe('B');
    expect(inCluster('c', { rule_id: 'R0005' })).toBeUndefined();
  });

  it('describes the rule as a sentence', () => {
    expect(ruleDescription({ description: 'Detects unexpected process launches' })).toBe(
      'Detects unexpected process launches.'
    );
    expect(ruleDescription({ description: 'Detects X.' })).toBe('Detects X.');
    expect(ruleDescription({})).toBeUndefined();
  });
});

describe('mitreUrl', () => {
  it('links tactics, techniques and sub-techniques', () => {
    expect(mitreUrl('TA0011')).toBe('https://attack.mitre.org/tactics/TA0011/');
    expect(mitreUrl('T1059')).toBe('https://attack.mitre.org/techniques/T1059/');
    expect(mitreUrl('T1071.004')).toBe('https://attack.mitre.org/techniques/T1071/004/');
    expect(mitreUrl('custom')).toBeUndefined();
  });
});

describe('alertTrace', () => {
  it('leaves out empty traces and formats the others', () => {
    expect(alertTrace(alert({ trace: '{}' }))).toBeUndefined();
    expect(alertTrace(alert({ trace: '{"a":1}' }))).toBe('{\n  "a": 1\n}');
    expect(alertTrace(alert({ trace: 'not json' }))).toBe('not json');
  });
});
