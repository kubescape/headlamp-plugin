/*
  A count of findings of one severity, in a box with the severity color.
*/
import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Stack, Tooltip } from '@mui/material';
import { ReactNode } from 'react';

export const severityColors: Record<string, string> = {
  Critical: 'purple',
  High: 'red',
  Medium: 'orange',
  Low: 'yellow',
};

export type SeverityLink = {
  routeName: string;
  params: Record<string, string>;
  activeCluster?: string;
};

/**
 * Shows the count on one line in a box that is wide enough for four digits, so boxes line up
 * across table rows. With a link, the count opens the findings of that severity.
 */
export function SeverityCountBox(
  props: Readonly<{
    severity: string;
    count: number;
    tooltip?: ReactNode;
    link?: SeverityLink;
  }>
) {
  const { severity, count, tooltip, link } = props;

  const content = link ? (
    <Link
      routeName={link.routeName}
      params={link.params}
      activeCluster={link.activeCluster}
      search={`?severity=${severity}`}
      aria-label={`${count} ${severity} findings`}
    >
      {count}
    </Link>
  ) : (
    count
  );

  return (
    <Box
      sx={{
        borderLeft: 2,
        borderTop: 1,
        borderRight: 1,
        borderBottom: 1,
        borderColor: `gray gray gray ${severityColors[severity] ?? 'gray'}`,
        textAlign: 'center',
        minWidth: '6ch',
        flexShrink: 0,
        px: 0.5,
        whiteSpace: 'nowrap',
      }}
    >
      <Tooltip title={tooltip ?? severity}>
        <Box>{content}</Box>
      </Tooltip>
    </Box>
  );
}

/** The boxes for Critical, High, Medium and Low findings side by side. */
export function SeverityCountStack(
  props: Readonly<{
    count: (severity: string) => number;
    tooltip?: (severity: string) => ReactNode;
    link?: SeverityLink;
  }>
) {
  const { count, tooltip, link } = props;
  return (
    <Stack direction="row" spacing={1}>
      {Object.keys(severityColors).map(severity => (
        <SeverityCountBox
          key={severity}
          severity={severity}
          count={count(severity)}
          tooltip={tooltip?.(severity)}
          link={link}
        />
      ))}
    </Stack>
  );
}
