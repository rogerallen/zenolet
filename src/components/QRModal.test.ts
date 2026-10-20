import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QRCode from 'qrcode';
import { openQRModal, closeQRModal, copyReadingUrl } from './QRModal';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('QRModal component', () => {
  let overlay: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let urlDisplay: HTMLInputElement;
  let copyBtn: HTMLButtonElement;

  beforeEach(() => {
    vi.clearAllMocks();
    overlay = document.createElement('div');
    canvas = document.createElement('canvas');
    urlDisplay = document.createElement('input');
    copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Link';
    document.body.appendChild(overlay);
    document.body.appendChild(canvas);
    document.body.appendChild(urlDisplay);
    document.body.appendChild(copyBtn);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('opens modal, sets URL, adds visible class, and calls QRCode.toCanvas', async () => {
    const testUrl = 'https://zenolet.pages.dev/#s=abc123';
    const selectSpy = vi.spyOn(urlDisplay, 'select');

    vi.useFakeTimers();
    const openPromise = openQRModal(overlay, canvas, urlDisplay, testUrl, copyBtn);

    expect(urlDisplay.value).toBe(testUrl);
    expect(overlay.classList.contains('visible')).toBe(true);

    vi.advanceTimersByTime(60);
    expect(selectSpy).toHaveBeenCalled();
    vi.useRealTimers();

    await openPromise;

    expect(QRCode.toCanvas).toHaveBeenCalledWith(canvas, testUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: '#2c1810',
        light: '#fbf0d9'
      }
    });
  });

  it('resets copy button text and class if previously copied when opening modal', async () => {
    copyBtn.setAttribute('data-original-text', 'Copy Link');
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');

    await openQRModal(overlay, canvas, urlDisplay, 'https://example.com/#s=123', copyBtn);

    expect(copyBtn.textContent).toBe('Copy Link');
    expect(copyBtn.classList.contains('copied')).toBe(false);
  });

  it('handles QRCode rendering failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(QRCode.toCanvas).mockRejectedValueOnce(new Error('Canvas error'));

    const testUrl = 'https://zenolet.pages.dev/#s=error';
    await openQRModal(overlay, canvas, urlDisplay, testUrl);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Zenolet QR] Failed to render QR code:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('closes modal by removing visible class', () => {
    overlay.classList.add('visible');
    closeQRModal(overlay);
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  describe('copyReadingUrl', () => {
    it('copies URL via navigator.clipboard and updates button state temporarily', async () => {
      vi.useFakeTimers();
      urlDisplay.value = 'https://zenolet.pages.dev/#s=test';
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      const result = await copyReadingUrl(urlDisplay, copyBtn, 1500);

      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('https://zenolet.pages.dev/#s=test');
      expect(copyBtn.textContent).toBe('Copied!');
      expect(copyBtn.classList.contains('copied')).toBe(true);

      // Fast forward past timeout
      vi.advanceTimersByTime(1500);
      expect(copyBtn.textContent).toBe('Copy Link');
      expect(copyBtn.classList.contains('copied')).toBe(false);
    });

    it('falls back to document.execCommand when clipboard API throws or is unavailable', async () => {
      urlDisplay.value = 'https://zenolet.pages.dev/#s=fallback';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied'))
        }
      });

      document.execCommand = vi.fn().mockReturnValue(true);

      const result = await copyReadingUrl(urlDisplay, copyBtn, 1000);

      expect(result).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(copyBtn.textContent).toBe('Copied!');
    });

    it('returns false when both clipboard API and execCommand fail', async () => {
      urlDisplay.value = 'https://zenolet.pages.dev/#s=fail';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
        }
      });
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand disabled');
      });

      const result = await copyReadingUrl(urlDisplay, copyBtn);

      expect(result).toBe(false);
      expect(copyBtn.textContent).toBe('Copy Link');
    });

    it('safely returns false if elements are missing', async () => {
      const result = await copyReadingUrl(null as unknown as HTMLInputElement, copyBtn);
      expect(result).toBe(false);
    });
  });
});
