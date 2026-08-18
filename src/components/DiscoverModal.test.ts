import { describe, it, expect, vi } from 'vitest';
import { renderLocalCatalogResults } from './DiscoverModal.js';
import type { CatalogBook } from '../services/catalog.js';

describe('DiscoverModal Local-Only Catalog Search', () => {
  const sampleCatalog: CatalogBook[] = [
    {
      id: '245',
      title: 'Life on the Mississippi',
      author: 'Mark Twain',
      subjects: ['Mississippi River -- Description and travel', 'Twain, Mark, 1835-1910'],
      downloads: 5000,
      epubUrl: 'https://www.gutenberg.org/ebooks/245.epub3.images',
      coverUrl: 'https://www.gutenberg.org/cache/epub/245/pg245.cover.medium.jpg'
    },
    {
      id: '76',
      title: 'Adventures of Huckleberry Finn',
      author: 'Mark Twain',
      subjects: ['Mississippi River -- Fiction', 'Boys -- Fiction'],
      downloads: 12000,
      epubUrl: 'https://www.gutenberg.org/ebooks/76.epub3.images',
      coverUrl: 'https://www.gutenberg.org/cache/epub/76/pg76.cover.medium.jpg'
    },
    {
      id: '84',
      title: 'Frankenstein; Or, The Modern Prometheus',
      author: 'Mary Wollstonecraft Shelley',
      subjects: ['Monsters -- Fiction', 'Science fiction'],
      downloads: 15000,
      epubUrl: 'https://www.gutenberg.org/ebooks/84.epub3.images',
      coverUrl: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg'
    }
  ];

  it('renders popular classics when query is empty', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('', sampleCatalog, container, onImport);

    expect(container.innerHTML).toContain('Popular Classics');
    expect(container.querySelectorAll('.discover-card').length).toBe(3);
    expect(container.querySelectorAll('.discover-cover-img').length).toBe(3);
  });

  it('filters matches strictly from local catalog based on title, author, or subject', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('mississippi', sampleCatalog, container, onImport);

    expect(container.innerHTML).toContain('Matching Classics (2)');
    expect(container.innerHTML).toContain('1) Life on the Mississippi');
    expect(container.innerHTML).toContain('by Mark Twain #245');
    expect(container.innerHTML).toContain('2) Adventures of Huckleberry Finn');
    expect(container.innerHTML).toContain('by Mark Twain #76');
    expect(container.innerHTML).not.toContain('Frankenstein');
  });

  it('displays a clean empty message when no matches exist in local catalog', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('nonexistent book query xyz123', sampleCatalog, container, onImport);

    expect(container.innerHTML).toContain('No matching books found in the curated classics catalog');
    expect(container.querySelectorAll('.discover-card').length).toBe(0);
  });

  it('invokes onImportBook when Add to Shelf button is clicked', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('Frankenstein', sampleCatalog, container, onImport);

    const addBtn = container.querySelector('.btn-discover-import') as HTMLButtonElement;
    expect(addBtn).not.toBeNull();
    addBtn.click();

    expect(onImport).toHaveBeenCalledWith(
      '84',
      'Frankenstein; Or, The Modern Prometheus',
      'Mary Wollstonecraft Shelley',
      'https://www.gutenberg.org/ebooks/84.epub3.images',
      'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg'
    );
  });

  it('opens discover panel and focuses the search input (ACC-001)', async () => {
    const { openDiscoverPanel, closeDiscoverPanel } = await import('./DiscoverModal.js');
    const overlay = document.createElement('div');
    const panel = document.createElement('aside');
    const input = document.createElement('input');
    document.body.appendChild(input);

    try {
      openDiscoverPanel(overlay, panel, input);
      expect(overlay.classList.contains('visible')).toBe(true);
      expect(panel.classList.contains('visible')).toBe(true);

      await new Promise((r) => setTimeout(r, 60));
      expect(document.activeElement).toBe(input);

      closeDiscoverPanel(overlay, panel);
      expect(overlay.classList.contains('visible')).toBe(false);
      expect(panel.classList.contains('visible')).toBe(false);
    } finally {
      input.remove();
    }
  });
});
