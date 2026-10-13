import { describe, it, expect, vi, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import { openQRModal, closeQRModal } from './QRModal';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('QRModal component', () => {
  let overlay: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let urlDisplay: HTMLInputElement;

  beforeEach(() => {
    vi.clearAllMocks();
    overlay = document.createElement('div');
    canvas = document.createElement('canvas');
    urlDisplay = document.createElement('input');
    document.body.appendChild(overlay);
    document.body.appendChild(canvas);
    document.body.appendChild(urlDisplay);
  });

  it('opens modal, sets URL, adds visible class, and calls QRCode.toCanvas', async () => {
    const testUrl = 'https://zenolet.pages.dev/#s=abc123';
    const selectSpy = vi.spyOn(urlDisplay, 'select');

    vi.useFakeTimers();
    const openPromise = openQRModal(overlay, canvas, urlDisplay, testUrl);

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
});
