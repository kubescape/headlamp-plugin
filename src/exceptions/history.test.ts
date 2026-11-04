import { vi } from 'vitest';
import { SecurityException } from '../softwarecomposition/SecurityException';
import {
  exceptionHistory,
  historyAnnotation,
  recordChange,
  recordChangeByCurrentUser,
} from './history';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('../common/currentUser', () => ({ getCurrentUser }));

const exception = (
  spec: SecurityException['spec'] = { reason: 'accepted risk' },
  annotations?: Record<string, string>
): SecurityException => ({
  apiVersion: 'kubescape.io/v1beta1',
  kind: 'SecurityException',
  metadata: { name: 'web', namespace: 'shop', ...(annotations && { annotations }) },
  spec,
});

const t1 = new Date('2026-10-30T10:00:00Z');
const t2 = new Date('2026-10-31T09:30:00Z');

it('makes the creator the author and starts the history', () => {
  const created = recordChange(exception(), undefined, 'alice@example.com', t1);

  expect(created.spec).toEqual({ reason: 'accepted risk', author: 'alice@example.com' });
  expect(exceptionHistory(created)).toEqual([
    { action: 'created', user: 'alice@example.com', time: t1.toISOString() },
  ]);
});

it('keeps the author, other annotations and the history when the exception changes', () => {
  const created = recordChange(
    exception(undefined, { 'team.example.com/ticket': 'SEC-12' }),
    undefined,
    'alice@example.com',
    t1
  );
  // the edit form builds the spec anew, without the author
  const edited = { ...created, spec: { reason: 'accepted until the upgrade' } };

  const changed = recordChange(edited, created, 'bob@example.com', t2);

  expect(changed.spec).toEqual({
    reason: 'accepted until the upgrade',
    author: 'alice@example.com',
  });
  expect(changed.metadata.annotations?.['team.example.com/ticket']).toBe('SEC-12');
  expect(exceptionHistory(changed)).toEqual([
    { action: 'created', user: 'alice@example.com', time: t1.toISOString() },
    { action: 'changed', user: 'bob@example.com', time: t2.toISOString() },
  ]);
});

it('records changes of an unknown user without a name and leaves the author unset', () => {
  const created = recordChange(exception(), undefined, undefined, t1);
  expect(created.spec.author).toBeUndefined();
  expect(exceptionHistory(created)).toEqual([{ action: 'created', time: t1.toISOString() }]);

  // an exception made with kubectl keeps its author
  const changed = recordChange(
    exception(),
    exception({ author: 'ci-pipeline' }),
    'bob@example.com',
    t2
  );
  expect(changed.spec.author).toBe('ci-pipeline');
});

it('keeps the 50 most recent entries', () => {
  let current = recordChange(exception(), undefined, 'alice', t1);
  for (let i = 0; i < 60; i++) {
    current = recordChange(current, current, `user-${i}`, t2);
  }
  const history = exceptionHistory(current);
  expect(history).toHaveLength(50);
  expect(history.at(-1)?.user).toBe('user-59');
});

it('ignores a history it cannot read', () => {
  expect(exceptionHistory(exception(undefined, { [historyAnnotation]: 'not json' }))).toEqual([]);
  expect(exceptionHistory(exception(undefined, { [historyAnnotation]: '{}' }))).toEqual([]);
  expect(exceptionHistory(exception())).toEqual([]);
});

it('records the change under the user of the current cluster', async () => {
  getCurrentUser.mockResolvedValue('carol@example.com');
  const created = await recordChangeByCurrentUser(exception());
  expect(created.spec.author).toBe('carol@example.com');
  expect(exceptionHistory(created)[0].user).toBe('carol@example.com');
});
