import { NameValueTable, SectionBox, Table } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Collapse, Link, Tooltip } from '@mui/material';
import { useState } from 'react';
import { StatusLabel, StatusLabelProps } from '../common/StatusLabel';
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
                href={'https://kubescape.io/docs/controls/' + cell.getValue().toLowerCase()}
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
            header: 'Control Types',
            accessorFn: (control: Control) => control.attributes?.controlTypeTags?.join(', '),
          },
          {
            header: 'Scanning scope',
            accessorFn: (control: Control) => control.scanningScope?.matches?.join(', '),
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
          {
            header: 'Example',
            accessorFn: (control: Control) => control.example,
            Cell: ({ cell }: any) => {
              const value = cell.getValue();
              if (value?.length > 0 && value[0] === '@')
                return (
                  <Link
                    target="_blank"
                    href={`https://github.com/kubescape/regolibrary/blob/master/${value.slice(1)}`}
                  >
                    {value}
                  </Link>
                );
              return value && <CodePanel value={value} />;
            },
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

function CodePanel(props: Readonly<{ value: string }>) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(!open)}>Code</button>
      <Collapse in={open}>
        <pre>
          <code>{props.value}</code>
        </pre>
      </Collapse>
    </div>
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
