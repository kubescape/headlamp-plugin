/*
  The newest version of images and the end of life of their release line, for the image list and
  the pages of an image and a workload. Both can be switched off in the plugin settings.
*/
import { Icon } from '@iconify/react';
import { Box, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { KubescapeConfig, kubescapeConfigStore } from '../common/config-store';
import {
  imageVersionKey,
  LatestVersion,
  lookupImageVersion,
  ReleaseLine,
  versionCheckerResults,
} from './imageVersionSources';
import { imageTag, registryPage } from './registry';
import { isNewer } from './versions';

export interface ImageVersion {
  tag?: string;
  latest?: LatestVersion;
  // whether the latest version is newer than the tag
  newer: boolean;
  line?: ReleaseLine;
}

export function useImageVersionSettings() {
  const config = kubescapeConfigStore.useConfig()() as KubescapeConfig | undefined;
  const enabled = config?.imageVersions !== false;
  return { enabled, endOfLife: enabled && config?.endOfLife !== false };
}

export interface ImageInCluster {
  image: string;
  cluster: string;
  // the source repository the labels of the image name, from its report (imageSourceLabel)
  source?: string;
}

export function imageVersionMapKey({ image, cluster }: ImageInCluster) {
  return `${cluster}|${image}`;
}

const noVersions = new Map<string, ImageVersion>();

async function findVersion({ image, cluster, source }: ImageInCluster): Promise<ImageVersion> {
  const tag = imageTag(image);
  const key = imageVersionKey(image);
  const checked = key ? (await versionCheckerResults(cluster)).get(key) : undefined;
  const found = await lookupImageVersion(image, { latest: !checked, source });
  if (checked) {
    return {
      tag,
      latest: {
        latest: checked.latest,
        source: { name: 'version-checker', url: registryPage(image)?.url },
      },
      newer: !checked.isLatest && checked.latest !== tag,
      line: found.line,
    };
  }
  return {
    tag,
    latest: found.latest,
    newer: !!found.latest && !!tag && isNewer(tag, found.latest.latest),
    line: found.line,
  };
}

/**
 * The versions of images, by imageVersionMapKey, as they are found; images without a known
 * version are left out. Empty when the setting is off.
 */
export function useImageVersions(images: ImageInCluster[]): Map<string, ImageVersion> {
  const { enabled } = useImageVersionSettings();
  // the images to look up, with the source their labels name
  const wanted = useMemo(
    () =>
      [...new Set(images.map(image => `${imageVersionMapKey(image)}\t${image.source ?? ''}`))]
        .sort()
        .join('\n'),
    [images]
  );
  const [versions, setVersions] = useState(noVersions);

  useEffect(() => {
    if (!enabled || !wanted) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const found = new Map<string, ImageVersion>();
    const flush = () => {
      timer = undefined;
      if (active) setVersions(new Map(found));
    };
    Promise.all(
      wanted.split('\n').map(async line => {
        const [key, source] = line.split('\t');
        const [cluster, ...rest] = key.split('|');
        const image = rest.join('|');
        const version = await findVersion({ cluster, image, source: source || undefined }).catch(
          () => null
        );
        if (!version?.latest && !version?.line) return;
        found.set(key, version);
        // a list of images redraws a few times a second at most
        if (!timer) timer = setTimeout(flush, 250);
      })
    ).then(() => {
      if (timer) clearTimeout(timer);
      flush();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, wanted]);

  return enabled ? versions : noVersions;
}

export function useImageVersion(
  image?: string,
  cluster?: string,
  // the source repository the labels of the image name
  source?: string
): ImageVersion | undefined {
  const images = useMemo(
    () => (image ? [{ image, cluster: cluster ?? '', source }] : []),
    [image, cluster, source]
  );
  const versions = useImageVersions(images);
  return image ? versions.get(imageVersionMapKey({ image, cluster: cluster ?? '' })) : undefined;
}

function latestExplanation(version: ImageVersion, { latest, source }: LatestVersion) {
  const line = version.line;
  const lineNote =
    line?.latest && line.latest !== latest ? ` The newest of ${line.name} is ${line.latest}.` : '';
  return version.newer
    ? `${source.name} has ${latest}, which is newer than ${version.tag}.${lineNote}`
    : `${version.tag} is up to date: the newest version at ${source.name} is ${latest}.`;
}

/** The newest version of an image, marked when it is newer than the image. */
export function LatestVersionLabel(
  props: Readonly<{ version?: ImageVersion; detailed?: boolean }>
) {
  const { version, detailed } = props;
  if (!version?.latest) return null;
  const { latest, source } = version.latest;
  const explanation = latestExplanation(version, version.latest);
  const label = (
    <Stack direction="row" spacing={0.5} alignItems="center" component="span">
      <Box
        component="span"
        role="img"
        aria-label={version.newer ? 'Newer version available' : 'Up to date'}
        sx={{ display: 'inline-flex', color: version.newer ? 'warning.main' : 'success.main' }}
      >
        <Icon
          icon={version.newer ? 'mdi:arrow-up-bold-circle' : 'mdi:check-circle'}
          width={18}
          aria-hidden
        />
      </Box>
      {source.url ? (
        <Link href={source.url} target="_blank" rel="noopener noreferrer">
          {latest}
        </Link>
      ) : (
        <span>{latest}</span>
      )}
    </Stack>
  );
  if (!detailed) return <Tooltip title={explanation}>{label}</Tooltip>;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      {label}
      <Typography variant="body2" color="text.secondary" component="span">
        {explanation}
      </Typography>
    </Stack>
  );
}

const soonDays = 90;

function endOfLifeState(line: ReleaseLine, now: Date) {
  if (line.eol) return 'ended';
  if (!line.eolFrom) return 'supported';
  const days = (new Date(line.eolFrom).getTime() - now.getTime()) / (24 * 3600 * 1000);
  return days <= soonDays ? 'soon' : 'supported';
}

function endOfLifeExplanation(line: ReleaseLine) {
  const name = `${line.product} ${line.name}`;
  if (line.eol) {
    return `${name} reached its end of life${
      line.eolFrom ? ` on ${line.eolFrom}` : ''
    } and gets no more fixes.`;
  }
  return line.eolFrom
    ? `${name} is supported until ${line.eolFrom}.`
    : `${name} has no announced end of life.`;
}

/** When the release line of an image ends, marked when it has or does so within 90 days. */
export function EndOfLifeLabel(
  props: Readonly<{ line?: ReleaseLine; detailed?: boolean; now?: Date }>
) {
  const { line, detailed, now = new Date() } = props;
  if (!line) return null;
  const state = endOfLifeState(line, now);
  const text =
    state === 'ended' ? `Ended ${line.eolFrom ?? ''}`.trim() : line.eolFrom ?? 'No date announced';
  const explanation = endOfLifeExplanation(line);
  const label = (
    <Stack direction="row" spacing={0.5} alignItems="center" component="span">
      {state !== 'supported' && (
        <Box
          component="span"
          role="img"
          aria-label={state === 'ended' ? 'End of life' : 'End of life soon'}
          sx={{ display: 'inline-flex', color: state === 'ended' ? 'error.main' : 'warning.main' }}
        >
          <Icon
            icon={state === 'ended' ? 'mdi:alert-circle' : 'mdi:clock-alert-outline'}
            width={18}
            aria-hidden
          />
        </Box>
      )}
      <Link href={line.url} target="_blank" rel="noopener noreferrer">
        {text}
      </Link>
    </Stack>
  );
  if (!detailed) return <Tooltip title={explanation}>{label}</Tooltip>;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      {label}
      <Typography variant="body2" color="text.secondary" component="span">
        {explanation}
      </Typography>
    </Stack>
  );
}

/** Rows of the details of an image for a NameValueTable, for what is known. */
export function imageVersionRows(
  version: ImageVersion | undefined,
  settings: { endOfLife: boolean }
) {
  return [
    ...(version?.latest
      ? [{ name: 'Latest version', value: <LatestVersionLabel version={version} detailed /> }]
      : []),
    ...(settings.endOfLife && version?.line
      ? [{ name: 'End of life', value: <EndOfLifeLabel line={version.line} detailed /> }]
      : []),
  ];
}

/** The rank of an image for sorting by its newest version: newer versions first. */
export function latestRank(version?: ImageVersion) {
  if (!version?.latest) return 0;
  return version.newer ? 2 : 1;
}
