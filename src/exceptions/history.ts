/*
  Records who created and changed an exception in this plugin.

  The creator is the author of the exception (spec.author), which other Kubescape tools show
  too. All creates and changes are kept in an annotation, so the detail page can show a
  history. Anyone who can update the exception can change both, so the audit log of the
  Kubernetes API server remains the record to rely on.
*/
import { getCurrentUser } from '../common/currentUser';
import {
  ClusterSecurityException,
  SecurityException,
} from '../softwarecomposition/SecurityException';

export const historyAnnotation = 'headlamp.kubescape.io/history';

// Older entries are dropped, to keep the annotation small
const maxHistoryEntries = 50;

export interface HistoryEntry {
  action: 'created' | 'changed';
  // undefined when the cluster did not tell who the user is
  user?: string;
  time: string;
}

type AnyException = SecurityException | ClusterSecurityException;

/** The recorded creates and changes of the exception, oldest first. */
export function exceptionHistory(exception: {
  metadata: { annotations?: Record<string, string> };
}): HistoryEntry[] {
  const json = exception.metadata.annotations?.[historyAnnotation];
  if (!json) return [];
  try {
    const entries = JSON.parse(json);
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Records the create or change of the exception by the given user: sets the author of a new
 * exception, keeps the author of an existing one, and adds an entry to the history.
 *
 * @param existing - The exception as it was before the change, undefined for a new one.
 */
export function recordChange<T extends AnyException>(
  exception: T,
  existing: AnyException | undefined,
  user: string | undefined,
  now: Date = new Date()
): T {
  const author = existing ? existing.spec.author : user;
  const entry: HistoryEntry = {
    action: existing ? 'changed' : 'created',
    ...(user && { user }),
    time: now.toISOString(),
  };
  const history = [...(existing ? exceptionHistory(existing) : []), entry].slice(
    -maxHistoryEntries
  );

  return {
    ...exception,
    metadata: {
      ...exception.metadata,
      annotations: {
        ...exception.metadata.annotations,
        [historyAnnotation]: JSON.stringify(history),
      },
    },
    spec: { ...exception.spec, ...(author && { author }) },
  };
}

/** {@link recordChange} by the user of Headlamp in the current cluster. */
export async function recordChangeByCurrentUser<T extends AnyException>(
  exception: T,
  existing?: AnyException,
  // the cluster that the exception is created in, which names the user; the current one by default
  cluster?: string
): Promise<T> {
  return recordChange(exception, existing, await getCurrentUser(cluster));
}
