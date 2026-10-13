import { describe, it, expect, vi } from 'vitest';
import {
  navigateForward,
  navigateBackward,
  type NavigationOptions,
  handleKeyboardEvent,
  handleModalFocusTrap,
  handleContentLinkClick
} from './Navigation.js';
import type { ReaderState } from './ReaderEngine.js';
import { createMockViewport } from '../test/fixtures.js';

describe('Navigation & Chapter Boundary Transitions', () => {
  it('scrolls forward when not on the final chapter spread', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 1,
      totalPagesSpreads: 5
    };

    const nextChapterSpy = vi.fn();
    navigateForward(mockViewport, state, nextChapterSpy);

    expect(mockViewport.scrollBy).toHaveBeenCalledWith({ left: 500, behavior: 'auto' });
    expect(nextChapterSpy).not.toHaveBeenCalled();
  });

  it('triggers onNextChapter callback when at the final chapter spread', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 4,
      totalPagesSpreads: 5
    };

    const nextChapterSpy = vi.fn();
    navigateForward(mockViewport, state, nextChapterSpy);

    expect(mockViewport.scrollBy).not.toHaveBeenCalled();
    expect(nextChapterSpy).toHaveBeenCalledTimes(1);
  });

  it('scrolls backward when not on the first spread', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 3,
      totalPagesSpreads: 5
    };

    const prevChapterSpy = vi.fn();
    navigateBackward(mockViewport, state, prevChapterSpy);

    expect(mockViewport.scrollBy).toHaveBeenCalledWith({ left: -500, behavior: 'auto' });
    expect(prevChapterSpy).not.toHaveBeenCalled();
  });

  it('triggers onPrevChapter callback when at spread 0', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const prevChapterSpy = vi.fn();
    navigateBackward(mockViewport, state, prevChapterSpy);

    expect(mockViewport.scrollBy).not.toHaveBeenCalled();
    expect(prevChapterSpy).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard navigation with boundary callbacks via handleKeyboardEvent', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 2,
      totalPagesSpreads: 3
    };

    const nextChapterSpy = vi.fn();
    const prevChapterSpy = vi.fn();

    const options: NavigationOptions = {
      modals: {},
      readerViewport: mockViewport,
      readerState: state,
      onNextChapter: nextChapterSpy,
      onPrevChapter: prevChapterSpy
    };

    // Right Arrow at final spread (spread 2 of 3)
    const rightArrow = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    handleKeyboardEvent(rightArrow, options);
    expect(nextChapterSpy).toHaveBeenCalledTimes(1);

    // Left Arrow at spread 0
    state.currentPageSpread = 0;
    const leftArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    handleKeyboardEvent(leftArrow, options);
    expect(prevChapterSpy).toHaveBeenCalledTimes(1);

    // Space key forward (not shift)
    state.currentPageSpread = 1;
    state.totalPagesSpreads = 5;
    const spaceKey = new KeyboardEvent('keydown', { key: ' ' });
    handleKeyboardEvent(spaceKey, options);
    expect(mockViewport.scrollBy).toHaveBeenCalledWith({ left: 500, behavior: 'auto' });

    // Shift + Space key backward
    const shiftSpaceKey = new KeyboardEvent('keydown', { key: ' ', shiftKey: true });
    handleKeyboardEvent(shiftSpaceKey, options);
    expect(mockViewport.scrollBy).toHaveBeenCalledWith({ left: -500, behavior: 'auto' });
  });

  it('ignores navigation keys when active element is an input or textarea', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 1,
      totalPagesSpreads: 5
    };

    const options: NavigationOptions = {
      modals: {},
      readerViewport: mockViewport,
      readerState: state
    };

    const input = document.createElement('input');
    const inputEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(inputEvent, 'target', { value: input });
    handleKeyboardEvent(inputEvent, options);
    expect(mockViewport.scrollBy).not.toHaveBeenCalled();

    const textarea = document.createElement('textarea');
    const textareaEvent = new KeyboardEvent('keydown', { key: ' ' });
    Object.defineProperty(textareaEvent, 'target', { value: textarea });
    handleKeyboardEvent(textareaEvent, options);
    expect(mockViewport.scrollBy).not.toHaveBeenCalled();
  });

  it('ignores navigation keys when currentView is not reader', () => {
    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollBy = vi.fn() as unknown as typeof mockViewport.scrollBy;

    const state: ReaderState = {
      currentView: 'library',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 1,
      totalPagesSpreads: 5
    };

    const options: NavigationOptions = {
      modals: {},
      readerViewport: mockViewport,
      readerState: state
    };

    const rightArrow = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    handleKeyboardEvent(rightArrow, options);
    expect(mockViewport.scrollBy).not.toHaveBeenCalled();
  });

  it('closes modals on Escape key', () => {
    const aboutModal = document.createElement('div');
    aboutModal.classList.add('visible');

    const qrModal = document.createElement('div');
    const discoverPanel = document.createElement('div');
    const discoverOverlay = document.createElement('div');
    const settingsPanel = document.createElement('div');

    const onCloseQRSpy = vi.fn();
    const onCloseDiscoverSpy = vi.fn();

    const mockViewport = createMockViewport();
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 1
    };

    const options: NavigationOptions = {
      modals: {
        aboutModal,
        qrModal,
        discoverPanel,
        discoverOverlay,
        settingsPanel,
        onCloseQR: onCloseQRSpy,
        onCloseDiscover: onCloseDiscoverSpy
      },
      readerViewport: mockViewport,
      readerState: state
    };

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    handleKeyboardEvent(escapeEvent, options);

    expect(aboutModal.classList.contains('visible')).toBe(false);
    expect(onCloseQRSpy).toHaveBeenCalled();
    expect(onCloseDiscoverSpy).toHaveBeenCalled();
  });
});

describe('Modal Focus Trap (handleModalFocusTrap)', () => {
  it('traps focus inside active modal on Tab and Shift+Tab', () => {
    const modal = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    modal.appendChild(btn1);
    modal.appendChild(btn2);
    document.body.appendChild(modal);

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    // Non-tab key is ignored
    const nonTabEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    const nonTabPreventDefault = vi.spyOn(nonTabEvent, 'preventDefault');
    handleModalFocusTrap(nonTabEvent, modal);
    expect(nonTabPreventDefault).not.toHaveBeenCalled();

    // Shift+Tab from first button wraps to last
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    const preventDefaultShift = vi.spyOn(shiftTab, 'preventDefault');
    btn2.focus = vi.fn();
    btn1.focus = vi.fn();

    handleModalFocusTrap(shiftTab, modal);
    expect(preventDefaultShift).toHaveBeenCalled();
    expect(btn2.focus).toHaveBeenCalled();

    // Tab from last button wraps to first
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false });
    const preventDefaultTab = vi.spyOn(tabEvent, 'preventDefault');
    Object.defineProperty(document, 'activeElement', { value: btn2, configurable: true });

    handleModalFocusTrap(tabEvent, modal);

    expect(preventDefaultTab).toHaveBeenCalled();
    expect(btn1.focus).toHaveBeenCalled();

    document.body.removeChild(modal);
  });
});

describe('Content Link Navigation (handleContentLinkClick)', () => {
  it('opens external links safely in a new window', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const container = document.createElement('div');
    const anchor = document.createElement('a');
    anchor.href = 'https://www.gutenberg.org';
    container.appendChild(anchor);
    document.body.appendChild(container);

    const mockViewport = createMockViewport({ clientWidth: 500 });
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const mouseEvent = new MouseEvent('click', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(mouseEvent, 'preventDefault');
    const stopPropagationSpy = vi.spyOn(mouseEvent, 'stopPropagation');
    Object.defineProperty(mouseEvent, 'target', { value: anchor });

    handleContentLinkClick(mouseEvent, container, mockViewport, state);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(windowOpenSpy).toHaveBeenCalledWith('https://www.gutenberg.org', '_blank', 'noopener,noreferrer');

    windowOpenSpy.mockRestore();
    document.body.removeChild(container);
  });

  it('navigates to chapter anchor when target exists in DOM', () => {
    const container = document.createElement('div');
    const targetSection = document.createElement('section');
    targetSection.id = 'chapter-2';
    container.appendChild(targetSection);

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#chapter-2');
    container.appendChild(anchor);
    document.body.appendChild(container);

    const mockViewport = createMockViewport({ clientWidth: 500 });
    mockViewport.scrollTo = vi.fn() as unknown as typeof mockViewport.scrollTo;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const mouseEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(mouseEvent, 'target', { value: anchor });

    handleContentLinkClick(mouseEvent, container, mockViewport, state);

    expect(mockViewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    document.body.removeChild(container);
  });

  it('triggers onNavigateToChapterAnchor when target belongs to another chapter', () => {
    const container = document.createElement('div');
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#c3_notes');
    container.appendChild(anchor);

    const mockViewport = createMockViewport({ clientWidth: 500 });
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const navChapterAnchorSpy = vi.fn();
    const mouseEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(mouseEvent, 'target', { value: anchor });

    handleContentLinkClick(mouseEvent, container, mockViewport, state, navChapterAnchorSpy, [
      { id: 'c0', htmlContent: '' },
      { id: 'c3', htmlContent: '<div id="c3_notes"></div>' }
    ]);

    expect(navChapterAnchorSpy).toHaveBeenCalledWith(3, 'c3_notes');
  });

  it('searches chapters list when anchor does not match c/ch- prefix', () => {
    const container = document.createElement('div');
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#appendix_section');
    container.appendChild(anchor);

    const mockViewport = createMockViewport({ clientWidth: 500 });
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const navChapterAnchorSpy = vi.fn();
    const mouseEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(mouseEvent, 'target', { value: anchor });

    handleContentLinkClick(mouseEvent, container, mockViewport, state, navChapterAnchorSpy, [
      { id: 'intro', htmlContent: '<p>Intro</p>' },
      { id: 'app', htmlContent: '<div id="appendix_section">Notes</div>' }
    ]);

    expect(navChapterAnchorSpy).toHaveBeenCalledWith(1, 'appendix_section');
  });

  it('ignores clicks on non-link elements or links without href', () => {
    const container = document.createElement('div');
    const span = document.createElement('span');
    container.appendChild(span);

    const mockViewport = createMockViewport();
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 5
    };

    const mouseEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(mouseEvent, 'target', { value: span });

    expect(() => handleContentLinkClick(mouseEvent, container, mockViewport, state)).not.toThrow();
  });
});
