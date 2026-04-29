import { useSnackbar } from 'notistack';
import { createContext, useContext, useEffect, useState } from 'react';
import { getKubescapePluginUrl } from '../common/PluginHelper';
import { Control } from './Control';
import { FrameWork } from './FrameWork';

type RegoData = {
  controls: Control[];
  frameworks: FrameWork[];
  fullRegolibraryFramework: FrameWork;
  loading: boolean;
};

const emptyFramework: FrameWork = {
  name: 'Full Regolibrary',
  description: 'Contains all Kubescape controls from all frameworks combined',
  controls: [],
  ControlsIDs: [],
};

const RegoDataContext = createContext<RegoData>({
  controls: [],
  frameworks: [],
  fullRegolibraryFramework: emptyFramework,
  loading: true,
});

// Module-level cache so re-mounting the provider (one per route) reuses the
// already-resolved data without re-fetching or flashing back to loading=true.
// Reset to null on failure so a subsequent mount can retry.
let cachedPromise: Promise<RegoData> | null = null;

function fetchRegoData(): Promise<RegoData> {
  if (cachedPromise) return cachedPromise;

  const fetchJson = (baseUrl: string, path: string) =>
    fetch(`${baseUrl}/${path}`).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch ${path}: HTTP ${r.status}`);
      return r.json();
    });

  cachedPromise = getKubescapePluginUrl()
    .then(baseUrl =>
      Promise.all([fetchJson(baseUrl, 'controls.json'), fetchJson(baseUrl, 'frameworks.json')])
    )
    .then(([fetchedControls, fetchedFrameworks]: [Control[], FrameWork[]]) => {
      for (const fw of fetchedFrameworks) {
        if (!fw.controls || fw.controls.length === 0) {
          const ids = new Set(fw.ControlsIDs ?? []);
          fw.controls = fetchedControls.filter(c => ids.has(c.controlID));
        }
      }

      const allIDs = new Set(fetchedFrameworks.flatMap(fw => fw.ControlsIDs ?? []));
      const fullRegolibraryFramework: FrameWork = {
        name: 'Full Regolibrary',
        description: 'Contains all Kubescape controls from all frameworks combined',
        controls: fetchedControls.filter(c => allIDs.has(c.controlID)),
        ControlsIDs: [...allIDs],
      };

      return {
        controls: fetchedControls,
        frameworks: fetchedFrameworks,
        fullRegolibraryFramework,
        loading: false,
      };
    })
    .catch(error => {
      cachedPromise = null;
      return Promise.reject(error);
    });

  return cachedPromise;
}

export function RegoDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<RegoData>({
    controls: [],
    frameworks: [],
    fullRegolibraryFramework: emptyFramework,
    loading: true,
  });
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchRegoData()
      .then(setData)
      .catch(error => {
        console.error('Error fetching rego data:', error);
        enqueueSnackbar(`Error loading Kubescape control data: ${error.message}`, {
          variant: 'error',
        });
        setData(d => ({ ...d, loading: false }));
      });
  }, [enqueueSnackbar]);

  return <RegoDataContext.Provider value={data}>{children}</RegoDataContext.Provider>;
}

export function useRegoData(): RegoData {
  return useContext(RegoDataContext);
}
