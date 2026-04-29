let cachedUrl: Promise<string> | null = null;

export function getKubescapePluginUrl(): Promise<string> {
  cachedUrl ??= fetchPluginUrl();
  return cachedUrl;
}

async function fetchPluginUrl(): Promise<string> {
  let port: number | null = null;
  if (isElectron()) {
    port = (window as any)?.headlampBackendPort ?? 4466;
  } else if (isDockerDesktop()) {
    port = 64446;
  }
  const origin = port ? `http://localhost:${port}` : '';

  try {
    const response = await fetch(`${origin}/plugins`);
    if (response.ok) {
      const plugins: Array<{ path: string; name: string }> = await response.json();
      const entry = plugins.find(p => p.name.includes('kubescape'));
      if (entry) {
        return `${origin}/${entry.path.replaceAll('\\', '/')}`;
      }
    }
  } catch {
    // fall through to defaults
  }

  return port
    ? `http://localhost:${port}/user-plugins/headlamp_kubescape`
    : '/plugins/kubescape-plugin';
}

/**
 * Determines whether app is running in electron environment.
 * Note: The isElectron code (Licence: MIT) is taken from
 *   https://github.com/cheton/is-electron/blob/master/index.js
 */
function isElectron(): boolean {
  // Renderer process
  if (
    typeof window !== 'undefined' &&
    typeof window.process === 'object' &&
    (window.process as any).type === 'renderer'
  ) {
    return true;
  }

  // Main process
  if (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    !!(process.versions as any).electron
  ) {
    return true;
  }

  // Detect the user agent when the `nodeIntegration` option is set to true
  if (
    typeof navigator === 'object' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.indexOf('Electron') >= 0
  ) {
    return true;
  }

  return false;
}

function isDockerDesktop(): boolean {
  return (window as any)?.ddClient !== undefined;
}
