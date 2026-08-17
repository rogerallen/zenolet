export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  subjects: string[];
  downloads: number;
  htmlUrl?: string;
  coverUrl?: string;
}

let catalogCache: CatalogBook[] | null = null;

export async function fetchCatalog(): Promise<CatalogBook[]> {
  if (catalogCache) return catalogCache;
  try {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const res = await fetch(`${base}catalog.json`);
    if (!res.ok) throw new Error(`Catalog status: ${res.status}`);
    catalogCache = await res.json();
    return catalogCache || [];
  } catch (err) {
    console.error('[Zenolet Catalog] Failed to fetch catalog.json:', err);
    return [];
  }
}

export function filterCatalog(books: CatalogBook[], query: string, subjectFilter?: string): CatalogBook[] {
  let filtered = books;
  const q = query.trim().toLowerCase();

  if (q) {
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.subjects.some((s) => s.toLowerCase().includes(q))
    );
  }

  if (subjectFilter && subjectFilter !== 'all') {
    const sf = subjectFilter.toLowerCase();
    filtered = filtered.filter((b) => b.subjects.some((s) => s.toLowerCase().includes(sf)));
  }

  return filtered;
}

export function extractPopularGenres(books: CatalogBook[]): string[] {
  const genreCounts: Record<string, number> = {};
  for (const book of books) {
    for (const subject of book.subjects) {
      // Clean up subject title
      const clean = subject.split('--')[0].trim();
      if (clean && clean.length < 30) {
        genreCounts[clean] = (genreCounts[clean] || 0) + 1;
      }
    }
  }

  return Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre]) => genre);
}
