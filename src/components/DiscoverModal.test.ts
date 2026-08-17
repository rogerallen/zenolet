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
      htmlUrl: 'https://www.gutenberg.org/files/245/245-h/245-h.htm'
    },
    {
      id: '76',
      title: 'Adventures of Huckleberry Finn',
      author: 'Mark Twain',
      subjects: ['Mississippi River -- Fiction', 'Boys -- Fiction'],
      downloads: 12000,
      htmlUrl: 'https://www.gutenberg.org/files/76/76-h/76-h.htm'
    },
    {
      id: '84',
      title: 'Frankenstein; Or, The Modern Prometheus',
      author: 'Mary Wollstonecraft Shelley',
      subjects: ['Monsters -- Fiction', 'Science fiction'],
      downloads: 15000,
      htmlUrl: 'https://www.gutenberg.org/files/84/84-h/84-h.htm'
    }
  ];

  it('renders popular classics when query is empty', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('', sampleCatalog, container, onImport);

    expect(container.innerHTML).toContain('Popular Classics');
    expect(container.querySelectorAll('.discover-card').length).toBe(3);
  });

  it('filters matches strictly from local catalog based on title, author, or subject', () => {
    const container = document.createElement('div');
    const onImport = vi.fn();

    renderLocalCatalogResults('mississippi', sampleCatalog, container, onImport);

    expect(container.innerHTML).toContain('Matching Classics (2)');
    expect(container.innerHTML).toContain('Life on the Mississippi');
    expect(container.innerHTML).toContain('Adventures of Huckleberry Finn');
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

    expect(onImport).toHaveBeenCalledWith('84', 'Frankenstein; Or, The Modern Prometheus', 'Mary Wollstonecraft Shelley', 'https://www.gutenberg.org/files/84/84-h/84-h.htm');
  });
});
