// --- Delete Confirmation Modal Component ---
export interface DeleteModalElements {
  overlay: HTMLElement;
  titleSpan?: HTMLElement | null;
  confirmBtn: HTMLElement;
  cancelBtn: HTMLElement;
  closeBtn?: HTMLElement | null;
}

export function openDeleteModal(elements: DeleteModalElements, bookTitle: string, onConfirm: () => void): void {
  if (elements.titleSpan) {
    elements.titleSpan.textContent = bookTitle;
  }
  elements.overlay.classList.add('visible');

  // Cancel button receives default focus
  setTimeout(() => {
    elements.cancelBtn.focus();
  }, 40);

  const cleanup = () => {
    elements.confirmBtn.removeEventListener('click', handleConfirm);
    elements.cancelBtn.removeEventListener('click', handleCancel);
    elements.closeBtn?.removeEventListener('click', handleCancel);
    elements.overlay.removeEventListener('click', handleBackdrop);
  };

  const handleConfirm = () => {
    closeDeleteModal(elements);
    cleanup();
    onConfirm();
  };

  const handleCancel = () => {
    closeDeleteModal(elements);
    cleanup();
  };

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === elements.overlay) {
      handleCancel();
    }
  };

  elements.confirmBtn.addEventListener('click', handleConfirm);
  elements.cancelBtn.addEventListener('click', handleCancel);
  elements.closeBtn?.addEventListener('click', handleCancel);
  elements.overlay.addEventListener('click', handleBackdrop);
}

export function closeDeleteModal(elements: DeleteModalElements): void {
  elements.overlay.classList.remove('visible');
}
