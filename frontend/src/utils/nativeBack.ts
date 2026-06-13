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

const consumeAntDesignOverlayBack = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const closeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.ant-modal-root .ant-modal-close, .ant-drawer .ant-drawer-close'),
  ).filter((button) => !button.disabled && isVisibleElement(button));
  const topCloseButton = closeButtons[closeButtons.length - 1];
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
  const escapeTargets = [
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
    modal,
    wrap,
    document.body,
    document,
    window,
  ].filter(Boolean) as Array<HTMLElement | Document | Window>;
  escapeTargets.forEach((target) => {
    target.dispatchEvent(new KeyboardEvent('keydown', keyboardInit));
    target.dispatchEvent(new KeyboardEvent('keyup', keyboardInit));
  });
};

const clickConfirmCancelButton = (modal: HTMLElement) => {
  const cancelButtons = Array.from(
    modal.querySelectorAll<HTMLButtonElement>('.ant-modal-confirm-btns button:not(.ant-btn-primary)'),
  ).filter((button) => !button.disabled && isVisibleElement(button));
  const cancelButton = cancelButtons[cancelButtons.length - 1];
  if (!cancelButton) return false;
  cancelButton.click();
  return true;
};

const consumeAntDesignConfirmBack = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const visibleConfirms = Array.from(
    document.querySelectorAll<HTMLElement>('.ant-modal-root .ant-modal-confirm, .ant-modal-confirm'),
  ).filter(isVisibleElement);
  const topConfirm = visibleConfirms[visibleConfirms.length - 1];
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
  const escapeTargets = [
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
    document.body,
    document,
    window,
  ].filter(Boolean) as Array<HTMLElement | Document | Window>;
  escapeTargets.forEach((target) => {
    target.dispatchEvent(new KeyboardEvent('keydown', keyboardInit));
    target.dispatchEvent(new KeyboardEvent('keyup', keyboardInit));
  });

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
  const visiblePopups = Array.from(
    document.querySelectorAll<HTMLElement>(visiblePopupSelector),
  ).filter(isVisibleElement);
  if (visiblePopups.length === 0) return false;
  const topPopup = visiblePopups[visiblePopups.length - 1];
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
