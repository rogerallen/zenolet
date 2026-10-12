import { describe, it, expect, vi } from 'vitest';
import { navigateForward, navigateBackward, type NavigationOptions, handleKeyboardEvent } from './Navigation.js';
import type { ReaderState } from './ReaderEngine.js';

describe('Navigation & Chapter Boundary Transitions', () => {
  it('scrolls forward when not on the final chapter spread', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
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
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
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
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
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
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
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
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
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
  });
});
