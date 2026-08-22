export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  subjects: string[];
  downloads: number;
  epubUrl?: string;
  coverUrl?: string;
}

let catalogCache: CatalogBook[] | null = null;

export async function fetchCatalog(): Promise<CatalogBook[]> {
  if (catalogCache) return catalogCache;
  try {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    let res = await fetch(`${base}curator/catalog.json`);
    if (!res.ok) {
      res = await fetch(`${base}catalog.json`);
    }
    if (!res.ok) throw new Error(`Catalog status: ${res.status}`);
    catalogCache = await res.json();
    return catalogCache || [];
  } catch (err) {
    console.error('[Zenolet Catalog] Failed to fetch curator/catalog.json:', err);
    return [];
  }
}
