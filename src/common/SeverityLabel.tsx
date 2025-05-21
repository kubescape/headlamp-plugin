/* 
  Build a label showing red for critial status. 
*/

import { StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';

export default function makeSeverityLabel(severity: string) {
  return <StatusLabel status={severity === 'Critical' ? 'error' : ''}>{severity}</StatusLabel>;
}
