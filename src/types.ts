// Canonical Domain Types for Zenolet
import type { EpubChapter, ParsedChapter } from './services/epub.js';

/**
 * Spine Item / Spine Chapter:
 * A discrete XHTML document defined in the EPUB spine (`<spine>`),
 * mounted individually into the reader viewport during chapter virtualization.
 */
export type SpineChapter = ParsedChapter;

/**
 * Table of Contents Chapter:
 * A logical navigation milestone defined in the EPUB navigation document (`nav.xhtml` or `toc.ncx`),
 * mapped to an anchor or relative target within a Spine Item.
 */
export type TocChapter = EpubChapter;

export interface BaseBook {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  epubUrl?: string;
}

export interface CatalogBook extends BaseBook {
  subjects: string[];
  downloads: number;
}

export interface BookMetadata extends BaseBook {
  byteSize?: number;
}

export interface StoredBookData {
  metadata: BookMetadata;
  /** Discrete spine items stored for chapter virtualization */
  chapters?: SpineChapter[];
  /** Structured Table of Contents navigation milestones */
  tocChapters?: TocChapter[];
  content?: string;
}
