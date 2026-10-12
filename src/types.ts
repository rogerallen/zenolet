// Canonical Domain Types for Zenolet
import type { EpubChapter } from './services/epub.js';

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
  content: string;
  chapters?: EpubChapter[];
}
