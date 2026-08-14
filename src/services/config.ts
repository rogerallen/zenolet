export interface CuratorConfig {
  name: string;
  avatar?: string;
  bio?: string;
  link?: string;
}

export interface CustomBook {
  id: string;
  title: string;
  author: string;
  category?: string;
  cover?: string;
  htmlUrl: string;
}

export interface ZenoletConfig {
  siteTitle?: string;
  curator?: CuratorConfig;
  defaultTheme?: 'paper' | 'sepia' | 'charcoal' | 'night';
  fontSize?: number;
  layoutColumns?: 'auto' | '1' | '2';
  proxyUrl?: string;
  customBooks?: CustomBook[];
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
