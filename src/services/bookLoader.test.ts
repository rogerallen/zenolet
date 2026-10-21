import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBookPipeline, type BookLoadResult } from './bookLoader.js';
import * as storage from './storage.js';
import * as corsProxy from './corsProxy.js';
import * as epub from './epub.js';
import type { BaseBook } from '../types.js';

vi.mock('./storage.js', () => ({
  getStoredBookOffline: vi.fn(),
  saveBookOffline: vi.fn(),
  getStoredSlots: vi.fn(() => [null, null, null, null, null, null, null, null]),
  saveSlots: vi.fn()
}));

vi.mock('./corsProxy.js', () => ({
  getGutenbergCandidateUrls: vi.fn(),
  fetchArrayBufferWithProxy: vi.fn()
}));

vi.mock('./epub.js', () => ({
  parseEpubArchive: vi.fn()
}));

describe('bookLoader service', () => {
  const testBook: BaseBook = {
    id: '1234',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    epubUrl: 'https://example.com/1234.epub',
    coverUrl: 'https://example.com/cover.jpg'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads book from offline cache without fetching if already cached', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue({
      metadata: { ...testBook, byteSize: 5000 },
      content: '<p>Cached Chapter Content</p>',
      chapters: [
        {
          index: 0,
          id: 'ch-0',
          title: 'Chapter 1',
          href: 'ch1.xhtml',
          htmlContent: '<p>Cached Chapter Content</p>'
        }
      ],
      tocChapters: [{ title: 'Chapter 1', href: 'ch1.xhtml', anchorId: 'ch1' }]
    });

    const result: BookLoadResult = await loadBookPipeline(testBook, 'https://proxy.example.com', 0);

    expect(result.fromCache).toBe(true);
    expect(result.content).toBe('<p>Cached Chapter Content</p>');
    expect(result.chapters).toHaveLength(1);
    expect(result.tocChapters).toHaveLength(1);
    expect(corsProxy.fetchArrayBufferWithProxy).not.toHaveBeenCalled();
    expect(storage.saveBookOffline).not.toHaveBeenCalled();
  });

  it('fetches via candidate URLs, parses EPUB, and saves offline if not cached', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue(null);
    vi.mocked(corsProxy.getGutenbergCandidateUrls).mockReturnValue([
      'https://gutenberg.org/1234.epub3.images',
      'https://gutenberg.org/1234.epub'
    ]);

    const fakeBuffer = new ArrayBuffer(256);
    vi.mocked(corsProxy.fetchArrayBufferWithProxy).mockResolvedValue(fakeBuffer);
    vi.mocked(epub.parseEpubArchive).mockReturnValue({
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      htmlContent: '<p>Fresh EPUB Content</p>',
      chapters: [
        {
          index: 0,
          id: 'ch-0',
          title: 'Chapter 1',
          href: 'ch1.xhtml',
          htmlContent: '<section class="epub-chapter">Fresh EPUB Content</section>'
        }
      ],
      tocChapters: [{ title: 'Chapter 1', href: 'ch1.xhtml', anchorId: 'ch1' }],
      coverDataUrl: 'data:image/jpeg;base64,freshcover'
    });

    const result = await loadBookPipeline(testBook, 'https://proxy.example.com', 2);

    expect(result.fromCache).toBe(false);
    expect(result.content).toBe('<p>Fresh EPUB Content</p>');
    expect(result.coverUrl).toBe('data:image/jpeg;base64,freshcover');
    expect(result.chapters).toHaveLength(1);
    expect(corsProxy.fetchArrayBufferWithProxy).toHaveBeenCalledTimes(1);
    expect(storage.saveBookOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1234',
        title: 'Pride and Prejudice',
        coverUrl: 'data:image/jpeg;base64,freshcover'
      }),
      expect.objectContaining({
        content: '<p>Fresh EPUB Content</p>',
        chapters: expect.any(Array)
      }),
      2
    );
  });

  it('falls back through candidate URLs when earlier candidates fail', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue(null);
    vi.mocked(corsProxy.getGutenbergCandidateUrls).mockReturnValue([
      'https://gutenberg.org/bad1.epub',
      'https://gutenberg.org/bad2.epub',
      'https://gutenberg.org/good.epub'
    ]);

    vi.mocked(corsProxy.fetchArrayBufferWithProxy)
      .mockRejectedValueOnce(new Error('404 Not Found'))
      .mockResolvedValueOnce(new ArrayBuffer(10)) // too small (< 100 bytes)
      .mockResolvedValueOnce(new ArrayBuffer(500));

    vi.mocked(epub.parseEpubArchive).mockReturnValue({
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      htmlContent: '<p>Third candidate succeeded</p>',
      chapters: [],
      tocChapters: []
    });

    const result = await loadBookPipeline(testBook, 'https://proxy.example.com', 0);

    expect(result.content).toBe('<p>Third candidate succeeded</p>');
    expect(corsProxy.fetchArrayBufferWithProxy).toHaveBeenCalledTimes(3);
  });

  it('falls back to next candidate when an earlier candidate yields corrupted or invalid ZIP data', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue(null);
    vi.mocked(corsProxy.getGutenbergCandidateUrls).mockReturnValue([
      'https://gutenberg.org/corrupt.epub',
      'https://gutenberg.org/valid.epub'
    ]);

    vi.mocked(corsProxy.fetchArrayBufferWithProxy)
      .mockResolvedValueOnce(new ArrayBuffer(206756))
      .mockResolvedValueOnce(new ArrayBuffer(814023));

    vi.mocked(epub.parseEpubArchive)
      .mockImplementationOnce(() => {
        throw new Error('invalid zip data');
      })
      .mockReturnValueOnce({
        title: 'Moby Dick',
        author: 'Herman Melville',
        htmlContent: '<p>Call me Ishmael</p>',
        chapters: [],
        tocChapters: []
      });

    const result = await loadBookPipeline(testBook, 'https://proxy.example.com', 0);

    expect(result.content).toBe('<p>Call me Ishmael</p>');
    expect(corsProxy.fetchArrayBufferWithProxy).toHaveBeenCalledTimes(2);
    expect(epub.parseEpubArchive).toHaveBeenCalledTimes(2);
  });

  it('throws an error when all candidate URLs fail to download', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue(null);
    vi.mocked(corsProxy.getGutenbergCandidateUrls).mockReturnValue(['https://gutenberg.org/bad.epub']);
    vi.mocked(corsProxy.fetchArrayBufferWithProxy).mockRejectedValue(new Error('Network Error'));

    await expect(loadBookPipeline(testBook, 'https://proxy.example.com', 0)).rejects.toThrow('Network Error');
  });

  it('notifies onProgress callback with phase status messages', async () => {
    vi.mocked(storage.getStoredBookOffline).mockResolvedValue(null);
    vi.mocked(corsProxy.getGutenbergCandidateUrls).mockReturnValue(['https://gutenberg.org/1234.epub']);
    vi.mocked(corsProxy.fetchArrayBufferWithProxy).mockResolvedValue(new ArrayBuffer(500));
    vi.mocked(epub.parseEpubArchive).mockReturnValue({
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      htmlContent: '<p>EPUB content</p>',
      chapters: [],
      tocChapters: []
    });

    const progressStatuses: string[] = [];
    await loadBookPipeline(testBook, 'https://proxy.example.com', 0, (status) => {
      progressStatuses.push(status);
    });

    expect(progressStatuses).toEqual(['Downloading book...', 'Unpacking EPUB...', 'Saving to shelf...']);
  });
});
