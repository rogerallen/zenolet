// --- QR Code Handoff Overlay Component ---
import QRCode from 'qrcode';

let copyResetTimeout: ReturnType<typeof setTimeout> | null = null;

export async function openQRModal(
  overlay: HTMLDivElement,
  canvas: HTMLCanvasElement,
  urlDisplay: HTMLInputElement,
  fullUrl: string,
  copyBtn?: HTMLButtonElement | null
): Promise<void> {
  urlDisplay.value = fullUrl;
  if (copyBtn) {
    const originalText = copyBtn.getAttribute('data-original-text');
    if (originalText) {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('copied');
    }
  }
  overlay.classList.add('visible');
  setTimeout(() => urlDisplay.select(), 50);

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

export async function copyReadingUrl(
  urlInput: HTMLInputElement,
  copyBtn: HTMLButtonElement,
  timeoutMs: number = 2000
): Promise<boolean> {
  if (!urlInput || !copyBtn) return false;
  const textToCopy = urlInput.value;
  let copied = false;

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    }
  } catch (err) {
    console.warn('[Zenolet QR] navigator.clipboard.writeText failed, falling back:', err);
  }

  if (!copied) {
    try {
      urlInput.select();
      urlInput.setSelectionRange?.(0, 99999);
      copied =
        typeof document !== 'undefined' && typeof document.execCommand === 'function'
          ? document.execCommand('copy')
          : false;
    } catch (err) {
      console.error('[Zenolet QR] Fallback copy failed:', err);
    }
  }

  if (copied) {
    if (copyResetTimeout) {
      clearTimeout(copyResetTimeout);
      copyResetTimeout = null;
    }
    if (!copyBtn.getAttribute('data-original-text')) {
      copyBtn.setAttribute('data-original-text', copyBtn.textContent || 'Copy Link');
    }
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    copyResetTimeout = setTimeout(() => {
      copyBtn.textContent = copyBtn.getAttribute('data-original-text') || 'Copy Link';
      copyBtn.classList.remove('copied');
      copyResetTimeout = null;
    }, timeoutMs);
  }

  return copied;
}
