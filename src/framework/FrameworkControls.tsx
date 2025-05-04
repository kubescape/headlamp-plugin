import {
  NameValueTable,
  SectionBox,
  StatusLabel,
  StatusLabelProps,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Link, Tooltip } from '@mui/material';
import { getURLSegments } from '../common/url';
import { complianceSeverity } from '../compliance/Compliance';
import { Control, frameworks } from '../rego';

export function FrameworkControls() {
  const [frameworkName] = getURLSegments(-2);
  const framework = frameworks.find(framework => framework.name === frameworkName);
  const controls = framework?.controls ?? [];

  return (
    <SectionBox title="Framework" backLink>
      <NameValueTable
        rows={[
          {
            name: 'Name',
            value: frameworkName,
          },
          {
            name: 'Description',
            value: framework?.description,
          },
        ]}
      />

      <Table
        data={controls}
        columns={[
          {
            id: 'ID',
            header: 'ID',
            accessorKey: 'controlID',
            Cell: ({ cell }: any) => (
              <Link
                target="_blank"
                href={'https://hub.armosec.io/docs/' + cell.getValue().toLowerCase()}
              >
                <div>{cell.getValue()}</div>
              </Link>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Control Name',
            accessorKey: 'name',
            Cell: ({ cell, row }: any) => (
              <Tooltip
                title={row.original.description}
                slotProps={{ tooltip: { sx: { fontSize: '0.9em' } } }}
              >
                <Box>{cell.getValue()}</Box>
              </Tooltip>
            ),
            gridTemplate: 'auto',
          },
          {
            header: 'Category',
            accessorFn: (control: Control) =>
              control.category?.subCategory?.name ?? control.category?.name,
            gridTemplate: 'auto',
          },
          {
            header: 'Remediation',
            accessorFn: (control: Control) => control.remediation.replaceAll('`', "'"),
          },
          {
            header: 'Severity',
            accessorFn: (control: Control) => severityLabel(control.baseScore),
            gridTemplate: 'min-content',
          },
        ]}
        initialState={{
          sorting: [
            {
              id: 'ID',
              desc: false,
            },
          ],
        }}
        reflectInURL="controls"
      />
    </SectionBox>
  );
}

function severityLabel(baseScore: number) {
  const severity = complianceSeverity(baseScore);
  let status: StatusLabelProps['status'] = '';

  if (severity === 'High' || severity === 'Critical') {
    status = 'error';
  }

  return <StatusLabel status={status}>{severity}</StatusLabel>;
}
