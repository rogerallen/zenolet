import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCurateCli } from './curate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  subjects: string[];
  downloads: number;
  epubUrl?: string;
  coverUrl?: string;
  languages?: string[];
}

interface GutendexAuthor {
  name: string;
}

interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  subjects: string[];
  download_count: number;
  formats: Record<string, string>;
  media_type?: string;
  languages?: string[];
}

interface GutendexResponse {
  count: number;
  next: string | null;
  results: GutendexBook[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Zenolet-Catalog-Generator/1.0' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function generateCatalog() {
  console.log('📚 [Zenolet] Starting catalog generator for top 1,000 Project Gutenberg titles...');
  const catalog: CatalogBook[] = [];
  let nextUrl: string | null = 'https://gutendex.com/books/?languages=en&sort=popular';
  let page = 1;
  const targetCount = 1000;

  while (nextUrl && catalog.length < targetCount) {
    console.log(`fetching page ${page} (${catalog.length}/${targetCount} books collected)...`);
    try {
      const data: GutendexResponse = await fetchJson<GutendexResponse>(nextUrl);

      for (const item of data.results) {
        if (catalog.length >= targetCount) break;

        const authorName = item.authors.length > 0 ? item.authors.map((a) => a.name).join(', ') : 'Unknown Author';

        // Extract best EPUB format
        const epubUrl = item.formats['application/epub+zip'];
        const coverUrl = item.formats['image/jpeg'];

        // Only include textual books with a verified EPUB archive available in English
        if (item.media_type && item.media_type !== 'Text') continue;
        if (!epubUrl) continue;
        if (item.languages && item.languages.length > 0 && !item.languages.includes('en')) continue;

        catalog.push({
          id: String(item.id),
          title: item.title,
          author: authorName,
          subjects: (item.subjects || []).slice(0, 5),
          downloads: item.download_count || 0,
          epubUrl,
          coverUrl,
          languages: item.languages || ['en']
        });
      }

      nextUrl = data.next;
      page++;
      // Brief pause to respect API limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error on page ${page}:`, err);
      break;
    }
  }

  const rawPath = path.resolve(__dirname, '../catalog.raw.json');
  await fs.mkdir(path.dirname(rawPath), { recursive: true });
  await fs.writeFile(rawPath, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`✅ [Zenolet] Successfully fetched raw catalog with ${catalog.length} books at: ${rawPath}`);
  console.log(`🧹 [Zenolet] Triggering curation post-processing...`);
  runCurateCli();
}

generateCatalog().catch((err) => {
  console.error('Fatal error generating catalog:', err);
  process.exit(1);
});
