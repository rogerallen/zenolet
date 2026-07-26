// --- QR Code Handoff Overlay Component ---
import QRCode from 'qrcode';

export async function openQRModal(
  overlay: HTMLDivElement,
  canvas: HTMLCanvasElement,
  urlDisplay: HTMLInputElement,
  fullUrl: string
): Promise<void> {
  urlDisplay.value = fullUrl;
  overlay.classList.add('visible');

  try {
    await QRCode.toCanvas(canvas, fullUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: '#2c1810',
        light: '#fbf0d9'
      }
    });
  } catch (err) {
    console.error('[Zenolet QR] Failed to render QR code:', err);
  }
}

export function closeQRModal(overlay: HTMLDivElement): void {
  overlay.classList.remove('visible');
}
