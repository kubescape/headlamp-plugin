import { SecurityExceptionSpec } from '../softwarecomposition/SecurityException';
import {
  buildExceptionSpec,
  ExceptionSpecInput,
  withControlID,
  withCveID,
  withResourceKind,
} from './SecurityExceptionForm';

function input(overrides: Partial<ExceptionSpecInput> = {}): ExceptionSpecInput {
  return {
    existingSpec: undefined,
    clusterScoped: false,
    author: '',
    reason: '',
    expiresDate: '',
    namespaceSelectorRows: [],
    objectSelectorRows: [],
    preservedNamespaceExpressions: [],
    preservedObjectExpressions: [],
    resources: [],
    images: [],
    postureEntries: [],
    vulnEntries: [],
    ...overrides,
  };
}

describe('buildExceptionSpec', () => {
  it('builds a minimal posture exception', () => {
    const spec = buildExceptionSpec(
      input({
        reason: 'accepted risk',
        resources: [{ kind: 'Deployment', name: 'nginx' }],
        postureEntries: [{ controlID: 'C-0034', frameworkName: '', action: 'ignore' }],
      })
    );

    expect(spec).toEqual({
      reason: 'accepted risk',
      match: { resources: [{ kind: 'Deployment', name: 'nginx' }] },
      posture: [{ controlID: 'C-0034', action: 'ignore' }],
    });
  });

  it('omits the resource name so the entry matches every workload of that kind', () => {
    const spec = buildExceptionSpec(
      input({
        resources: [{ kind: 'Deployment', name: '' }],
        postureEntries: [{ controlID: 'C-0034', frameworkName: '', action: 'ignore' }],
      })
    );
    expect(spec.match.resources).toEqual([{ kind: 'Deployment' }]);
  });

  it('anchors the expiry to the end of the chosen day', () => {
    const spec = buildExceptionSpec(input({ expiresDate: '2026-09-01' }));
    expect(spec.expiresAt).toBe('2026-09-01T23:59:59Z');
  });

  it('writes the author when one is given', () => {
    expect(buildExceptionSpec(input({ author: ' platform-team ' })).author).toBe('platform-team');
    expect(buildExceptionSpec(input()).author).toBeUndefined();
  });

  it('never writes namespaceSelector onto a namespaced exception', () => {
    const spec = buildExceptionSpec(
      input({
        clusterScoped: false,
        namespaceSelectorRows: [{ key: 'env', value: 'staging' }],
      })
    );
    expect(spec.match.namespaceSelector).toBeUndefined();
  });

  it('writes namespaceSelector on a cluster-scoped exception', () => {
    const spec = buildExceptionSpec(
      input({
        clusterScoped: true,
        namespaceSelectorRows: [{ key: 'env', value: 'staging' }],
      })
    );
    expect(spec.match.namespaceSelector).toEqual({ matchLabels: { env: 'staging' } });
  });

  it('writes objectSelector from the label rows', () => {
    const spec = buildExceptionSpec(
      input({ objectSelectorRows: [{ key: 'app', value: 'nginx' }] })
    );
    expect(spec.match.objectSelector).toEqual({ matchLabels: { app: 'nginx' } });
  });

  describe('editing an exception authored elsewhere', () => {
    const existingSpec: SecurityExceptionSpec = {
      author: 'platform-team',
      reason: 'accepted risk',
      match: {
        objectSelector: {
          matchLabels: { app: 'nginx' },
          matchExpressions: [{ key: 'tier', operator: 'In', values: ['web'] }],
        },
        resources: [{ apiGroup: 'apps', kind: 'Deployment', name: 'nginx' }],
      },
      vulnerabilities: [
        {
          vulnerability: { id: 'CVE-2024-0001', aliases: ['GHSA-xxxx'] },
          status: 'under_investigation',
        },
      ],
      posture: [{ controlID: 'C-0034', frameworkName: 'NSA', action: 'ignore' }],
    };

    // What the form loads into state from the spec above.
    const loaded = input({
      existingSpec,
      author: 'platform-team',
      reason: 'accepted risk',
      objectSelectorRows: [{ key: 'app', value: 'nginx' }],
      preservedObjectExpressions: [{ key: 'tier', operator: 'In', values: ['web'] }],
      resources: [{ kind: 'Deployment', name: 'nginx', apiGroup: 'apps' }],
      postureEntries: [
        {
          controlID: 'C-0034',
          frameworkName: 'NSA',
          action: 'ignore',
          original: existingSpec.posture![0],
        },
      ],
      vulnEntries: [
        {
          cveId: 'CVE-2024-0001',
          status: 'under_investigation',
          justification: '',
          impactStatement: '',
          expiredOnFix: false,
          aliases: ['GHSA-xxxx'],
          original: existingSpec.vulnerabilities![0],
        },
      ],
    });

    it('round-trips an untouched exception unchanged', () => {
      expect(buildExceptionSpec(loaded)).toEqual(existingSpec);
    });

    it('keeps the author, the apiGroup, the aliases and the matchExpressions when a field changes', () => {
      const spec = buildExceptionSpec({ ...loaded, reason: 'reviewed again' });

      expect(spec.reason).toBe('reviewed again');
      expect(spec.author).toBe('platform-team');
      expect(spec.match.resources).toEqual([{ apiGroup: 'apps', kind: 'Deployment', name: 'nginx' }]);
      expect(spec.match.objectSelector.matchExpressions).toEqual([
        { key: 'tier', operator: 'In', values: ['web'] },
      ]);
      expect(spec.vulnerabilities[0].vulnerability.aliases).toEqual(['GHSA-xxxx']);
    });

    it('keeps spec fields this form has no editor for', () => {
      const withUnknown = {
        ...existingSpec,
        vulnerabilities: [
          {
            ...existingSpec.vulnerabilities![0],
            // fields the CRD gained after this form was written
            actionStatement: 'patching next release',
            subcomponents: ['pkg:deb/debian/openssl'],
          } as any,
        ],
      };
      const spec = buildExceptionSpec({
        ...loaded,
        existingSpec: withUnknown,
        vulnEntries: [{ ...loaded.vulnEntries[0], original: withUnknown.vulnerabilities[0] }],
        reason: 'reviewed again',
      });

      expect(spec.vulnerabilities[0].actionStatement).toBe('patching next release');
      expect(spec.vulnerabilities[0].subcomponents).toEqual(['pkg:deb/debian/openssl']);
    });

    it('clears a field the user emptied instead of keeping the stored value', () => {
      const spec = buildExceptionSpec({ ...loaded, reason: '', author: '' });
      expect(spec.reason).toBeUndefined();
      expect(spec.author).toBeUndefined();
    });

    it('drops a selector once its last label row is removed', () => {
      const spec = buildExceptionSpec({
        ...loaded,
        objectSelectorRows: [],
        preservedObjectExpressions: [],
      });
      expect(spec.match.objectSelector).toBeUndefined();
    });
  });
});

describe('editing the identity of a row', () => {
  it('keeps apiGroup while the kind is unchanged', () => {
    const row = { kind: 'Deployment', name: 'nginx', apiGroup: 'apps' };

    expect(withResourceKind(row, 'Deployment')).toEqual(row);
  });

  it('drops a stale apiGroup when the kind changes', () => {
    const row = { kind: 'Deployment', name: 'nginx', apiGroup: 'apps' };

    // apps/Service does not exist, so carrying the group over would match nothing.
    expect(withResourceKind(row, 'Service')).toEqual({
      kind: 'Service',
      name: 'nginx',
      apiGroup: undefined,
    });
  });

  it('drops preserved fields when the control ID changes', () => {
    const original = { controlID: 'C-0034', action: 'ignore' as const };
    const row = { controlID: 'C-0034', frameworkName: 'NSA', action: 'ignore' as const, original };

    expect(withControlID(row, 'C-0034').original).toBe(original);
    expect(withControlID(row, 'C-0016').original).toBeUndefined();
    expect(withControlID(row, 'C-0016').frameworkName).toBe('NSA');
  });

  it('drops aliases and preserved fields when the CVE changes', () => {
    const row = {
      cveId: 'CVE-2024-0001',
      status: 'not_affected' as const,
      justification: '' as const,
      impactStatement: 'not reachable',
      expiredOnFix: false,
      aliases: ['GHSA-aaaa-bbbb-cccc'],
      original: { vulnerability: { id: 'CVE-2024-0001' }, status: 'not_affected' as const },
    };

    expect(withCveID(row, 'CVE-2024-0001').aliases).toEqual(['GHSA-aaaa-bbbb-cccc']);

    const changed = withCveID(row, 'CVE-2025-9999');
    expect(changed.aliases).toBeUndefined();
    expect(changed.original).toBeUndefined();
    // Fields the user actually typed are still theirs to keep.
    expect(changed.impactStatement).toBe('not reachable');
  });

  it('does not write the previous CVE aliases onto the new id', () => {
    const row = {
      cveId: 'CVE-2024-0001',
      status: 'fixed' as const,
      justification: '' as const,
      impactStatement: '',
      expiredOnFix: false,
      aliases: ['GHSA-old'],
    };

    const spec = buildExceptionSpec(input({ vulnEntries: [withCveID(row, 'CVE-2025-9999')] }));

    expect(spec.vulnerabilities).toEqual([
      { vulnerability: { id: 'CVE-2025-9999' }, status: 'fixed' },
    ]);
  });
});
