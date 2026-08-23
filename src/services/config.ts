export interface CuratorConfig {
  name: string;
  linkUrl?: string;
}

export interface ReaderSettingsConfig {
  defaultTheme?: 'paper' | 'sepia' | 'charcoal' | 'night';
  fontSize?: number;
  layoutColumns?: 'auto' | '1' | '2';
}

export interface WorkerConfig {
  proxyUrl?: string;
  allowedOrigins?: string[];
}

export interface ZenoletConfig {
  title?: string;
  blurb?: string;
  siteTitle?: string;
  repoUrl?: string;
  curator?: CuratorConfig;
  settings?: ReaderSettingsConfig;
  proxyUrl?: string;
  worker?: WorkerConfig;
}

export async function loadZenoletConfig(): Promise<ZenoletConfig> {
  let cfg: ZenoletConfig = {};
  try {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    let res = await fetch(`${base}curator/config.json`);
    if (!res.ok) {
      res = await fetch(`${base}zenolet.config.json`);
    }
    if (res.ok) {
      cfg = await res.json();
    }
  } catch (err) {
    console.warn('[Zenolet] Could not load curator/config.json, using defaults:', err);
  }

  // Support worker.proxyUrl with fallback to root proxyUrl
  if (cfg.worker?.proxyUrl) {
    cfg.proxyUrl = cfg.worker.proxyUrl;
  }

  // Allow VITE_PROXY_URL env variable to override proxyUrl (useful for single-command local testing)
  if (import.meta.env.VITE_PROXY_URL) {
    cfg.proxyUrl = import.meta.env.VITE_PROXY_URL;
    if (cfg.worker) {
      cfg.worker.proxyUrl = import.meta.env.VITE_PROXY_URL;
    }
  }

  return cfg;
}
