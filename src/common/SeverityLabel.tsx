/* 
  Build a label showing error and warning for critial and high status. 
*/

import { StatusLabel, StatusLabelProps } from './StatusLabel';

export default function makeSeverityLabel(severity: string) {
  let status: StatusLabelProps['status'] = '';
  if (severity === 'Critical') status = 'error';
  else if (severity === 'High') status = 'warning';

  return <StatusLabel status={status}>{severity}</StatusLabel>;
}
