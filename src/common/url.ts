import { useHistory, useLocation } from 'react-router';

/**
 * Returns the value of a query parameter of the current route, and a function that removes it.
 * The route is read from the router, as Headlamp desktop keeps the query in the URL hash.
 */
export function useURLSearchParam(name: string): [string | null, () => void] {
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);

  const clear = () => {
    params.delete(name);
    history.replace({ ...location, search: params.toString() });
  };
  return [params.get(name), clear];
}

export function getURLSegments(...indexes: number[]): string[] {
  const location = useLocation();
  const segments = location.pathname.split('/');

  return indexes.map(index => segments[segments.length + index]);
}

export function getLastURLSegment(): string {
  return getURLSegments(-1)[0];
}
