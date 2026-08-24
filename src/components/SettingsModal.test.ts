import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSettingsModal } from './SettingsModal.js';
import type { ReaderState } from './ReaderEngine.js';

describe('SettingsModal Component', () => {
  let panel: HTMLDivElement;
  let readerSettingsBtn: HTMLButtonElement;
  let librarySettingsBtn: HTMLButtonElement;
  let state: ReaderState;
  let onRecalculate: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="settings-toggle">Reader Settings</button>
      <button id="library-settings-toggle">Library Settings</button>
      <div id="settings-panel" class="settings-panel">
        <div class="settings-group">
          <span class="settings-label">Theme</span>
          <div class="theme-options">
            <button class="theme-btn active" data-theme="paper">Paper</button>
            <button class="theme-btn" data-theme="sepia">Sepia</button>
            <button class="theme-btn" data-theme="slate">Slate</button>
            <button class="theme-btn" data-theme="night">Night</button>
          </div>
        </div>
        <div class="settings-group">
          <span class="settings-label">Font Size</span>
          <div class="font-controls">
            <button id="font-decrease" class="btn-font">A-</button>
            <span id="font-size-display">18px</span>
            <button id="font-increase" class="btn-font">A+</button>
          </div>
        </div>
        <div class="settings-group">
          <span class="settings-label">Layout Columns</span>
          <div class="layout-options">
            <button class="layout-btn active" data-columns="auto">Auto</button>
            <button class="layout-btn" data-columns="1">1 Col</button>
            <button class="layout-btn" data-columns="2">2 Col</button>
            <button class="layout-btn" data-columns="3">3 Col</button>
          </div>
        </div>
      </div>
    `;

    panel = document.getElementById('settings-panel') as HTMLDivElement;
    readerSettingsBtn = document.getElementById('settings-toggle') as HTMLButtonElement;
    librarySettingsBtn = document.getElementById('library-settings-toggle') as HTMLButtonElement;

    state = {
      currentView: 'library',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: 'auto',
      currentPageSpread: 1,
      totalPagesSpreads: 1
    };

    onRecalculate = vi.fn();
  });

  it('toggles settings panel visibility and handles header vs footer positioning', () => {
    setupSettingsModal(panel, [readerSettingsBtn, librarySettingsBtn], state, onRecalculate);

    // Click reader settings button
    readerSettingsBtn.click();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(panel.classList.contains('panel-from-footer')).toBe(false);

    // Toggle close
    readerSettingsBtn.click();
    expect(panel.classList.contains('visible')).toBe(false);

    // Click library footer settings button
    librarySettingsBtn.click();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(panel.classList.contains('panel-from-footer')).toBe(true);
  });

  it('closes settings panel when clicking outside', () => {
    setupSettingsModal(panel, [readerSettingsBtn, librarySettingsBtn], state, onRecalculate);

    readerSettingsBtn.click();
    expect(panel.classList.contains('visible')).toBe(true);

    document.body.click();
    expect(panel.classList.contains('visible')).toBe(false);
  });

  it('updates theme and active button outline state when a theme button is clicked', () => {
    setupSettingsModal(panel, [readerSettingsBtn], state, onRecalculate);

    const paperBtn = panel.querySelector('.theme-btn[data-theme="paper"]') as HTMLButtonElement;
    const sepiaBtn = panel.querySelector('.theme-btn[data-theme="sepia"]') as HTMLButtonElement;

    sepiaBtn.click();

    expect(state.theme).toBe('sepia');
    expect(document.body.getAttribute('data-theme')).toBe('sepia');
    expect(sepiaBtn.classList.contains('active')).toBe(true);
    expect(paperBtn.classList.contains('active')).toBe(false);
  });

  it('adjusts font size and triggers recalculate when increase/decrease is clicked', () => {
    setupSettingsModal(panel, [readerSettingsBtn], state, onRecalculate);

    const fontInc = panel.querySelector('#font-increase') as HTMLButtonElement;
    fontInc.click();

    expect(state.fontSize).toBe(19);
    expect(onRecalculate).toHaveBeenCalled();

    const fontDec = panel.querySelector('#font-decrease') as HTMLButtonElement;
    fontDec.click();

    expect(state.fontSize).toBe(18);
  });

  it('updates layout columns and triggers recalculate', () => {
    setupSettingsModal(panel, [readerSettingsBtn], state, onRecalculate);

    const twoColBtn = panel.querySelector('.layout-btn[data-columns="2"]') as HTMLButtonElement;
    twoColBtn.click();

    expect(state.layoutColumns).toBe('2');
    expect(onRecalculate).toHaveBeenCalled();

    const threeColBtn = panel.querySelector('.layout-btn[data-columns="3"]') as HTMLButtonElement;
    threeColBtn.click();

    expect(state.layoutColumns).toBe('3');
    expect(onRecalculate).toHaveBeenCalledTimes(2);
  });
});
