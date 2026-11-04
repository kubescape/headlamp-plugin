/*
  Explains what is missing in the Kubescape installation for the features of a page.
*/
import { Alert, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useHLSelectedClusters } from '../index';
import { Feature, readClusterSetup, SetupIssue, setupIssues } from './kubescapeSetup';

type ClusterIssue = SetupIssue & { cluster: string };

export function SetupCheck(props: Readonly<{ features: Feature[] }>) {
  const { features } = props;
  const clusters = useHLSelectedClusters();
  const [issues, setIssues] = useState<ClusterIssue[]>([]);
  const key = `${features.join(',')}|${clusters.join(',')}`;

  useEffect(() => {
    let active = true;
    Promise.all(
      clusters.map(async cluster => {
        const setup = await readClusterSetup(cluster);
        // the same issue, such as a missing storage API, is reported once per cluster
        const messages = new Set<string>();
        return features
          .flatMap(feature => setupIssues(feature, setup))
          .filter(issue => !messages.has(issue.message) && messages.add(issue.message))
          .map(issue => ({ ...issue, cluster }));
      })
    ).then(results => {
      if (active) setIssues(results.flat());
    });
    return () => {
      active = false;
    };
    // key covers features and clusters, which are new arrays on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      {issues.map(issue => (
        <Alert key={`${issue.cluster}|${issue.message}`} severity={issue.severity} sx={{ mb: 1 }}>
          {clusters.length > 1 && <strong>{issue.cluster}: </strong>}
          {issue.message}
          {issue.fix && (
            <Box component="code" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
              {issue.fix}
            </Box>
          )}
        </Alert>
      ))}
    </>
  );
}
