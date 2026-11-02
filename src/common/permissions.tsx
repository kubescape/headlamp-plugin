/*
  Asks Kubernetes whether the user may do something, so actions they cannot do are disabled
  with an explanation instead of failing with an API error.
*/
import { post } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { IconButton, Tooltip } from '@mui/material';
import { ReactElement, ReactNode, useEffect, useState } from 'react';

export interface AccessCheck {
  // the API group, '' for the core group
  group: string;
  resource: string;
  subresource?: string;
  verb: string;
  // undefined for cluster-scoped resources, or to ask about all namespaces
  namespace?: string;
  name?: string;
}

const answers = new Map<string, Promise<boolean | undefined>>();

/**
 * Whether the user may do it, or undefined when the cluster does not tell. Answers are
 * remembered for the session.
 */
export function canI(
  check: AccessCheck,
  cluster: string | null = getCluster()
): Promise<boolean | undefined> {
  const key = JSON.stringify([cluster, check]);
  let answer = answers.get(key);
  if (!answer) {
    // any failure, even a synchronous one, means that the answer is unknown
    answer = Promise.resolve()
      .then(() =>
        post(
          '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews',
          {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            spec: { resourceAttributes: check },
          },
          false,
          cluster ? { cluster } : undefined
        )
      )
      .then((review: any) => {
        const allowed = review?.status?.allowed;
        if (typeof allowed === 'boolean') return allowed;
        answers.delete(key);
        return undefined;
      })
      .catch(() => {
        answers.delete(key);
        return undefined;
      });
    answers.set(key, answer);
  }
  return answer;
}

/** Hook around {@link canI}; undefined while asking, or when there is nothing to check. */
export function useCanI(check: AccessCheck | null, cluster?: string | null): boolean | undefined {
  const [allowed, setAllowed] = useState<boolean | undefined>();
  const key = JSON.stringify([cluster, check]);

  useEffect(() => {
    if (!check) return;
    let active = true;
    canI(check, cluster === undefined ? getCluster() : cluster).then(answer => {
      if (active) setAllowed(answer);
    });
    return () => {
      active = false;
    };
    // key covers check and cluster, which may be new objects on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return check ? allowed : undefined;
}

/**
 * The first of the checks that the user is denied, or undefined while asking, or when every check
 * is allowed or unanswered.
 */
function useDeniedCheck(checks: AccessCheck[], cluster?: string | null): AccessCheck | undefined {
  const [denied, setDenied] = useState<AccessCheck | undefined>();
  const key = JSON.stringify([cluster, checks]);

  useEffect(() => {
    let active = true;
    const target = cluster === undefined ? getCluster() : cluster;
    Promise.all(checks.map(check => canI(check, target))).then(answers => {
      if (active) setDenied(checks[answers.indexOf(false)]);
    });
    return () => {
      active = false;
    };
    // key covers checks and cluster, which may be new objects on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return denied;
}

/** Explains which permission the user is missing. */
export function deniedMessage(check: AccessCheck): string {
  const resource = check.subresource ? `${check.resource}/${check.subresource}` : check.resource;
  const object = check.name ? ` ${check.name}` : '';
  const where = check.namespace ? ` in namespace ${check.namespace}` : '';
  return `You are not allowed to ${check.verb} ${resource}${object}${where}.`;
}

/**
 * Renders an action, disabled with an explanation when the user may not do it; an action that
 * needs several permissions names the first one missing. While the answer is unknown the action
 * stays enabled, so an unanswered check never blocks the user.
 */
export function Permitted(
  props: Readonly<{
    check: AccessCheck | AccessCheck[] | null;
    cluster?: string | null;
    children: (allowed: boolean) => ReactElement;
  }>
) {
  const { check, cluster, children } = props;
  let checks: AccessCheck[] = [];
  if (Array.isArray(check)) checks = check;
  else if (check) checks = [check];
  const denied = useDeniedCheck(checks, cluster);
  if (denied) {
    return (
      <Tooltip title={deniedMessage(denied)}>
        <span>{children(false)}</span>
      </Tooltip>
    );
  }
  return children(true);
}

/** An icon button with a tooltip, disabled with an explanation when the user may not use it. */
export function PermittedIconButton(
  props: Readonly<{
    check: AccessCheck | null;
    cluster?: string | null;
    title: string;
    ariaLabel?: string;
    onClick: () => void;
    children: ReactNode;
  }>
) {
  const { check, cluster, title, ariaLabel = title, onClick, children } = props;
  return (
    <Permitted check={check} cluster={cluster}>
      {allowed =>
        allowed ? (
          <Tooltip title={title}>
            <IconButton size="small" aria-label={ariaLabel} onClick={onClick}>
              {children}
            </IconButton>
          </Tooltip>
        ) : (
          <IconButton size="small" aria-label={ariaLabel} disabled>
            {children}
          </IconButton>
        )
      }
    </Permitted>
  );
}

/** Creating SecurityExceptions and ClusterSecurityExceptions. */
export function createExceptionCheck(namespace?: string): AccessCheck {
  return namespace
    ? { group: 'kubescape.io', resource: 'securityexceptions', verb: 'create', namespace }
    : { group: 'kubescape.io', resource: 'clustersecurityexceptions', verb: 'create' };
}
