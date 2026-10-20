import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openErrorModal, closeErrorModal, type ErrorModalElements } from './ErrorModal.js';

describe('ErrorModal Component', () => {
  let overlay: HTMLElement;
  let titleElement: HTMLElement;
  let messageElement: HTMLElement;
  let subtextElement: HTMLElement;
  let retryBtn: HTMLElement;
  let cancelBtn: HTMLElement;
  let closeBtn: HTMLElement;
  let elements: ErrorModalElements;

  beforeEach(() => {
    overlay = document.createElement('div');
    titleElement = document.createElement('h3');
    messageElement = document.createElement('p');
    subtextElement = document.createElement('p');
    retryBtn = document.createElement('button');
    cancelBtn = document.createElement('button');
    closeBtn = document.createElement('button');

    overlay.appendChild(titleElement);
    overlay.appendChild(messageElement);
    overlay.appendChild(subtextElement);
    overlay.appendChild(retryBtn);
    overlay.appendChild(cancelBtn);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    elements = {
      overlay,
      titleElement,
      messageElement,
      subtextElement,
      retryBtn,
      cancelBtn,
      closeBtn
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens modal, sets message and subtext, and focuses retry button', () => {
    vi.useFakeTimers();
    const retrySpy = vi.fn();

    openErrorModal(elements, {
      title: 'Download Failed',
      message: 'Could not download "Moby Dick".',
      subtext: 'An active internet connection is required.',
      onRetry: retrySpy
    });

    expect(overlay.classList.contains('visible')).toBe(true);
    expect(titleElement.textContent).toBe('Download Failed');
    expect(messageElement.textContent).toBe('Could not download "Moby Dick".');
    expect(subtextElement.textContent).toBe('An active internet connection is required.');

    vi.advanceTimersByTime(50);
    expect(document.activeElement).toBe(retryBtn);
    vi.useRealTimers();
  });

  it('triggers onRetry and closes modal when retry button is clicked', () => {
    const onRetry = vi.fn();
    openErrorModal(elements, {
      message: 'Network error',
      onRetry
    });

    expect(overlay.classList.contains('visible')).toBe(true);
    retryBtn.click();

    expect(overlay.classList.contains('visible')).toBe(false);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('triggers onCancel and closes modal when cancel button is clicked', () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    openErrorModal(elements, {
      message: 'Network error',
      onRetry,
      onCancel
    });

    expect(overlay.classList.contains('visible')).toBe(true);
    cancelBtn.click();

    expect(overlay.classList.contains('visible')).toBe(false);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes modal when close (X) button is clicked', () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    openErrorModal(elements, {
      message: 'Error',
      onRetry,
      onCancel
    });

    closeBtn.click();
    expect(overlay.classList.contains('visible')).toBe(false);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes modal when clicking backdrop overlay directly', () => {
    openErrorModal(elements, {
      message: 'Error',
      onRetry: vi.fn()
    });

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  it('closes modal manually via closeErrorModal', () => {
    overlay.classList.add('visible');
    closeErrorModal(elements);
    expect(overlay.classList.contains('visible')).toBe(false);
  });
});
