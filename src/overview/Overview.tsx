/*
  Landing page with a summary of compliance, vulnerabilities, runtime alerts and exceptions.
*/
import {
  DateLabel,
  Link as HeadlampLink,
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { CompactTable } from '../common/CompactTable';
import { getAlertmanagerUrl, KubescapeConfig, kubescapeConfigStore } from '../common/config-store';
import { KubescapeSettings, setItemInSessionStorage } from '../common/sessionStorage';
import { SetupCheck } from '../common/SetupCheck';
import { SeverityCountStack } from '../common/SeverityCountBox';
import { readConfigurationScans } from '../compliance/Compliance';
import { countFailedScans } from '../compliance/workload-scanning';
import { fetchSecurityExceptions } from '../exceptions/apply-security-exceptions';
import { RoutingName, useHLSelectedClusters } from '../index';
import { defaultFrameworkNames, useRegoData } from '../rego';
import { alertNamespace, alertWorkload } from '../runtimedetection/alertFields';
import { AlertmanagerAlert, fetchKubescapeAlerts } from '../runtimedetection/alertmanager';
import { WorkloadConfigurationScanSummary } from '../softwarecomposition/WorkloadConfigurationScanSummary';
import { getImageScanKey, WorkloadScan } from '../vulnerabilities/scanData';
import { countBySeverity, getImageUpgrades, ImageUpgrade } from '../vulnerabilities/upgrades';
import { readVulnerabilityScans } from '../vulnerabilities/Vulnerabilities';
import { countCves, ExceptionExpiry, expiringExceptions, frameworkScores } from './summaries';

// Index of the Upgrades tab on the Vulnerabilities page
const upgradesTabIndex = 3;

export default function KubescapeOverview() {
  return (
    <>
      <h1>Kubescape</h1>
      <SetupCheck
        features={['compliance', 'vulnerabilities', 'networkPolicies', 'runtime', 'exceptions']}
      />
      <ComplianceSummary />
      <VulnerabilitySummary />
      <RuntimeAlertSummary />
      <ExceptionSummary />
    </>
  );
}

/**
 * Reads data with a loader that reports progress, again when the selected clusters change.
 * Reading stops when the page is left.
 */
function useScans<T>(
  read: (
    clusters: string[],
    config: KubescapeConfig,
    continueReading: React.MutableRefObject<boolean>,
    setLoading: (loading: boolean) => void,
    setProgress: React.Dispatch<React.SetStateAction<string>>
  ) => Promise<T[]>
) {
  const clusters = useHLSelectedClusters();
  const config = kubescapeConfigStore.useConfig()() as KubescapeConfig;
  const [scans, setScans] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const continueReading = useRef(true);
  const clustersKey = clusters.join(',');

  useEffect(() => {
    continueReading.current = true;
    read(clusters, config, continueReading, setLoading, setProgress)
      .then(setScans)
      .catch(error => {
        console.error(error);
        setScans([]);
      });
    return () => {
      continueReading.current = false;
    };
    // clustersKey covers clusters, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustersKey]);

  return { scans, loading: loading || scans === null, progress };
}

function Loading(props: Readonly<{ progress: string }>) {
  return (
    <Typography variant="body2" color="text.secondary">
      {props.progress || 'Reading Kubescape scans…'}
    </Typography>
  );
}

function ComplianceSummary() {
  const { scans, loading, progress } =
    useScans<WorkloadConfigurationScanSummary>(readConfigurationScans);
  const { frameworks } = useRegoData();
  const config = kubescapeConfigStore.useConfig()() as KubescapeConfig;
  const names = config?.activeFrameworks?.length ? config.activeFrameworks : defaultFrameworkNames;

  return (
    <SectionBox title="Compliance">
      {loading || !scans ? (
        <Loading progress={progress} />
      ) : (
        <NameValueTable
          rows={[
            {
              name: 'Resources scanned',
              value: (
                <HeadlampLink routeName={RoutingName.ComplianceView}>{scans.length}</HeadlampLink>
              ),
            },
            { name: 'Failed checks', value: String(countFailedScans(scans)) },
            ...(scans.length > 0
              ? frameworkScores(scans, frameworks, names).map(({ name, score }) => ({
                  name: `${name} compliance`,
                  value: `${score}%`,
                }))
              : []),
          ]}
        />
      )}
    </SectionBox>
  );
}

// The packages to upgrade in an image, the two that fix the most CVEs by name
function packagesToUpgrade(image: ImageUpgrade) {
  const named = image.packages
    .slice(0, 2)
    .map(upgrade => `${upgrade.packageName} → ${upgrade.fixVersion}`)
    .join(', ');
  const more = image.packages.length - 2;
  return more > 0 ? `${named} and ${more} more ${more === 1 ? 'package' : 'packages'}` : named;
}

function VulnerabilitySummary() {
  const { scans, loading, progress } = useScans<WorkloadScan>(readVulnerabilityScans);

  if (loading || !scans) {
    return (
      <SectionBox title="Vulnerabilities">
        <Loading progress={progress} />
      </SectionBox>
    );
  }

  const cves = countCves(scans);
  const cveRow = (severity: string) => {
    const { total, fixable } = cves[severity] ?? { total: 0, fixable: 0 };
    return { name: `${severity} CVEs`, value: `${total} (${fixable} with a fix)` };
  };
  const images = getImageUpgrades(scans).slice(0, 5);
  const clusterCount = new Set(scans.map(scan => scan.cluster)).size;

  return (
    <SectionBox title="Vulnerabilities">
      <NameValueTable
        rows={[
          {
            name: 'Workloads scanned',
            value: (
              <HeadlampLink routeName={RoutingName.KubescapeVulnerabilities}>
                {scans.length}
              </HeadlampLink>
            ),
          },
          cveRow('Critical'),
          cveRow('High'),
        ]}
      />
      {images.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Images whose upgrades fix the most CVEs
          </Typography>
          <CompactTable
            rows={images}
            rowKey={image => getImageScanKey(image.imageScan)}
            columns={[
              {
                header: 'Image',
                cell: image => (
                  <HeadlampLink
                    routeName={RoutingName.ImageVulnerabilityDetails}
                    activeCluster={image.imageScan.cluster}
                    params={{
                      namespace: image.imageScan.namespace,
                      name: image.imageScan.manifestName,
                    }}
                  >
                    {image.imageScan.imageName}
                  </HeadlampLink>
                ),
              },
              ...(clusterCount > 1
                ? [{ header: 'Cluster', cell: (image: ImageUpgrade) => image.imageScan.cluster }]
                : []),
              { header: 'Upgrade', cell: packagesToUpgrade },
              {
                header: 'Fixes',
                cell: image => (
                  <SeverityCountStack count={severity => countBySeverity(image, severity)} />
                ),
              },
            ]}
          />
          <Box sx={{ mt: 1 }}>
            <HeadlampLink
              routeName={RoutingName.KubescapeVulnerabilities}
              onClick={() =>
                setItemInSessionStorage(KubescapeSettings.VulnerabilityTab, upgradesTabIndex)
              }
            >
              All upgrades
            </HeadlampLink>
          </Box>
        </>
      )}
    </SectionBox>
  );
}

function RuntimeAlertSummary() {
  const clusters = useHLSelectedClusters();
  const clustersKey = clusters.join(',');
  kubescapeConfigStore.useConfig()();
  const configured = !!getAlertmanagerUrl();
  const [alerts, setAlerts] = useState<AlertmanagerAlert[] | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    Promise.allSettled(clusters.map(cluster => fetchKubescapeAlerts(cluster))).then(results => {
      if (!active) return;
      setAlerts(
        results
          .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      );
    });
    return () => {
      active = false;
    };
    // clustersKey covers clusters, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, clustersKey]);

  return (
    <SectionBox title="Runtime alerts">
      {!configured ? (
        <Typography variant="body2">
          Alertmanager is not configured. Set it up on the{' '}
          <HeadlampLink routeName={RoutingName.ApplicationProfiles}>Runtime Detection</HeadlampLink>{' '}
          page.
        </Typography>
      ) : alerts === null ? (
        <Typography variant="body2" color="text.secondary">
          Reading alerts…
        </Typography>
      ) : alerts.length === 0 ? (
        <Typography variant="body2">No active runtime alerts.</Typography>
      ) : (
        <>
          <CompactTable
            rows={alerts.slice(0, 5)}
            rowKey={(alert, index) => `${alert.cluster}/${alert.fingerprint}/${index}`}
            columns={[
              { header: 'Time', cell: alert => <DateLabel date={alert.startsAt} /> },
              { header: 'Rule', cell: alert => alert.labels.rule_name ?? alert.labels.alertname },
              {
                header: 'Workload',
                cell: alert =>
                  [alertNamespace(alert), alertWorkload(alert)].filter(Boolean).join('/'),
              },
              ...(clusters.length > 1
                ? [{ header: 'Cluster', cell: (alert: AlertmanagerAlert) => alert.cluster }]
                : []),
            ]}
          />
          <Box sx={{ mt: 1 }}>
            <HeadlampLink routeName={RoutingName.ApplicationProfiles}>
              All {alerts.length} alerts
            </HeadlampLink>
          </Box>
        </>
      )}
    </SectionBox>
  );
}

function ExceptionSummary() {
  const clusters = useHLSelectedClusters();
  const clustersKey = clusters.join(',');
  const [expiring, setExpiring] = useState<ExceptionExpiry[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(
      clusters.map(cluster =>
        fetchSecurityExceptions(cluster).then(exceptions => expiringExceptions(exceptions, cluster))
      )
    )
      .then(results => {
        if (active) setExpiring(results.flat());
      })
      .catch(() => {
        if (active) setExpiring([]);
      });
    return () => {
      active = false;
    };
    // clustersKey covers clusters, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustersKey]);

  return (
    <SectionBox title="Expiring exceptions">
      {expiring === null ? (
        <Typography variant="body2" color="text.secondary">
          Reading exceptions…
        </Typography>
      ) : expiring.length === 0 ? (
        <Typography variant="body2">
          No exceptions have expired or expire in the next 14 days.
        </Typography>
      ) : (
        <CompactTable
          rows={expiring}
          rowKey={exception => `${exception.cluster}/${exception.namespace}/${exception.name}`}
          columns={[
            {
              header: 'Exception',
              cell: exception =>
                exception.namespace ? (
                  <HeadlampLink
                    routeName={RoutingName.SecurityExceptionDetail}
                    activeCluster={exception.cluster}
                    params={{ namespace: exception.namespace, name: exception.name }}
                  >
                    {exception.name}
                  </HeadlampLink>
                ) : (
                  <HeadlampLink
                    routeName={RoutingName.SecurityExceptionClusterDetail}
                    activeCluster={exception.cluster}
                    params={{ name: exception.name }}
                  >
                    {exception.name}
                  </HeadlampLink>
                ),
            },
            { header: 'Scope', cell: exception => exception.namespace ?? 'Cluster' },
            { header: 'Expires', cell: exception => <DateLabel date={exception.expiresAt} /> },
            {
              header: 'Status',
              cell: exception =>
                exception.expired ? 'Expired, no longer applied' : 'Expires soon',
            },
            ...(clusters.length > 1
              ? [{ header: 'Cluster', cell: (e: ExceptionExpiry) => e.cluster }]
              : []),
          ]}
        />
      )}
    </SectionBox>
  );
}
