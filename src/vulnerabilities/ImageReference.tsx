/*
  An image, linked to its vulnerability page, with a button to the registry that lists its tags.
*/
import { Icon } from '@iconify/react';
import { Link as HeadlampLink } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Button, Stack, Tooltip } from '@mui/material';
import { RoutingName } from '../index';
import { parseImageReference, registryPage } from './registry';

export function ImageReference(
  props: Readonly<{
    image?: string;
    // the vulnerability report of the image, to link to
    report?: { name: string; namespace: string; cluster?: string };
  }>
) {
  const { image, report } = props;
  if (!image) return null;
  const page = registryPage(image);
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      {report ? (
        <HeadlampLink
          routeName={RoutingName.ImageVulnerabilityDetails}
          params={{ namespace: report.namespace, name: report.name }}
          activeCluster={report.cluster}
        >
          {image}
        </HeadlampLink>
      ) : (
        <span>{image}</span>
      )}
      {page && (
        <Tooltip
          title={`Newer versions of ${parseImageReference(image)?.repository} are listed on ${
            page.name
          }`}
        >
          <Button
            size="small"
            variant="outlined"
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<Icon icon="mdi:open-in-new" />}
          >
            {page.name}
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
}
