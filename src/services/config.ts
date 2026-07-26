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
  try {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const res = await fetch(`${base}zenolet.config.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.warn('[Zenolet] Could not load zenolet.config.json, using defaults:', err);
    return {};
  }
}
