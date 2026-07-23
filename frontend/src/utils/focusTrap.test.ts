import { activateFocusTrap, getFocusableElements } from './focusTrap';

describe('focusTrap', () => {
  it('finds focusable elements and excludes masked controls', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button type="button" class="keep">A</button>
      <button type="button" class="shop-drawer__mask" disabled>Mask</button>
      <button type="button" class="shop-drawer__mask">MaskB</button>
      <button type="button" disabled>Disabled</button>
      <input type="text" value="x" />
      <input type="hidden" value="h" />
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root, { excludeClassNames: ['shop-drawer__mask'] });
    expect(focusables.map((el) => el.tagName + (el.className ? ' ' + el.className : ''))).toEqual(['BUTTON keep', 'INPUT']);
    root.remove();
  });

  it('traps Tab within the panel and restores previous focus on cleanup', () => {
    jest.useFakeTimers();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    const panel = document.createElement('div');
    panel.tabIndex = -1;
    panel.innerHTML = `
      <button type="button" class="first">First</button>
      <button type="button" class="last">Last</button>
    `;
    document.body.appendChild(panel);

    const onEscape = jest.fn();
    const cleanup = activateFocusTrap({
      getPanel: () => panel,
      getInitialFocus: () => panel.querySelector('.first') as HTMLElement,
      onEscape,
      initialFocusDelayMs: 0,
    });

    jest.runOnlyPendingTimers();
    expect(panel.querySelector('.first')).toHaveFocus();

    const last = panel.querySelector('.last') as HTMLButtonElement;
    last.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(panel.querySelector('.first')).toHaveFocus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(last).toHaveFocus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalled();

    cleanup();
    expect(trigger).toHaveFocus();
    panel.remove();
    trigger.remove();
    jest.useRealTimers();
  });
});
