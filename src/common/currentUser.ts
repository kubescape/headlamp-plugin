import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { useEffect, useState } from 'react';

const usernames = new Map<string, Promise<string | undefined>>();

// SelfSubjectReview is GA in Kubernetes 1.28 and beta, enabled by default, in 1.27
async function lookUpUsername(cluster?: string): Promise<string | undefined> {
  for (const version of ['v1', 'v1beta1']) {
    try {
      const review = await post(
        `/apis/authentication.k8s.io/${version}/selfsubjectreviews`,
        { apiVersion: `authentication.k8s.io/${version}`, kind: 'SelfSubjectReview' },
        false,
        cluster ? { cluster } : undefined
      );
      const username = review?.status?.userInfo?.username;
      if (username) return username;
    } catch {
      // try the next version
    }
  }
  return undefined;
}

/**
 * The name the Kubernetes API server knows the user of Headlamp as, like `kubectl auth whoami`.
 * Undefined when the cluster does not tell. Looked up once per cluster and session.
 */
export function getCurrentUser(cluster: string | null = getCluster()): Promise<string | undefined> {
  const key = cluster ?? '';
  let username = usernames.get(key);
  if (!username) {
    username = lookUpUsername(cluster ?? undefined).then(name => {
      // look up again next time, the cluster may have been unreachable
      if (!name) usernames.delete(key);
      return name;
    });
    usernames.set(key, username);
  }
  return username;
}

/** Hook around {@link getCurrentUser}, for the current cluster unless another is given. */
export function useCurrentUser(cluster?: string): string | undefined {
  const [username, setUsername] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    getCurrentUser(cluster).then(name => {
      if (active) setUsername(name);
    });
    return () => {
      active = false;
    };
  }, [cluster]);
  return username;
}
