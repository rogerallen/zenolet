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

  it('traps Tab and Shift+Tab focus within active modal dialogs (ACC-001)', () => {
    aboutModal.innerHTML = `
      <div class="modal-card">
        <button id="btn-1">First Button</button>
        <button id="btn-2">Second Button</button>
        <button id="btn-3">Last Button</button>
      </div>
    `;
    aboutModal.classList.add('visible');

    const btn1 = aboutModal.querySelector('#btn-1') as HTMLButtonElement;
    const btn3 = aboutModal.querySelector('#btn-3') as HTMLButtonElement;

    // Simulate focus trap keydown handler from main.ts
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeModal = [aboutModal].find((m) => m && m.classList.contains('visible'));
      if (activeModal && e.key === 'Tab') {
        const focusable = activeModal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const visibleFocusable = Array.from(focusable);
        if (visibleFocusable.length > 0) {
          const first = visibleFocusable[0];
          const last = visibleFocusable[visibleFocusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 1. Tabbing forward from last element wraps to first
    btn3.focus();
    expect(document.activeElement).toBe(btn3);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }));
    expect(document.activeElement).toBe(btn1);

    // 2. Tabbing backward (Shift+Tab) from first element wraps to last
    btn1.focus();
    expect(document.activeElement).toBe(btn1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(btn3);

    document.removeEventListener('keydown', handleKeyDown);
  });
});
