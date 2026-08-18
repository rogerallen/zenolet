// --- Settings Modal Component ---
import { setTheme, setFontSize, setLayoutColumns, type ReaderState } from './ReaderEngine.js';

export function setupSettingsModal(
  panel: HTMLDivElement,
  toggleBtns: HTMLElement | (HTMLElement | null)[],
  state: ReaderState,
  onRecalculate: () => void
): void {
  const buttons = (Array.isArray(toggleBtns) ? toggleBtns : [toggleBtns]).filter((b): b is HTMLElement => b !== null);
  let lastActiveButton: HTMLElement | null = null;

  panel.setAttribute('aria-modal', 'true');

  const openPanel = (btn: HTMLElement) => {
    lastActiveButton = btn;
    if (btn.id === 'library-settings-toggle') {
      panel.classList.add('panel-from-footer');
    } else {
      panel.classList.remove('panel-from-footer');
    }
    panel.classList.add('visible');
    setTimeout(() => {
      const activeBtn =
        panel.querySelector<HTMLElement>('.theme-btn.active') || panel.querySelector<HTMLElement>('.theme-btn');
      activeBtn?.focus();
    }, 40);
  };

  const closePanel = () => {
    if (panel.classList.contains('visible')) {
      panel.classList.remove('visible');
      lastActiveButton?.focus();
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.classList.contains('visible')) {
        closePanel();
      } else {
        openPanel(btn);
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target as Node) && !buttons.some((b) => b.contains(e.target as Node))) {
      closePanel();
    }
  });

  // Theme Buttons
  panel.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme') as 'paper' | 'sepia' | 'charcoal' | 'night';
      if (theme) setTheme(theme, state);
    });
  });

  // Font Buttons
  const fontDec = panel.querySelector('#font-decrease') as HTMLButtonElement;
  const fontInc = panel.querySelector('#font-increase') as HTMLButtonElement;

  if (fontDec) {
    fontDec.addEventListener('click', () => {
      if (state.fontSize > 12) {
        setFontSize(state.fontSize - 1, state, onRecalculate);
      }
    });
  }

  if (fontInc) {
    fontInc.addEventListener('click', () => {
      if (state.fontSize < 32) {
        setFontSize(state.fontSize + 1, state, onRecalculate);
      }
    });
  }

  // Column layout buttons
  panel.querySelectorAll('.layout-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cols = btn.getAttribute('data-columns') as 'auto' | '1' | '2';
      if (cols) setLayoutColumns(cols, state, onRecalculate);
    });
  });
}
