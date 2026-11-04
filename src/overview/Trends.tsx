/*
  Failed controls and CVEs over time, from the Kubescape Prometheus exporter.
*/
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getPrometheusUrl, kubescapeConfigStore } from '../common/config-store';
import { useHLSelectedClusters } from '../index';
import { dailyRows, detectPrometheus, fetchTrends, TrendKey, TrendRow } from './prometheus';

const ranges = [7, 30, 90];

// Categorical slots 1 and 2 of the chart palette, stepped for the light and dark surface
const seriesColors = {
  light: ['#2a78d6', '#eb6834'],
  dark: ['#3987e5', '#d95926'],
};

interface Series {
  key: TrendKey;
  label: string;
  color: string;
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact' });

function formatDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(time: number) {
  return new Date(time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function lastValue(rows: TrendRow[], key: TrendKey): { index: number; value: number } | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const value = rows[index][key];
    if (value !== undefined) return { index, value };
  }
  return null;
}

export function TrendsSection() {
  const clusters = useHLSelectedClusters();
  // re-render when the Prometheus address is configured
  kubescapeConfigStore.useConfig()();
  const prometheusUrl = getPrometheusUrl();
  const [chosenCluster, setChosenCluster] = useState(clusters[0]);
  const cluster = clusters.includes(chosenCluster) ? chosenCluster : clusters[0];
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<TrendRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!prometheusUrl || !cluster) return;
    let active = true;
    setLoading(true);
    setError('');
    fetchTrends(cluster, days)
      .then(found => {
        if (active) setRows(found);
      })
      .catch(err => {
        if (!active) return;
        setRows(null);
        setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [prometheusUrl, cluster, days]);

  if (!prometheusUrl) {
    return (
      <SectionBox title="Trends">
        <PrometheusSuggestion cluster={cluster} />
      </SectionBox>
    );
  }

  return (
    <SectionBox title="Trends">
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, value) => value && setDays(value)}
          aria-label="Time range"
        >
          {ranges.map(range => (
            <ToggleButton key={range} value={range}>
              Last {range} days
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {clusters.length > 1 && (
          <TextField
            select
            size="small"
            label="Cluster"
            value={cluster}
            onChange={event => setChosenCluster(event.target.value)}
          >
            {clusters.map(name => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        )}
        {rows && rows.length > 0 && (
          <Button size="small" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Hide table' : 'Show table'}
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error">Unable to read the trends from Prometheus: {error}</Alert>}
      {!error && rows === null && (
        <Typography variant="body2" color="text.secondary">
          Reading the trends…
        </Typography>
      )}
      {!error && rows?.length === 0 && <NoMetrics cluster={cluster} />}
      {!error && rows && rows.length > 0 && (
        // while new data loads, the previous charts stay, dimmed
        <Box sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <TrendCharts rows={rows} />
          {showTable && <TrendTable rows={rows} />}
        </Box>
      )}
    </SectionBox>
  );
}

function TrendCharts(props: Readonly<{ rows: TrendRow[] }>) {
  const { rows } = props;
  const theme = useTheme();
  const [critical, high] = seriesColors[theme.palette.mode === 'dark' ? 'dark' : 'light'];

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} lg={6}>
        <TrendChart
          title="Failed controls"
          rows={rows}
          series={[
            { key: 'controlsCritical', label: 'Critical', color: critical },
            { key: 'controlsHigh', label: 'High', color: high },
          ]}
        />
      </Grid>
      <Grid item xs={12} lg={6}>
        <TrendChart
          title="CVEs"
          rows={rows}
          series={[
            { key: 'cvesCritical', label: 'Critical', color: critical },
            { key: 'cvesHigh', label: 'High', color: high },
          ]}
        />
      </Grid>
    </Grid>
  );
}

function LineKey(props: Readonly<{ color: string }>) {
  return (
    <Box sx={{ width: 12, height: 2, borderRadius: 1, bgcolor: props.color, flexShrink: 0 }} />
  );
}

function TrendChart(props: Readonly<{ title: string; rows: TrendRow[]; series: Series[] }>) {
  const { title, rows, series } = props;
  const theme = useTheme();
  const muted = theme.palette.text.secondary;
  const surface = theme.palette.background.paper;

  const lasts = series.map(s => lastValue(rows, s.key));
  const max = Math.max(1, ...rows.flatMap(row => series.map(s => row[s.key] ?? 0)));
  // end labels that would touch each other are left to the legend
  const values = lasts.filter(last => last !== null).map(last => last!.value);
  const endLabels = values.every(
    (value, index) => index === 0 || Math.abs(value - values[index - 1]) > max * 0.08
  );

  return (
    <Box>
      <Typography variant="subtitle1" component="h3">
        {title}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        {series.map((s, index) => (
          <Stack key={s.key} direction="row" spacing={0.75} alignItems="center">
            <LineKey color={s.color} />
            <Typography variant="body2" color="text.secondary">
              {s.label}
            </Typography>
            {lasts[index] && (
              <Typography variant="body2" fontWeight="bold">
                {lasts[index]!.value.toLocaleString()}
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 8, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={theme.palette.divider} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDate}
            stroke={theme.palette.divider}
            tick={{ fill: muted, fontSize: 12 }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, 'auto']}
            tickFormatter={value => compact.format(value)}
            width={44}
            axisLine={false}
            tickLine={false}
            tick={{ fill: muted, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: muted, strokeWidth: 1 }}
            content={({ active, payload, label }: any) =>
              active && payload?.length ? (
                <TrendTooltip time={label} series={series} row={payload[0].payload} />
              ) : null
            }
          />
          {series.map((s, index) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: surface, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
              label={(labelProps: any): ReactElement =>
                endLabels && labelProps.index === lasts[index]?.index ? (
                  <text
                    x={labelProps.x + 8}
                    y={labelProps.y}
                    dy={4}
                    fill={muted}
                    fontSize={12}
                    key={`${s.key}-end`}
                  >
                    {compact.format(labelProps.value)}
                  </text>
                ) : (
                  <g key={`${s.key}-${labelProps.index}`} />
                )
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

function TrendTooltip(props: Readonly<{ time: number; series: Series[]; row: TrendRow }>) {
  const { time, series, row } = props;
  return (
    <Paper elevation={3} sx={{ px: 1.5, py: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {formatTime(time)}
      </Typography>
      {series.map(s => (
        <Stack key={s.key} direction="row" spacing={0.75} alignItems="center">
          <LineKey color={s.color} />
          <Typography variant="body2" fontWeight="bold">
            {row[s.key]?.toLocaleString() ?? '–'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {s.label}
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
}

function TrendTable(props: Readonly<{ rows: TrendRow[] }>) {
  const columns: Array<[TrendKey, string]> = [
    ['controlsCritical', 'Critical failed controls'],
    ['controlsHigh', 'High failed controls'],
    ['cvesCritical', 'Critical CVEs'],
    ['cvesHigh', 'High CVEs'],
  ];
  return (
    <Table size="small" sx={{ mt: 2, fontVariantNumeric: 'tabular-nums' }}>
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          {columns.map(([key, label]) => (
            <TableCell key={key} align="right">
              {label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {dailyRows(props.rows)
          .reverse()
          .map(row => (
            <TableRow key={row.time}>
              <TableCell>{new Date(row.time).toLocaleDateString()}</TableCell>
              {columns.map(([key]) => (
                <TableCell key={key} align="right">
                  {row[key]?.toLocaleString() ?? '–'}
                </TableCell>
              ))}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}

function NoMetrics(props: Readonly<{ cluster: string }>) {
  return (
    <Alert severity="info">
      Prometheus has no Kubescape metrics for cluster {props.cluster}. Enable the Prometheus
      exporter of the Kubescape operator, with a ServiceMonitor when Prometheus is run by the
      Prometheus operator:
      <Box component="pre" sx={{ whiteSpace: 'pre-wrap', mt: 1, mb: 0 }}>
        helm upgrade kubescape kubescape/kubescape-operator -n kubescape --reuse-values --set
        capabilities.prometheusExporter=enable --set prometheusExporter.serviceMonitor.enabled=true
      </Box>
      The trends start when Prometheus has scraped the exporter.
    </Alert>
  );
}

// Offers to use the Prometheus found in the cluster while none is configured
function PrometheusSuggestion(props: Readonly<{ cluster: string }>) {
  const { cluster } = props;
  const [addresses, setAddresses] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    detectPrometheus(cluster)
      .catch(() => [])
      .then(found => {
        if (active) setAddresses(found);
      });
    return () => {
      active = false;
    };
  }, [cluster]);

  return (
    <Alert severity="info">
      Trends of failed controls and CVEs come from the Kubescape Prometheus exporter. Set the
      address of Prometheus in the Kubescape plugin settings.
      {addresses && addresses.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap">
          <span>Found in cluster {cluster}:</span>
          {addresses.map(address => (
            <Chip
              key={address}
              label={`Use ${address}`}
              size="small"
              onClick={() => kubescapeConfigStore.update({ prometheusUrl: address })}
            />
          ))}
        </Stack>
      )}
    </Alert>
  );
}
