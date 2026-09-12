import { useCallback, useEffect, useRef } from 'react';

export const NATIVE_BACK_EVENT = 'shop:native-back';

type NativeBackEventDetail = {
  handled: boolean;
};

type NativeBackHandler = () => boolean | void;

let nextHandlerId = 1;
const nativeBackHandlers: Array<{ id: number; handler: NativeBackHandler }> = [];
let lastNativeBackAt = 0;
const NATIVE_BACK_DEBOUNCE_MS = 280;

export const registerNativeBackHandler = (handler: NativeBackHandler) => {
  const entry = { id: nextHandlerId, handler };
  nextHandlerId += 1;
  nativeBackHandlers.push(entry);
  return () => {
    const index = nativeBackHandlers.findIndex((item) => item.id === entry.id);
    if (index >= 0) {
      nativeBackHandlers.splice(index, 1);
    }
  };
};

export const dispatchNativeBackEvent = () => {
  if (typeof window === 'undefined') return false;
  const detail: NativeBackEventDetail = { handled: false };
  const event = new CustomEvent<NativeBackEventDetail>(NATIVE_BACK_EVENT, {
    cancelable: true,
    detail,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented || detail.handled;
};

const isVisibleElement = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && element.getClientRects().length > 0;
};

type NativeBackEscapeTarget = HTMLElement | Document | Window;

const dispatchEscapeKeyEvents = (target: NativeBackEscapeTarget, keyboardInit: KeyboardEventInit) => {
  target.dispatchEvent(new KeyboardEvent('keydown', keyboardInit));
  target.dispatchEvent(new KeyboardEvent('keyup', keyboardInit));
};

const consumeAntDesignOverlayBack = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  let topCloseButton: HTMLButtonElement | null = null;
  const closeButtons = document.querySelectorAll<HTMLButtonElement>('.ant-modal-root .ant-modal-close, .ant-drawer .ant-drawer-close');
  for (let index = 0; index < closeButtons.length; index += 1) {
    const button = closeButtons[index];
    if (!button.disabled && isVisibleElement(button)) topCloseButton = button;
  }
  if (!topCloseButton) return false;
  topCloseButton.click();
  return true;
};

const dispatchConfirmDismissEvents = (modal: HTMLElement) => {
  const keyboardInit: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: 'Escape',
    code: 'Escape',
  };
  const wrap = modal.closest('.ant-modal-wrap') as HTMLElement | null;
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (activeElement) dispatchEscapeKeyEvents(activeElement, keyboardInit);
  dispatchEscapeKeyEvents(modal, keyboardInit);
  if (wrap) dispatchEscapeKeyEvents(wrap, keyboardInit);
  dispatchEscapeKeyEvents(document.body, keyboardInit);
  dispatchEscapeKeyEvents(document, keyboardInit);
  dispatchEscapeKeyEvents(window, keyboardInit);
};

const clickConfirmCancelButton = (modal: HTMLElement) => {
  let cancelButton: HTMLButtonElement | null = null;
  const cancelButtons = modal.querySelectorAll<HTMLButtonElement>('.ant-modal-confirm-btns button:not(.ant-btn-primary)');
  for (let index = 0; index < cancelButtons.length; index += 1) {
    const button = cancelButtons[index];
    if (!button.disabled && isVisibleElement(button)) cancelButton = button;
  }
  if (!cancelButton) return false;
  cancelButton.click();
  return true;
};

const consumeAntDesignConfirmBack = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  let topConfirm: HTMLElement | null = null;
  const visibleConfirmCandidates = document.querySelectorAll<HTMLElement>('.ant-modal-root .ant-modal-confirm, .ant-modal-confirm');
  for (let index = 0; index < visibleConfirmCandidates.length; index += 1) {
    const confirm = visibleConfirmCandidates[index];
    if (isVisibleElement(confirm)) topConfirm = confirm;
  }
  if (!topConfirm) return false;
  if (!clickConfirmCancelButton(topConfirm)) {
    dispatchConfirmDismissEvents(topConfirm);
  }
  return true;
};

const visiblePopupSelector = [
  '.ant-select-dropdown',
  '.ant-dropdown',
  '.ant-popover',
  '.shop-nav__select-popup',
  '.shop-nav__dropdown-popup',
  '.shop-mobile-popup-layer',
].join(', ');

const dispatchPopupDismissEvents = () => {
  const keyboardInit: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: 'Escape',
    code: 'Escape',
  };
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (activeElement) dispatchEscapeKeyEvents(activeElement, keyboardInit);
  dispatchEscapeKeyEvents(document.body, keyboardInit);
  dispatchEscapeKeyEvents(document, keyboardInit);
  dispatchEscapeKeyEvents(window, keyboardInit);

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const clickPopconfirmCancelButton = (popup: HTMLElement) => {
  const cancelButtons = Array.from(
    popup.querySelectorAll<HTMLButtonElement>('.ant-popconfirm-buttons button:not(.ant-btn-primary)'),
  ).filter((button) => !button.disabled && isVisibleElement(button));
  const cancelButton = cancelButtons[cancelButtons.length - 1];
  if (!cancelButton) return false;
  cancelButton.click();
  return true;
};

const consumeAntDesignPopupBack = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  let topPopup: HTMLElement | null = null;
  const popupCandidates = document.querySelectorAll<HTMLElement>(visiblePopupSelector);
  for (let index = 0; index < popupCandidates.length; index += 1) {
    const popup = popupCandidates[index];
    if (isVisibleElement(popup)) topPopup = popup;
  }
  if (!topPopup) return false;
  if (topPopup && topPopup.classList.contains('ant-popover') && clickPopconfirmCancelButton(topPopup)) {
    return true;
  }
  dispatchPopupDismissEvents();
  return true;
};

export const consumeNativeBack = () => {
  const now = Date.now();
  if (now - lastNativeBackAt < NATIVE_BACK_DEBOUNCE_MS) {
    return true;
  }
  lastNativeBackAt = now;

  const handlers = [...nativeBackHandlers];
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    const entry = handlers[index];
    if (!nativeBackHandlers.some((item) => item.id === entry.id)) {
      continue;
    }
    const handled = entry.handler();
    if (handled !== false) {
      return true;
    }
  }
  return dispatchNativeBackEvent()
    || consumeAntDesignPopupBack()
    || consumeAntDesignConfirmBack()
    || consumeAntDesignOverlayBack();
};

export const useNativeBackHandler = (enabled: boolean, handler: NativeBackHandler) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const stableHandler = useCallback(() => handlerRef.current(), []);

  useEffect(() => {
    if (!enabled) return;
    return registerNativeBackHandler(stableHandler);
  }, [enabled, stableHandler]);
};
