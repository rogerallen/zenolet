import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadZenoletConfig } from './config.js';
import { renderCuratorHeader } from '../components/Bookshelf.js';

describe('Zenolet Configuration & Curator Header', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads config with new structured settings, title, repoUrl, and curator linkUrl', async () => {
    const mockConfig = {
      title: 'My Custom Library',
      repoUrl: 'https://github.com/myuser/zenolet',
      curator: {
        name: 'Jane Doe',
        linkUrl: 'https://janedoe.example.com'
      },
      settings: {
        defaultTheme: 'sepia',
        fontSize: 18,
        layoutColumns: 'auto'
      },
      proxyUrl: 'https://proxy.example.com'
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const loaded = await loadZenoletConfig();
    expect(loaded.title).toBe('My Custom Library');
    expect(loaded.repoUrl).toBe('https://github.com/myuser/zenolet');
    expect(loaded.curator?.name).toBe('Jane Doe');
    expect(loaded.curator?.linkUrl).toBe('https://janedoe.example.com');
    expect(loaded.settings?.defaultTheme).toBe('sepia');
    expect(loaded.settings?.fontSize).toBe(18);
  });

  it('falls back to zenolet.config.json if curator/config.json is not found', async () => {
    const mockConfig = {
      title: 'Legacy Config Library',
      curator: { name: 'Legacy Curator' }
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('curator/config.json')) {
        return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockConfig), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    const loaded = await loadZenoletConfig();
    expect(loaded.title).toBe('Legacy Config Library');
    expect(loaded.curator?.name).toBe('Legacy Curator');
  });

  it('renders about library section properly with title, blurb, and curator', async () => {
    const { renderAboutLibrarySection } = await import('../components/Bookshelf.js');
    const container = document.createElement('div');
    renderAboutLibrarySection(
      container,
      'My Curated Collection',
      { name: 'Curator Jane', linkUrl: 'https://jane.example.com' },
      'A wonderful collection of public domain books from Project Gutenberg.'
    );

    expect(container.innerHTML).toContain('<h4 class="about-library-title">My Curated Collection</h4>');
    expect(container.innerHTML).toContain('<p class="about-library-blurb">');
    expect(container.innerHTML).toContain(
      '<a href="https://www.gutenberg.org" target="_blank" rel="noopener" class="curator-link">Project Gutenberg</a>'
    );
    expect(container.innerHTML).toContain(
      'Curated by <a href="https://jane.example.com" target="_blank" rel="noopener" class="curator-link">Curator Jane</a>'
    );
  });

  it('renders curator header with active linkUrl when present', () => {
    const container = document.createElement('div');
    renderCuratorHeader(container, 'The Great Library', {
      name: 'Roger Allen',
      linkUrl: 'https://rogerallen.github.io'
    });

    expect(container.innerHTML).toContain('<h1 class="minimal-site-title">The Great Library</h1>');
    expect(container.innerHTML).toContain(
      'Curated by <a href="https://rogerallen.github.io" target="_blank" rel="noopener" class="curator-link">Roger Allen</a>'
    );
  });

  it('renders curator header with blurb between title and curator byline', () => {
    const container = document.createElement('div');
    renderCuratorHeader(
      container,
      'The Great Library',
      { name: 'Roger Allen', linkUrl: 'https://rogerallen.github.io' },
      'A timeless collection of classics.'
    );

    expect(container.innerHTML).toContain('<h1 class="minimal-site-title">The Great Library</h1>');
    expect(container.innerHTML).toContain('<p class="minimal-blurb">A timeless collection of classics.</p>');
    expect(container.innerHTML).toContain(
      '<p class="minimal-byline">Curated by <a href="https://rogerallen.github.io" target="_blank" rel="noopener" class="curator-link">Roger Allen</a></p>'
    );
  });

  it('renders plain text curator when linkUrl is not present', () => {
    const container = document.createElement('div');
    renderCuratorHeader(container, 'The Great Library', {
      name: 'Roger Allen'
    });

    expect(container.innerHTML).toContain('Curated by Roger Allen');
    expect(container.innerHTML).not.toContain('<a href=');
  });

  it('rejects unsafe protocols (javascript:, data:) in curator linkUrl and renders text (SEC-002)', () => {
    const container = document.createElement('div');
    renderCuratorHeader(container, 'The Great Library', {
      name: 'Malicious Curator',
      linkUrl: "javascript:alert('xss')"
    });

    expect(container.innerHTML).toContain('Curated by Malicious Curator');
    expect(container.innerHTML).not.toContain('<a href=');
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('safely handles null and undefined inputs in escapeHtml without throwing (REL-001)', async () => {
    const { escapeHtml } = await import('../components/Bookshelf.js');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('Hello <World> & "Friends"')).toBe('Hello &lt;World&gt; &amp; &quot;Friends&quot;');
  });
});
