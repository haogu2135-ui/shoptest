import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ShopCascader.css';

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
  id?: string;
};

const EMPTY_PATH: string[] = [];

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
  id,
}) => {
  const resolvedValue = value || EMPTY_PATH;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [activePath, setActivePath] = useState<string[]>(resolvedValue);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (resolvedOpen) setActivePath(resolvedValue);
  }, [resolvedOpen, resolvedValue]);

  const columns = useMemo(() => {
    const cols: ShopCascaderOption[][] = [options];
    let level = options;
    for (const segment of activePath) {
      const match = level.find((option) => option.value === segment);
      if (!match?.children?.length) break;
      cols.push(match.children);
      level = match.children;
    }
    return cols;
  }, [activePath, options]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, Math.min(window.innerWidth - 16, columns.length * 148));
      let left = rect.left;
      let top = rect.bottom + 6;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
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
        zIndex: popupZIndex,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [columns.length, popupZIndex, resolvedOpen]);

  useEffect(() => {
    if (!resolvedOpen || typeof document === 'undefined') return undefined;
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

  const displayLabels = findPathLabels(options, resolvedValue);
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
            aria-label="Clear"
            title="Clear"
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
