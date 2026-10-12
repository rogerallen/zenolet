import { describe, it, expect } from 'vitest';
import {
  computeChapterWeights,
  calculateGlobalProgress,
  findChapterForGlobalProgress,
  calculateBookPagination
} from './virtualization.js';
import type { ParsedChapter } from './epub.js';

describe('Chapter Virtualization & Progress Normalization', () => {
  it('computes weights for empty chapters gracefully', () => {
    const weights = computeChapterWeights([]);
    expect(weights.baseFractions).toEqual([0]);
    expect(weights.spanFractions).toEqual([1]);
  });

  it('computes proportional weights based on chapter HTML length', () => {
    const chapters: ParsedChapter[] = [
      { index: 0, id: 'c0', title: 'Ch 1', href: 'c1.xhtml', htmlContent: 'a'.repeat(1000) },
      { index: 1, id: 'c1', title: 'Ch 2', href: 'c2.xhtml', htmlContent: 'b'.repeat(3000) }
    ];

    const weights = computeChapterWeights(chapters);
    expect(weights.baseFractions[0]).toBe(0);
    expect(weights.spanFractions[0]).toBeCloseTo(0.25, 4);
    expect(weights.baseFractions[1]).toBeCloseTo(0.25, 4);
    expect(weights.spanFractions[1]).toBeCloseTo(0.75, 4);
  });

  it('calculates continuous global progress across chapter boundaries', () => {
    const chapters: ParsedChapter[] = [
      { index: 0, id: 'c0', title: 'Ch 1', href: 'c1.xhtml', htmlContent: 'a'.repeat(1000) },
      { index: 1, id: 'c1', title: 'Ch 2', href: 'c2.xhtml', htmlContent: 'b'.repeat(1000) }
    ];

    const weights = computeChapterWeights(chapters);

    // Chapter 0, spread 0 of 5
    expect(calculateGlobalProgress(0, 0, 5, weights)).toBe(0);

    // Chapter 0, middle spread 2 of 5 (spreads 0, 1, 2, 3, 4 -> 2/4 = 0.5 of 0.5 = 0.25)
    expect(calculateGlobalProgress(0, 2, 5, weights)).toBeCloseTo(0.25, 4);

    // Chapter 0, final spread 4 of 5 (4/4 = 1.0 of 0.5 = 0.5)
    expect(calculateGlobalProgress(0, 4, 5, weights)).toBeCloseTo(0.5, 4);

    // Chapter 1, spread 0 of 3 (0/2 = 0.0 -> base 0.5)
    expect(calculateGlobalProgress(1, 0, 3, weights)).toBeCloseTo(0.5, 4);

    // Chapter 1, final spread 2 of 3 (2/2 = 1.0 -> 0.5 + 0.5 = 1.0)
    expect(calculateGlobalProgress(1, 2, 3, weights)).toBe(1.0);
  });

  it('maps global progress back to corresponding chapter and intra-chapter fraction', () => {
    const chapters: ParsedChapter[] = [
      { index: 0, id: 'c0', title: 'Ch 1', href: 'c1.xhtml', htmlContent: 'a'.repeat(2000) },
      { index: 1, id: 'c1', title: 'Ch 2', href: 'c2.xhtml', htmlContent: 'b'.repeat(2000) }
    ];

    const weights = computeChapterWeights(chapters);

    const start = findChapterForGlobalProgress(0, weights);
    expect(start.chapterIndex).toBe(0);
    expect(start.chapterFraction).toBe(0);

    const middleCh0 = findChapterForGlobalProgress(0.25, weights);
    expect(middleCh0.chapterIndex).toBe(0);
    expect(middleCh0.chapterFraction).toBeCloseTo(0.5, 4);

    const middleCh1 = findChapterForGlobalProgress(0.75, weights);
    expect(middleCh1.chapterIndex).toBe(1);
    expect(middleCh1.chapterFraction).toBeCloseTo(0.5, 4);

    const end = findChapterForGlobalProgress(1.0, weights);
    expect(end.chapterIndex).toBe(1);
    expect(end.chapterFraction).toBe(1.0);
  });

  it('normalizes HTML content by excluding data:image base64 strings when calculating chapter weights', () => {
    // 300KB of base64 image data in chapter 0 (like a cover image), 2KB of text in chapter 1
    const base64Cover = 'data:image/jpeg;base64,' + 'X'.repeat(300000);
    const chapters: ParsedChapter[] = [
      {
        index: 0,
        id: 'c0',
        title: 'Cover',
        href: 'cover.xhtml',
        htmlContent: `<div class="cover"><img src="${base64Cover}" /></div>`
      },
      {
        index: 1,
        id: 'c1',
        title: 'Chapter 1',
        href: 'ch1.xhtml',
        htmlContent: '<p>' + 'word '.repeat(500) + '</p>'
      }
    ];

    const weights = computeChapterWeights(chapters);
    // Cover text is small (~50 chars), clamped to minimum 100
    // Chapter 1 text is ~2500 chars
    // Cover should NOT get 99% of the book weight; it should get a tiny fraction
    expect(weights.spanFractions[0]).toBeLessThan(0.1);
    expect(weights.spanFractions[1]).toBeGreaterThan(0.9);
  });

  it('translates local chapter spreads into book-wide pagination across discrete chapters', () => {
    // 3 chapters: chapter 0 has 1000 chars, chapter 1 has 3000 chars, chapter 2 has 2000 chars
    const chapters: ParsedChapter[] = [
      { index: 0, id: 'c0', title: 'Ch 1', href: 'c0.xhtml', htmlContent: 'x'.repeat(1000) },
      { index: 1, id: 'c1', title: 'Ch 2', href: 'c1.xhtml', htmlContent: 'x'.repeat(3000) },
      { index: 2, id: 'c2', title: 'Ch 3', href: 'c2.xhtml', htmlContent: 'x'.repeat(2000) }
    ];

    const cache = new Map<number, number>();
    // Chapter 0 measured at 2 spreads (1000 chars / 2 = 500 chars/spread)
    cache.set(0, 2);

    // Reading Chapter 0, spread 0 of 2 in 2-column mode
    const p0 = calculateBookPagination(0, 0, 2, chapters, 2, cache);
    expect(p0.startPage).toBe(1);
    expect(p0.endPage).toBe(2);
    // Estimated: ch0=2 spreads, ch1=6 spreads, ch2=4 spreads -> total 12 spreads * 2 cols = 24 pages
    expect(p0.totalSpreads).toBe(12);
    expect(p0.totalPages).toBe(24);

    // Reading Chapter 1 (starts after chapter 0's 2 spreads = spread offset 2 -> pages 5..16)
    // Spread 0 of 6 in Chapter 1
    const p1 = calculateBookPagination(1, 0, 6, chapters, 2, cache);
    expect(p1.startPage).toBe(5);
    expect(p1.endPage).toBe(6);
    expect(p1.totalPages).toBe(24);

    // Reading Chapter 2, final spread (spread 3 of 4)
    const p2 = calculateBookPagination(2, 3, 4, chapters, 2, cache);
    expect(p2.startPage).toBe(23);
    expect(p2.endPage).toBe(24);
    expect(p2.totalPages).toBe(24);
  });
});
