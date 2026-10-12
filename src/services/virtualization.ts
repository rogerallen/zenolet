// --- Chapter Virtualization & Progress Normalization Service for Zenolet ---
import type { ParsedChapter } from './epub.js';

export interface ChapterWeights {
  baseFractions: number[];
  spanFractions: number[];
}

/**
 * Strips inlined base64 data URLs from HTML strings when calculating character weights and text offsets,
 * preventing huge images from distorting reading progress and timeline dot distribution.
 */
export function getNormalizedHtmlContent(html: string): string {
  if (!html || !html.includes('data:')) return html || '';
  return html.replace(/data:image\/[^"'\s]+/gi, '');
}

/**
 * Computes character-weighted base fractions and span fractions for discrete chapters.
 * Ensures smooth, continuous progress across omnibus books regardless of chapter lengths.
 */
export function computeChapterWeights(chapters: ParsedChapter[]): ChapterWeights {
  if (!chapters || chapters.length === 0) {
    return { baseFractions: [0], spanFractions: [1] };
  }

  // Weight each chapter by its normalized HTML character count (minimum 100 to avoid div-by-zero)
  const weights = chapters.map((c) => Math.max(100, getNormalizedHtmlContent(c.htmlContent || '').length));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const baseFractions: number[] = [];
  const spanFractions: number[] = [];
  let accum = 0;

  for (let i = 0; i < chapters.length; i++) {
    baseFractions.push(accum / totalWeight);
    const span = weights[i] / totalWeight;
    spanFractions.push(span);
    accum += weights[i];
  }

  return { baseFractions, spanFractions };
}

export interface TocChapterMarker {
  title: string;
  anchorId: string;
  spineIndex: number;
  globalFraction: number;
  targetSpread?: number;
}

/**
 * Calculates global progress fractions (0.0 to 1.0) for structured TOC chapters,
 * by combining the parent spine chapter weights with the relative character offset of each anchor inside that spine chapter.
 */
export function computeTocMarkers(
  tocChapters: Array<{ title: string; anchorId: string; spineIndex?: number }>,
  parsedChapters: ParsedChapter[],
  chapterWeights: ChapterWeights
): TocChapterMarker[] {
  if (!tocChapters || tocChapters.length === 0) return [];

  const markers: TocChapterMarker[] = [];
  const spineAnchorOffsets = new Map<string, number>();
  const spineNormalizedLengths: number[] = [];

  // Pre-index anchor offsets inside parsed chapter HTML strings (using normalized text length)
  parsedChapters.forEach((ch, sIdx) => {
    const rawHtml = ch.htmlContent || '';
    const cleanHtml = getNormalizedHtmlContent(rawHtml);
    spineNormalizedLengths[sIdx] = Math.max(1, cleanHtml.length);

    // Look for id or name attributes
    const matches = cleanHtml.matchAll(/(?:id|name)=["']([^"']+)["']/g);
    for (const m of matches) {
      const id = m[1];
      const key = `${sIdx}_${id}`;
      if (!spineAnchorOffsets.has(key)) {
        spineAnchorOffsets.set(key, m.index || 0);
      }
    }
  });

  for (const toc of tocChapters) {
    const sIdx =
      typeof toc.spineIndex === 'number' && toc.spineIndex >= 0 && toc.spineIndex < parsedChapters.length
        ? toc.spineIndex
        : 0;

    const base = chapterWeights.baseFractions[sIdx] ?? 0;
    const span = chapterWeights.spanFractions[sIdx] ?? 0;
    const parentLength = spineNormalizedLengths[sIdx] ?? 1;

    let offsetInside = 0;
    const key = `${sIdx}_${toc.anchorId}`;
    if (toc.anchorId && spineAnchorOffsets.has(key)) {
      offsetInside = spineAnchorOffsets.get(key)!;
    } else if (toc.anchorId) {
      const raw = toc.anchorId.replace(/^c\d+_/, '');
      const rawKey = `${sIdx}_${raw}`;
      if (spineAnchorOffsets.has(rawKey)) {
        offsetInside = spineAnchorOffsets.get(rawKey)!;
      }
    }

    const intraFraction = Math.min(1, Math.max(0, offsetInside / parentLength));
    const globalFraction = Math.min(1, Math.max(0, base + intraFraction * span));

    markers.push({
      title: toc.title,
      anchorId: toc.anchorId,
      spineIndex: sIdx,
      globalFraction
    });
  }

  return markers;
}

/**
 * Calculates continuous global reading progress (0.0 to 1.0) given the active chapter index,
 * the current spread within that chapter, and the total spreads of that chapter.
 */
export function calculateGlobalProgress(
  chapterIndex: number,
  currentSpread: number,
  totalSpreads: number,
  weights: ChapterWeights
): number {
  const { baseFractions, spanFractions } = weights;
  if (!baseFractions || baseFractions.length === 0) return 0;

  const safeIndex = Math.min(baseFractions.length - 1, Math.max(0, chapterIndex));
  const base = baseFractions[safeIndex];
  const span = spanFractions[safeIndex] || 0;

  const chapterFraction = totalSpreads > 1 ? currentSpread / (totalSpreads - 1) : 0;
  const global = base + chapterFraction * span;

  return Math.min(1, Math.max(0, global));
}

/**
 * Maps a global reading progress fraction (0.0 to 1.0) to its corresponding chapter index
 * and the intra-chapter fractional progress.
 */
export function findChapterForGlobalProgress(
  globalProgress: number,
  weights: ChapterWeights
): { chapterIndex: number; chapterFraction: number } {
  const { baseFractions, spanFractions } = weights;
  const count = baseFractions ? baseFractions.length : 0;
  if (count === 0) return { chapterIndex: 0, chapterFraction: 0 };
  if (count === 1) return { chapterIndex: 0, chapterFraction: Math.min(1, Math.max(0, globalProgress)) };

  const clamped = Math.min(1, Math.max(0, isNaN(globalProgress) ? 0 : globalProgress));

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const end = isLast ? 1.000001 : baseFractions[i] + spanFractions[i];
    if (clamped <= end || isLast) {
      const span = spanFractions[i] > 0 ? spanFractions[i] : 1;
      const chapterFraction = Math.min(1, Math.max(0, (clamped - baseFractions[i]) / span));
      return { chapterIndex: i, chapterFraction };
    }
  }

  return { chapterIndex: 0, chapterFraction: 0 };
}

export interface BookPagination {
  startPage: number;
  endPage: number;
  totalPages: number;
  globalSpread: number;
  totalSpreads: number;
}

/**
 * Calculates book-wide pagination (page numbers and total pages for the whole book),
 * translating local spreads in a virtualized spine chapter into contiguous book-wide pages.
 */
export function calculateBookPagination(
  currentChapterIndex: number,
  currentChapterSpread: number,
  currentChapterTotalSpreads: number,
  parsedChapters: ParsedChapter[],
  cols: number = 1,
  measuredSpreadsCache?: Map<number, number>
): BookPagination {
  const numChapters = parsedChapters ? parsedChapters.length : 0;
  // If single-chapter or non-virtualized book
  if (numChapters <= 1) {
    const totalSpreads = Math.max(1, currentChapterTotalSpreads);
    const globalSpread = Math.min(totalSpreads - 1, Math.max(0, currentChapterSpread));
    const totalPages = totalSpreads * cols;
    const startPage = globalSpread * cols + 1;
    const endPage = Math.min(totalPages, globalSpread * cols + cols);
    return { startPage, endPage, totalPages, globalSpread, totalSpreads };
  }

  // Multi-chapter book:
  const safeChapterIndex = Math.min(numChapters - 1, Math.max(0, currentChapterIndex));

  // Update cache with currently mounted chapter
  if (measuredSpreadsCache) {
    measuredSpreadsCache.set(safeChapterIndex, currentChapterTotalSpreads);
  }

  // Find character-density (chars per spread) from measured chapters with sufficient text (>= 1000 chars)
  let measuredChars = 0;
  let measuredSpreads = 0;

  if (measuredSpreadsCache) {
    for (const [idx, spreads] of measuredSpreadsCache.entries()) {
      if (idx >= 0 && idx < numChapters && spreads > 0) {
        const textLen = getNormalizedHtmlContent(parsedChapters[idx]?.htmlContent || '').length;
        if (textLen >= 1000) {
          measuredChars += textLen;
          measuredSpreads += spreads;
        }
      }
    }
  }

  // Fallback chars-per-spread if no text chapter measured yet (default ~1500 chars per spread)
  const defaultCharsPerSpread = Math.max(500, Math.round(1500 * (cols > 1 ? cols * 0.8 : 1)));
  const charsPerSpread = measuredSpreads > 0 ? measuredChars / measuredSpreads : defaultCharsPerSpread;

  // Compute spreads for each chapter
  const chapterSpreads: number[] = [];
  for (let i = 0; i < numChapters; i++) {
    const cached = measuredSpreadsCache?.get(i);
    if (typeof cached === 'number' && cached > 0) {
      chapterSpreads.push(cached);
    } else if (i === safeChapterIndex) {
      chapterSpreads.push(Math.max(1, currentChapterTotalSpreads));
    } else {
      const textLen = getNormalizedHtmlContent(parsedChapters[i]?.htmlContent || '').length;
      if (textLen < 500) {
        // Very small sections like covers or wrappers get 1 spread
        chapterSpreads.push(1);
      } else {
        chapterSpreads.push(Math.max(1, Math.round(textLen / charsPerSpread)));
      }
    }
  }

  // Calculate spread offset for the current chapter
  let spreadOffset = 0;
  for (let i = 0; i < safeChapterIndex && i < numChapters; i++) {
    spreadOffset += chapterSpreads[i];
  }

  const totalSpreads = Math.max(
    1,
    chapterSpreads.reduce((sum, s) => sum + s, 0)
  );
  const safeCurrentSpread = Math.min(chapterSpreads[safeChapterIndex] - 1, Math.max(0, currentChapterSpread));
  const globalSpread = Math.min(totalSpreads - 1, Math.max(0, spreadOffset + safeCurrentSpread));

  const totalPages = totalSpreads * cols;
  const startPage = globalSpread * cols + 1;
  const endPage = Math.min(totalPages, globalSpread * cols + cols);

  return { startPage, endPage, totalPages, globalSpread, totalSpreads };
}
