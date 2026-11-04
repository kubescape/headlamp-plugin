import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';

/** A Kubernetes Event, with the fields used here. */
export interface ExceptionEvent {
  reason?: string;
  message?: string;
  count?: number;
  eventTime?: string;
  lastTimestamp?: string;
  firstTimestamp?: string;
}

export function eventTime(event: ExceptionEvent): string | undefined {
  return event.lastTimestamp ?? event.eventTime ?? event.firstTimestamp;
}

/**
 * The events the Kubescape scanner recorded when it suppressed a finding with the exception
 * (reason ExceptionMatched), newest first. Events of a ClusterSecurityException are looked up
 * in all namespaces, as their namespace depends on the recorder.
 */
export async function fetchExceptionEvents(
  kind: 'SecurityException' | 'ClusterSecurityException',
  name: string,
  namespace?: string
): Promise<ExceptionEvent[]> {
  const fieldSelector = new URLSearchParams({
    fieldSelector: `involvedObject.kind=${kind},involvedObject.name=${name},reason=ExceptionMatched`,
  });
  const path = namespace ? `/api/v1/namespaces/${namespace}/events` : '/api/v1/events';
  const list = await request(`${path}?${fieldSelector.toString()}`);
  return ((list.items ?? []) as ExceptionEvent[]).sort(
    (a, b) => new Date(eventTime(b) ?? 0).getTime() - new Date(eventTime(a) ?? 0).getTime()
  );
}
