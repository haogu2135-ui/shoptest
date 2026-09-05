import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cancelScheduledAnimationFrame, scheduleAnimationFrame } from '../utils/animationFrame';

export type ShopCascaderOption = {
  value: string;
  label: string;
  children?: ShopCascaderOption[];
  disabled?: boolean;
};

export type ShopCascaderProps = {
  value?: string[];
  options: ShopCascaderOption[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  popupClassName?: string;
  popupZIndex?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  ariaLabel?: string;
  title?: string;
  allowClear?: boolean;
  clearLabel?: string;
  id?: string;
};

const EMPTY_PATH: string[] = [];

const normalizeOptions = (options: ShopCascaderOption[]): ShopCascaderOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  }).map((option) => ({
    ...option,
    children: option.children ? normalizeOptions(option.children) : undefined,
  }));
};

const findPathLabels = (options: ShopCascaderOption[], path: string[]): string[] => {
  const labels: string[] = [];
  let level = options;
  for (const segment of path) {
    const match = level.find((option) => option.value === segment);
    if (!match) break;
    labels.push(match.label);
    level = match.children || [];
  }
  return labels;
};

const ShopCascader: React.FC<ShopCascaderProps> = ({
  value,
  options,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  popupClassName = '',
  popupZIndex = 2400,
  open,
  onOpenChange,
  ariaLabel,
  title,
  allowClear = false,
  clearLabel = 'Clear',
  id,
}) => {
  const resolvedValue = value || EMPTY_PATH;
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [activePath, setActivePath] = useState<string[]>(resolvedValue);
  const activePathKey = resolvedValue.join('\u0000');
  const safePopupZIndex = Number.isFinite(popupZIndex) ? popupZIndex : 2400;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (resolvedOpen) setActivePath(resolvedValue);
  }, [activePathKey, resolvedOpen]);

  const columns = useMemo(() => {
    const cols: ShopCascaderOption[][] = [normalizedOptions];
    let level = normalizedOptions;
    for (const segment of activePath) {
      const match = level.find((option) => option.value === segment);
      if (!match?.children?.length) break;
      cols.push(match.children);
      level = match.children;
    }
    return cols;
  }, [activePath, normalizedOptions]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return;
    let frameId: number | null = null;
    const updatePosition = () => {
      if (frameId !== null) return;
      frameId = scheduleAnimationFrame(() => {
        frameId = null;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(Math.max(rect.width, columns.length * 148), Math.max(140, window.innerWidth - 16));
        let left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
        let top = rect.bottom + 6;
        const estimatedHeight = 280;
        if (top + estimatedHeight > window.innerHeight - 8) {
          top = Math.max(8, rect.top - 6 - estimatedHeight);
        }
        setPopupStyle({
          position: 'fixed',
          top,
          left,
          minWidth: Math.min(width, window.innerWidth - 16),
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: estimatedHeight,
          zIndex: safePopupZIndex,
        });
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      if (frameId !== null) cancelScheduledAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [columns.length, resolvedOpen, safePopupZIndex]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      document.getElementById(listId)
        ?.querySelector<HTMLButtonElement>('button[role="option"]:not([disabled])')
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [listId, resolvedOpen]);

  useEffect(() => {
    if (!resolvedOpen || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      const popup = document.getElementById(listId);
      if (popup?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [listId, resolvedOpen]);

  const displayLabels = findPathLabels(normalizedOptions, resolvedValue);
  const displayText = displayLabels.length ? displayLabels.join(' / ') : placeholder;
  const triggerLabel = displayLabels.length ? displayText : ariaLabel || placeholder || 'Select region';
  const showClear = allowClear && resolvedValue.length > 0 && !disabled;

  const popup = resolvedOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={listId}
          className={`shop-cascader__popup ${popupClassName}`.trim()}
          role="listbox"
          aria-label={ariaLabel || placeholder || 'Region'}
          aria-multiselectable="false"
          style={popupStyle}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === 'Enter') {
              const activeElement = document.activeElement as HTMLButtonElement | null;
              if (activeElement?.getAttribute('role') === 'option') {
                event.preventDefault();
                activeElement.click();
              }
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const activeElement = document.activeElement as HTMLElement | null;
            const column = activeElement?.closest('.shop-cascader__column');
            const buttons = Array.from(column?.querySelectorAll<HTMLButtonElement>('button[role="option"]:not([disabled])') || []);
            if (!buttons.length) return;
            const currentIndex = buttons.indexOf(activeElement as HTMLButtonElement);
            const nextIndex = event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : currentIndex < 0
                  ? 0
                  : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            event.preventDefault();
            buttons[nextIndex]?.focus();
          }}
        >
          <div className="shop-cascader__columns">
            {columns.map((column, columnIndex) => (
              <div key={`col-${columnIndex}`} className="shop-cascader__column" role="group">
                {column.map((option) => {
                  const selected = activePath[columnIndex] === option.value;
                  const hasChildren = Boolean(option.children?.length);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      className={`shop-cascader__option${selected ? ' shop-cascader__option--selected' : ''}`}
                      aria-selected={selected}
                      aria-label={option.label}
                      title={option.label}
                      disabled={option.disabled || disabled}
                      onClick={() => {
                        if (option.disabled) return;
                        const nextPath = [...activePath.slice(0, columnIndex), option.value];
                        setActivePath(nextPath);
                        if (!hasChildren) {
                          onChange?.(nextPath);
                          setOpen(false);
                        }
                      }}
                    >
                      <span className="shop-cascader__optionLabel">{option.label}</span>
                      {hasChildren ? <span className="shop-cascader__optionChevron" aria-hidden="true">›</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="shop-cascader-wrap">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`shop-cascader ${className}`.trim()}
          aria-label={ariaLabel || triggerLabel}
          title={title || triggerLabel}
          aria-haspopup="listbox"
          aria-expanded={resolvedOpen}
          aria-controls={resolvedOpen ? listId : undefined}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(!resolvedOpen);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!resolvedOpen) setOpen(true);
            }
          }}
        >
          <span className={`shop-cascader__value${displayLabels.length ? '' : ' shop-cascader__value--placeholder'}`}>
            {displayText}
          </span>
          <span className="shop-cascader__arrow" aria-hidden="true" />
        </button>
        {showClear ? (
          <button
            type="button"
            className="shop-cascader__clear"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange?.([]);
              setActivePath([]);
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {popup}
    </>
  );
};

export default ShopCascader;
