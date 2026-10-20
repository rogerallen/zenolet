// --- Download / Connection Error Modal Component ---

export interface ErrorModalElements {
  overlay: HTMLElement;
  titleElement?: HTMLElement | null;
  messageElement?: HTMLElement | null;
  subtextElement?: HTMLElement | null;
  retryBtn: HTMLElement;
  cancelBtn: HTMLElement;
  closeBtn?: HTMLElement | null;
}

export interface OpenErrorModalOptions {
  title?: string;
  message: string;
  subtext?: string;
  onRetry: () => void;
  onCancel?: () => void;
}

export function openErrorModal(elements: ErrorModalElements, options: OpenErrorModalOptions): void {
  if (elements.titleElement && options.title) {
    elements.titleElement.textContent = options.title;
  }
  if (elements.messageElement) {
    elements.messageElement.textContent = options.message;
  }
  if (elements.subtextElement && options.subtext) {
    elements.subtextElement.textContent = options.subtext;
  }
  elements.overlay.classList.add('visible');

  // Retry button receives default focus
  setTimeout(() => {
    elements.retryBtn.focus();
  }, 40);

  const cleanup = () => {
    elements.retryBtn.removeEventListener('click', handleRetry);
    elements.cancelBtn.removeEventListener('click', handleCancel);
    elements.closeBtn?.removeEventListener('click', handleCancel);
    elements.overlay.removeEventListener('click', handleBackdrop);
  };

  const handleRetry = () => {
    closeErrorModal(elements);
    cleanup();
    options.onRetry();
  };

  const handleCancel = () => {
    closeErrorModal(elements);
    cleanup();
    options.onCancel?.();
  };

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === elements.overlay) {
      handleCancel();
    }
  };

  elements.retryBtn.addEventListener('click', handleRetry);
  elements.cancelBtn.addEventListener('click', handleCancel);
  elements.closeBtn?.addEventListener('click', handleCancel);
  elements.overlay.addEventListener('click', handleBackdrop);
}

export function closeErrorModal(elements: ErrorModalElements): void {
  elements.overlay.classList.remove('visible');
}
