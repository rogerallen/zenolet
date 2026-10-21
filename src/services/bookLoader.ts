// --- Book Loader Service for Zenolet ---
import { getGutenbergCandidateUrls, fetchArrayBufferWithProxy } from './corsProxy.js';
import { parseEpubArchive, type EpubChapter, type ParsedChapter } from './epub.js';
import { getStoredBookOffline, saveBookOffline, getStoredSlots, saveSlots } from './storage.js';
import type { BaseBook, BookMetadata } from '../types.js';

export interface BookLoadResult {
  content: string;
  chapters: ParsedChapter[];
  tocChapters: EpubChapter[];
  coverUrl?: string;
  fromCache: boolean;
}

/**
 * Loads a book archive either from offline Cache API or by downloading
 * candidate EPUB URLs through the Cloudflare CORS proxy, parsing, and persisting.
 */
export async function loadBookPipeline(
  book: BaseBook,
  proxyUrl?: string,
  targetSlotIndex?: number | null,
  onProgress?: (status: string) => void
): Promise<BookLoadResult> {
  // 1. Check if already stored offline in Cache API
  const offlineData = await getStoredBookOffline(book.id);
  if (offlineData) {
    const chapters = offlineData.chapters || [];
    const content =
      offlineData.content || chapters.map((c) => c.htmlContent).join('\n<hr class="epub-chapter-separator">\n');
    const tocChapters = offlineData.tocChapters || [];

    // Backfill byteSize on slot if not already recorded
    if (typeof targetSlotIndex === 'number') {
      const slots = getStoredSlots();
      if (slots[targetSlotIndex] && !slots[targetSlotIndex]?.byteSize) {
        slots[targetSlotIndex]!.byteSize = new Blob([content]).size;
        saveSlots(slots);
      }
    }

    return {
      content,
      chapters,
      tocChapters,
      coverUrl: book.coverUrl,
      fromCache: true
    };
  }

  // 2. Traversal of candidate EPUB URLs via CORS Proxy
  onProgress?.('Downloading book...');
  const candidateUrls = getGutenbergCandidateUrls(book.id, book.epubUrl);
  let lastErr: Error | null = null;
  let epubBuffer: ArrayBuffer | null = null;
  let parsed: ReturnType<typeof parseEpubArchive> | null = null;

  for (const candidate of candidateUrls) {
    try {
      const buffer = await fetchArrayBufferWithProxy(candidate, proxyUrl);
      if (buffer && buffer.byteLength > 100) {
        // Validate and unpack EPUB archive inside candidate loop
        // to guarantee corrupted or truncated downloads trigger candidate fallback
        parsed = parseEpubArchive(buffer);
        epubBuffer = buffer;
        break;
      }
    } catch (err) {
      console.warn(
        `[Zenolet] Candidate download/unpack failed for "${candidate}": ${err instanceof Error ? err.message : String(err)}`
      );
      lastErr = err as Error;
    }
  }

  if (!epubBuffer || !parsed) {
    throw lastErr || new Error(`Could not load EPUB for book #${book.id}`);
  }

  // 3. Extract content & metadata from parsed EPUB archive
  onProgress?.('Unpacking EPUB...');
  const content = parsed.htmlContent;
  const chapters = parsed.chapters;
  const tocChapters = parsed.tocChapters;
  const coverUrl = parsed.coverDataUrl || book.coverUrl;
  const byteSize = new Blob([content]).size;

  const metadata: BookMetadata = {
    id: book.id,
    title: book.title,
    author: book.author,
    epubUrl: book.epubUrl,
    coverUrl,
    byteSize
  };

  // 4. Save offline to Cache API and slot storage if slot index is specified
  if (targetSlotIndex !== undefined) {
    onProgress?.('Saving to shelf...');
    await saveBookOffline(metadata, { metadata, content, chapters, tocChapters }, targetSlotIndex);
  }

  return {
    content,
    chapters,
    tocChapters,
    coverUrl,
    fromCache: false
  };
}
