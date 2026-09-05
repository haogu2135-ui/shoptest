import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cancelScheduledAnimationFrame, scheduleAnimationFrame } from '../utils/animationFrame';

export type ShopSelectOption = {
  value: string;
  label: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export type ShopSelectProps = {
  value?: string;
  options: ShopSelectOption[];
  // Method syntax keeps callbacks bivariant under strictFunctionTypes (string setters OK).
  onChange?(value: string | undefined): void;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  className?: string;
  popupClassName?: string;
  popupZIndex?: number;
  popupMaxHeight?: number;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  id?: string;
  ariaLabel?: string;
  title?: string;
  placeholder?: string;
  emptyContent?: React.ReactNode;
};

const optionSearchText = (option: ShopSelectOption) => {
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return `${option.label} ${option.value}`.toLowerCase();
  }
  return String(option.value || '').toLowerCase();
};

const ShopSelect: React.FC<ShopSelectProps> = ({
  value,
  options,
  onChange,
  open,
  onOpenChange,
  className = '',
  popupClassName = '',
  popupZIndex = 2400,
  popupMaxHeight = 280,
  size = 'middle',
  disabled = false,
  loading = false,
  allowClear = false,
  clearLabel = 'Clear',
  showSearch = false,
  searchPlaceholder = '',
  id,
  ariaLabel,
  title,
  placeholder = '',
  emptyContent,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isControlled = typeof open === 'boolean';
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [activeOptionValue, setActiveOptionValue] = useState<string | undefined>(value);
  const safePopupMaxHeight = Number.isFinite(popupMaxHeight)
    ? Math.max(120, Math.min(Math.floor(popupMaxHeight), 720))
    : 280;
  const safePopupZIndex = Number.isFinite(popupZIndex) ? popupZIndex : 2400;

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [options]);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setSearchQuery('');
  };

  const selected = useMemo(
    () => normalizedOptions.find((option) => option.value === value),
    [normalizedOptions, value],
  );

  const filteredOptions = useMemo(() => {
    if (!showSearch) return normalizedOptions;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((option) => optionSearchText(option).includes(query));
  }, [normalizedOptions, searchQuery, showSearch]);

  useEffect(() => {
    if (!resolvedOpen) return;
    const firstEnabled = filteredOptions.find((option) => !option.disabled);
    setActiveOptionValue((current) => (
      filteredOptions.some((option) => option.value === current && !option.disabled)
        ? current
        : selected && !selected.disabled ? selected.value : firstEnabled?.value
    ));
  }, [filteredOptions, resolvedOpen, selected]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return;
    let frameId: number | null = null;
    const updatePosition = () => {
      if (frameId !== null) return;
      frameId = scheduleAnimationFrame(() => {
        frameId = null;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const maxWidth = Math.max(window.innerWidth - 16, 140);
        const width = Math.min(Math.max(rect.width, 140), maxWidth);
        const searchOffset = showSearch ? 52 : 0;
        const estimatedHeight = (filteredOptions.length > 0
          ? Math.min(safePopupMaxHeight, filteredOptions.length * 44 + 16)
          : Math.min(safePopupMaxHeight, 180)) + searchOffset;
        let left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
        let top = rect.bottom + 6;
        if (left + width > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - width - 8);
        }
        if (top + estimatedHeight > window.innerHeight - 8) {
          top = Math.max(8, rect.top - 6 - estimatedHeight);
        }
        setPopupStyle({
          position: 'fixed',
          top,
          left,
          width,
          minWidth: width,
          maxWidth: 'calc(100vw - 16px)',
          boxSizing: 'border-box',
          maxHeight: safePopupMaxHeight + searchOffset,
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
  }, [filteredOptions.length, safePopupMaxHeight, safePopupZIndex, resolvedOpen, showSearch]);

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

  useEffect(() => {
    if (!resolvedOpen || !showSearch) return;
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedOpen, showSearch]);

  const displayLabel = selected?.label ?? placeholder;
  const triggerLabel = typeof displayLabel === 'string' ? displayLabel : ariaLabel || placeholder || 'Select';
  const showClear = allowClear && Boolean(value) && !disabled && !loading;
  const isDisabled = disabled || loading;
  const resolvedSearchPlaceholder = searchPlaceholder || placeholder || 'Search';

  const selectActiveOption = () => {
    const option = filteredOptions.find((item) => item.value === activeOptionValue && !item.disabled);
    if (!option || isDisabled) return;
    onChange?.(option.value);
    setOpen(false);
  };

  const moveActiveOption = (direction: 1 | -1, edge?: 'start' | 'end') => {
    const enabledOptions = filteredOptions.filter((option) => !option.disabled);
    if (enabledOptions.length === 0) return;
    if (edge) {
      setActiveOptionValue((edge === 'start' ? enabledOptions[0] : enabledOptions[enabledOptions.length - 1]).value);
      return;
    }
    const currentIndex = enabledOptions.findIndex((option) => option.value === activeOptionValue);
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : enabledOptions.length - 1)
      : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
    setActiveOptionValue(enabledOptions[nextIndex].value);
  };

  const popup = resolvedOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={listId}
          className={`shop-select__popup ${showSearch ? 'shop-select__popup--searchable' : ''} ${popupClassName}`.trim()}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeOptionValue ? `${listId}-option-${filteredOptions.findIndex((option) => option.value === activeOptionValue)}` : undefined}
          aria-busy={loading || undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              moveActiveOption(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              moveActiveOption(-1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              moveActiveOption(1, 'start');
            } else if (event.key === 'End') {
              event.preventDefault();
              moveActiveOption(-1, 'end');
            } else if (event.key === 'Enter') {
              event.preventDefault();
              selectActiveOption();
            }
          }}
          style={popupStyle}
        >
          {showSearch ? (
            <div className="shop-select__search" role="presentation">
              <input
                ref={searchRef}
                type="search"
                className="shop-select__searchInput"
                value={searchQuery}
                placeholder={resolvedSearchPlaceholder}
                aria-label={resolvedSearchPlaceholder}
                title={resolvedSearchPlaceholder}
                autoComplete="off"
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOpen(false);
                  }
                }}
              />
            </div>
          ) : null}
          {filteredOptions.length === 0 ? (
            <div className="shop-select__empty" role="presentation">
              {emptyContent ?? (loading ? 'Loading…' : 'No options')}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const active = option.value === value;
              const optionLabel = typeof option.label === 'string' ? option.label : option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  id={`${listId}-option-${filteredOptions.indexOf(option)}`}
                  className={`shop-select__option${active ? ' shop-select__option--selected' : ''}${activeOptionValue === option.value ? ' shop-select__option--active' : ''} ${option.className || ''}`.trim()}
                  aria-selected={active}
                  aria-label={optionLabel}
                  title={optionLabel}
                  disabled={option.disabled || isDisabled}
                  onClick={() => {
                    if (option.disabled || isDisabled) return;
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveOptionValue(option.value)}
                >
                  <span className="shop-select__optionLabel">{option.label}</span>
                </button>
              );
            })
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className={`shop-select-wrap shop-select-wrap--${size}`.trim()}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`shop-select shop-select--${size}${loading ? ' shop-select--loading' : ''} ${className}`.trim()}
          aria-label={ariaLabel || triggerLabel}
          title={title || triggerLabel}
          aria-haspopup="listbox"
          aria-expanded={resolvedOpen}
          aria-controls={resolvedOpen ? listId : undefined}
          aria-busy={loading || undefined}
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            setOpen(!resolvedOpen);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!resolvedOpen) setOpen(true);
              moveActiveOption(event.key === 'ArrowDown' ? 1 : -1);
            }
          }}
        >
          <span className={`shop-select__value${selected ? '' : ' shop-select__value--placeholder'}`}>{displayLabel}</span>
          <span className={`shop-select__arrow${loading ? ' shop-select__arrow--loading' : ''}`} aria-hidden="true" />
        </button>
        {showClear ? (
          <button
            type="button"
            className="shop-select__clear"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange?.(undefined);
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

export default ShopSelect;
