import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHtml, renderCuratorHeader, renderAboutLibrarySection, render8SlotGrid } from './Bookshelf.js';
import type { BookMetadata } from '../services/storage.js';

describe('Bookshelf Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('escapeHtml', () => {
    it('returns empty string for null or undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('escapes special HTML characters properly', () => {
      const raw = `Tom & Jerry <"classic"> 'edition'`;
      expect(escapeHtml(raw)).toBe('Tom &amp; Jerry &lt;&quot;classic&quot;&gt; &#039;edition&#039;');
    });
  });

  describe('renderCuratorHeader', () => {
    it('renders default title and curator name when config is omitted', () => {
      renderCuratorHeader(container);
      expect(container.querySelector('.minimal-site-title')?.textContent).toBe('Zenolet');
      expect(container.querySelector('.minimal-byline')?.textContent).toContain('Curated by Curator');
      expect(container.querySelector('.minimal-blurb')).toBeNull();
    });

    it('renders safe curator link when linkUrl uses HTTPS', () => {
      renderCuratorHeader(
        container,
        'My Library',
        { name: 'Alice', linkUrl: 'https://alice.example.com' },
        'A fine collection from Project Gutenberg'
      );

      const title = container.querySelector('.minimal-site-title');
      expect(title?.textContent).toBe('My Library');

      const curatorLink = container.querySelector('.minimal-byline .curator-link') as HTMLAnchorElement;
      expect(curatorLink).not.toBeNull();
      expect(curatorLink.href).toBe('https://alice.example.com/');
      expect(curatorLink.textContent).toBe('Alice');

      const blurb = container.querySelector('.minimal-blurb');
      expect(blurb?.innerHTML).toContain(
        '<a href="https://www.gutenberg.org" target="_blank" rel="noopener" class="curator-link">Project Gutenberg</a>'
      );
    });

    it('does not render anchor when curator linkUrl is unsafe', () => {
      renderCuratorHeader(container, 'Safe Books', {
        name: 'Attacker',
        linkUrl: 'javascript:alert(1)'
      });

      expect(container.querySelector('a.curator-link')).toBeNull();
      expect(container.querySelector('.minimal-byline')?.textContent).toContain('Curated by Attacker');
    });
  });

  describe('renderAboutLibrarySection', () => {
    it('renders about section with defaults', () => {
      renderAboutLibrarySection(container);
      expect(container.querySelector('.about-library-title')?.textContent).toBe('Curated Library');
      expect(container.querySelector('.about-library-curator')?.textContent).toContain('Curated by Curator');
    });

    it('renders with safe link and formatted Gutenberg blurb', () => {
      renderAboutLibrarySection(
        container,
        'Custom Library',
        { name: 'Bob', linkUrl: 'https://bob.example.com' },
        'Powered by Project Gutenberg'
      );

      expect(container.querySelector('.about-library-title')?.textContent).toBe('Custom Library');
      const link = container.querySelector('.about-library-curator a.curator-link') as HTMLAnchorElement;
      expect(link.href).toBe('https://bob.example.com/');
      expect(container.querySelector('.about-library-blurb')?.innerHTML).toContain('href="https://www.gutenberg.org"');
    });
  });

  describe('render8SlotGrid', () => {
    const mockBook: BookMetadata = {
      id: 'book-1',
      title: 'Moby Dick',
      author: 'Herman Melville',
      coverUrl: 'https://example.com/cover.jpg',
      byteSize: 1048576
    };

    const mockBookNoCover: BookMetadata = {
      id: 'book-2',
      title: 'Frankenstein',
      author: 'Mary Shelley',
      byteSize: 524288
    };

    it('renders dynamic bookshelf cards with a single trailing Add Book trigger', () => {
      const slots: (BookMetadata | null)[] = [mockBook, mockBookNoCover];
      const onOpenBook = vi.fn();
      const onRemoveBook = vi.fn();
      const onEmptySlotClick = vi.fn();

      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick);

      const allCards = container.querySelectorAll('.slot-card');
      expect(allCards.length).toBe(3);

      const filledCards = container.querySelectorAll('.slot-filled');
      expect(filledCards.length).toBe(2);

      const emptyCards = container.querySelectorAll('.slot-empty');
      expect(emptyCards.length).toBe(1);

      // Verify no "Slot N" text is rendered
      expect(container.textContent).not.toContain('Slot 1');
      expect(container.textContent).not.toContain('Slot 2');
      expect(container.textContent).not.toContain('Slot 3');

      // Check first filled card details
      const firstCard = filledCards[0] as HTMLElement;
      expect(firstCard.querySelector('.slot-card-title')?.textContent).toBe('Moby Dick');
      expect(firstCard.querySelector('.slot-card-author')?.textContent).toBe('by Herman Melville');
      expect(firstCard.querySelector('.slot-cover-img')).not.toBeNull();

      // Check second filled card placeholder
      const secondCard = filledCards[1] as HTMLElement;
      expect(secondCard.querySelector('.slot-card-title')?.textContent).toBe('Frankenstein');
      expect(secondCard.querySelector('.slot-cover-placeholder')).not.toBeNull();
    });

    it('handles opening filled book on click and Enter/Space keydown', () => {
      const slots: (BookMetadata | null)[] = [mockBook, null, null, null, null, null, null, null];
      const onOpenBook = vi.fn();
      const onRemoveBook = vi.fn();
      const onEmptySlotClick = vi.fn();

      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick);

      const card = container.querySelector('.slot-filled') as HTMLElement;

      // Click
      card.click();
      expect(onOpenBook).toHaveBeenCalledWith('book-1', 0);

      // Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      card.dispatchEvent(enterEvent);
      expect(onOpenBook).toHaveBeenCalledTimes(2);

      // Space key
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      card.dispatchEvent(spaceEvent);
      expect(onOpenBook).toHaveBeenCalledTimes(3);
    });

    it('handles removing book without triggering book open', () => {
      const slots: (BookMetadata | null)[] = [mockBook, null, null, null, null, null, null, null];
      const onOpenBook = vi.fn();
      const onRemoveBook = vi.fn();
      const onEmptySlotClick = vi.fn();

      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick);

      const removeBtn = container.querySelector('.btn-remove-slot') as HTMLButtonElement;
      removeBtn.click();

      expect(onRemoveBook).toHaveBeenCalledWith('book-1', 0);
      expect(onOpenBook).not.toHaveBeenCalled();
    });

    it('handles empty slot click and keyboard interaction', () => {
      const slots: (BookMetadata | null)[] = [];
      const onOpenBook = vi.fn();
      const onRemoveBook = vi.fn();
      const onEmptySlotClick = vi.fn();

      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick);

      const emptyCards = container.querySelectorAll('.slot-empty');
      expect(emptyCards.length).toBe(1);
      const emptyTrigger = emptyCards[0] as HTMLElement;

      // Click
      emptyTrigger.click();
      expect(onEmptySlotClick).toHaveBeenCalledWith(0);

      // Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      emptyTrigger.dispatchEvent(enterEvent);
      expect(onEmptySlotClick).toHaveBeenCalledWith(0);
    });

    it('renders loading states for occupied and empty slots', () => {
      const slots: (BookMetadata | null)[] = [mockBook, null, null, null, null, null, null, null];
      const onOpenBook = vi.fn();
      const onRemoveBook = vi.fn();
      const onEmptySlotClick = vi.fn();

      // Loading occupied slot
      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick, {
        slotIndex: 0,
        book: mockBook
      });

      const loadingCard = container.querySelector('.slot-loading') as HTMLElement;
      expect(loadingCard).not.toBeNull();
      expect(loadingCard.querySelector('.slot-loading-text')?.textContent).toBe('Downloading...');

      // Loading empty slot
      render8SlotGrid(container, slots, 8, onOpenBook, onRemoveBook, onEmptySlotClick, {
        slotIndex: 1,
        book: null
      });

      const loadingEmptyCard = container.querySelector('.slot-empty.slot-loading') as HTMLElement;
      expect(loadingEmptyCard).not.toBeNull();
      expect(loadingEmptyCard.querySelector('.slot-empty-label')?.textContent).toBe('Downloading...');
    });
  });
});
