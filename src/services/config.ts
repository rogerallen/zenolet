export interface CuratorConfig {
  name: string;
  linkUrl?: string;
}

export interface ReaderSettingsConfig {
  defaultTheme?: 'paper' | 'sepia' | 'charcoal' | 'night';
  fontSize?: number;
  layoutColumns?: 'auto' | '1' | '2';
}

export interface ZenoletConfig {
  title?: string;
  blurb?: string;
  siteTitle?: string;
  repoUrl?: string;
  curator?: CuratorConfig;
  settings?: ReaderSettingsConfig;
  proxyUrl?: string;
}

export async function loadZenoletConfig(): Promise<ZenoletConfig> {
  let cfg: ZenoletConfig = {};
  try {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const res = await fetch(`${base}zenolet.config.json`);
    if (res.ok) {
      cfg = await res.json();
    }
  } catch (err) {
    console.warn('[Zenolet] Could not load zenolet.config.json, using defaults:', err);
  }

  // Allow VITE_PROXY_URL env variable to override proxyUrl (useful for single-command local testing)
  if (import.meta.env.VITE_PROXY_URL) {
    cfg.proxyUrl = import.meta.env.VITE_PROXY_URL;
  }

  return cfg;
}
