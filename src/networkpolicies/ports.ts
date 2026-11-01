/*
  Ports of network policy rules: compared, sorted and written as text.
*/
import { NetworkPolicy } from '../softwarecomposition/GeneratedNetworkPolicy';

const protocolOf = (port: NetworkPolicy.Port) => port.protocol ?? 'TCP';

// The number of a port; the YAML of a policy can give it as a number or a string
function portNumber(port: NetworkPolicy.Port): number | undefined {
  const value = port.port as string | number | undefined;
  if (value === undefined) return undefined;
  return typeof value === 'number' || /^\d+$/.test(value) ? Number(value) : undefined;
}

/** The same key for equal ports, whether their number is a number or a string. */
export function portKey(port: NetworkPolicy.Port): string {
  return JSON.stringify([
    protocolOf(port),
    port.port === undefined ? null : String(port.port),
    port.endPort ?? null,
  ]);
}

/** The ports by protocol, then by number, with named ports after the numbers. */
export function sortPorts(ports: NetworkPolicy.Port[]): NetworkPolicy.Port[] {
  return [...ports].sort(
    (a, b) =>
      protocolOf(a).localeCompare(protocolOf(b)) ||
      (portNumber(a) ?? Infinity) - (portNumber(b) ?? Infinity) ||
      String(a.port ?? '').localeCompare(String(b.port ?? ''))
  );
}

/** The ports with the consecutive numbers of a protocol joined into ranges. */
export function compactPorts(ports: NetworkPolicy.Port[]): NetworkPolicy.Port[] {
  const result: NetworkPolicy.Port[] = [];
  for (const port of sortPorts(ports)) {
    const start = portNumber(port);
    const last = result[result.length - 1];
    const lastStart = last && portNumber(last);
    const lastEnd = last?.endPort ?? lastStart;
    if (
      start !== undefined &&
      lastStart !== undefined &&
      lastEnd !== undefined &&
      protocolOf(last) === protocolOf(port) &&
      start <= lastEnd + 1
    ) {
      const end = port.endPort ?? start;
      if (end > lastEnd) result[result.length - 1] = { ...last, endPort: end };
      continue;
    }
    result.push(port);
  }
  return result;
}

/** Ports as a policy names them, such as TCP:8000-8010, UDP:53; no ports are all ports. */
export function portsText(ports: NetworkPolicy.Port[] | undefined): string {
  if (!ports?.length) return 'all ports';
  return ports
    .map(port => {
      const protocol = protocolOf(port);
      if (port.port === undefined) return `${protocol}: all ports`;
      return `${protocol}:${port.port}${port.endPort ? `-${port.endPort}` : ''}`;
    })
    .join(', ');
}
