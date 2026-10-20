import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDeleteModal, closeDeleteModal, type DeleteModalElements } from './DeleteModal.js';

describe('DeleteModal Component', () => {
  let overlay: HTMLDivElement;
  let titleSpan: HTMLSpanElement;
  let confirmBtn: HTMLButtonElement;
  let cancelBtn: HTMLButtonElement;
  let closeBtn: HTMLButtonElement;
  let elements: DeleteModalElements;

  beforeEach(() => {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    titleSpan = document.createElement('span');
    confirmBtn = document.createElement('button');
    cancelBtn = document.createElement('button');
    closeBtn = document.createElement('button');

    overlay.appendChild(titleSpan);
    overlay.appendChild(confirmBtn);
    overlay.appendChild(cancelBtn);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    elements = {
      overlay,
      titleSpan,
      confirmBtn,
      cancelBtn,
      closeBtn
    };
  });

  it('opens modal, sets book title, and focuses cancel button', async () => {
    const onConfirm = vi.fn();
    openDeleteModal(elements, 'The Odyssey', onConfirm);

    expect(overlay.classList.contains('visible')).toBe(true);
    expect(titleSpan.textContent).toBe('The Odyssey');

    // Wait for focus timeout
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('triggers onConfirm and closes modal when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    openDeleteModal(elements, 'Pride and Prejudice', onConfirm);

    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  it('does not trigger onConfirm and closes modal when cancel button is clicked', () => {
    const onConfirm = vi.fn();
    openDeleteModal(elements, 'Moby Dick', onConfirm);

    cancelBtn.click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  it('closes modal when close (X) button is clicked', () => {
    const onConfirm = vi.fn();
    openDeleteModal(elements, 'Frankenstein', onConfirm);

    closeBtn.click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  it('closes modal when clicking backdrop overlay directly', () => {
    const onConfirm = vi.fn();
    openDeleteModal(elements, 'Dracula', onConfirm);

    // Click backdrop
    const event = new MouseEvent('click', { bubbles: true });
    overlay.dispatchEvent(event);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  it('closes modal manually via closeDeleteModal', () => {
    overlay.classList.add('visible');
    closeDeleteModal(elements);
    expect(overlay.classList.contains('visible')).toBe(false);
  });
});
