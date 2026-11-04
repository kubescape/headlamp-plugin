import { describe, expect, it } from 'vitest';
import { compactPorts, portKey, portsText, sortPorts } from './ports';

const tcp = (port: number | string) => ({ protocol: 'TCP', port: port as string });

describe('ports', () => {
  it('compares ports whether their number is a number or a string', () => {
    expect(portKey(tcp(443))).toBe(portKey(tcp('443')));
    expect(portKey({ port: '443' })).toBe(portKey(tcp('443')));
    expect(portKey({ protocol: 'UDP', port: '443' })).not.toBe(portKey(tcp('443')));
  });

  it('sorts by protocol and number, with named ports last', () => {
    expect(sortPorts([{ protocol: 'UDP', port: '53' }, tcp('http'), tcp(8443), tcp('22')])).toEqual(
      [tcp('22'), tcp(8443), tcp('http'), { protocol: 'UDP', port: '53' }]
    );
  });

  it('joins consecutive ports into ranges', () => {
    const passive = Array.from({ length: 101 }, (_, index) => tcp(50100 - index));
    expect(portsText(compactPorts([...passive, tcp(2022), tcp(2021), tcp(8443)]))).toBe(
      'TCP:2021-2022, TCP:8443, TCP:50000-50100'
    );
    expect(
      portsText(
        compactPorts([
          { protocol: 'TCP', port: '8000', endPort: 8010 },
          tcp(8005),
          tcp(8011),
          tcp(8011),
          { protocol: 'UDP', port: '8012' },
          tcp('metrics'),
        ])
      )
    ).toBe('TCP:8000-8011, TCP:metrics, UDP:8012');
  });

  it('names no ports all ports', () => {
    expect(portsText([])).toBe('all ports');
    expect(portsText([{ protocol: 'UDP' }])).toBe('UDP: all ports');
  });
});
