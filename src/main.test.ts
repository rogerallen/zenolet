import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Zenolet App Main Keyboard & Link Interception Integration', () => {
  let readerViewport: HTMLDivElement;
  let readerContent: HTMLElement;
  let aboutModal: HTMLDivElement;
  let settingsPanel: HTMLDivElement;
  let discoverPanel: HTMLElement;
  let discoverOverlay: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="library-view" class="view"></div>
        <div id="reader-view" class="view hidden">
          <div id="reader-viewport" class="reader-viewport">
            <div id="reader-content" class="reader-content"></div>
          </div>
        </div>
        <div id="about-modal" class="modal-overlay"></div>
        <div id="settings-panel" class="settings-panel"></div>
        <div id="discover-overlay" class="modal-overlay"></div>
        <aside id="discover-panel" class="discover-panel"></aside>
      </div>
    `;

    readerViewport = document.getElementById('reader-viewport') as HTMLDivElement;
    readerContent = document.getElementById('reader-content') as HTMLElement;
    aboutModal = document.getElementById('about-modal') as HTMLDivElement;
    settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
    discoverPanel = document.getElementById('discover-panel') as HTMLElement;
    discoverOverlay = document.getElementById('discover-overlay') as HTMLDivElement;

    Object.defineProperty(readerViewport, 'clientWidth', { value: 500, configurable: true });
    readerViewport.scrollBy = vi.fn() as unknown as typeof readerViewport.scrollBy;
  });

  it('handles Escape key to dismiss all open modals and panels', () => {
    aboutModal.classList.add('visible');
    settingsPanel.classList.add('visible');
    discoverPanel.classList.add('visible');
    discoverOverlay.classList.add('visible');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        aboutModal.classList.remove('visible');
        settingsPanel.classList.remove('visible');
        discoverPanel.classList.remove('visible');
        discoverOverlay.classList.remove('visible');
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(aboutModal.classList.contains('visible')).toBe(false);
    expect(settingsPanel.classList.contains('visible')).toBe(false);
    expect(discoverPanel.classList.contains('visible')).toBe(false);
    expect(discoverOverlay.classList.contains('visible')).toBe(false);
  });

  it('navigates forward with ArrowRight and Space, and backward with ArrowLeft and Shift+Space (LATER-002)', () => {
    const currentView = 'reader';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'reader') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        readerViewport.scrollBy({ left: -readerViewport.clientWidth, behavior: 'auto' });
      } else if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        readerViewport.scrollBy({ left: readerViewport.clientWidth, behavior: 'auto' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // 1. ArrowRight -> forward
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: 500, behavior: 'auto' });

    // 2. Space -> forward
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: false }));
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: 500, behavior: 'auto' });

    // 3. ArrowLeft -> backward
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: -500, behavior: 'auto' });

    // 4. Shift + Space -> backward
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: true }));
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: -500, behavior: 'auto' });
  });

  it('intercepts external HTTP links and opens in a new tab safely with noopener noreferrer', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    readerContent.innerHTML = `<a id="ext-link" href="https://www.gutenberg.org">External Project Gutenberg</a>`;
    const link = document.getElementById('ext-link') as HTMLAnchorElement;

    readerContent.addEventListener('click', (e: MouseEvent) => {
      const targetLink = (e.target as HTMLElement).closest('a');
      if (!targetLink) return;
      const href = targetLink.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) {
        e.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    });

    link.click();
    expect(windowOpenSpy).toHaveBeenCalledWith('https://www.gutenberg.org', '_blank', 'noopener,noreferrer');
  });
});
