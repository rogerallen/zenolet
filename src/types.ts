// Canonical Domain Types for Zenolet
import type { EpubChapter, ParsedChapter } from './services/epub.js';

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
  chapters?: ParsedChapter[];
  tocChapters?: EpubChapter[];
  content?: string;
}
