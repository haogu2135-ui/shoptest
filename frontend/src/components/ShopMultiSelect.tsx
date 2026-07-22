import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ShopMultiSelect.css';

export type ShopMultiSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type ShopMultiSelectProps = {
  value?: string[];
  options: ShopMultiSelectOption[];
  // Method syntax keeps callbacks bivariant under strictFunctionTypes.
  onChange?(value: string[]): void;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  onSearch?(query: string): void;
  className?: string;
  popupClassName?: string;
  popupZIndex?: number;
  popupMaxHeight?: number;
  disabled?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  filterOption?: boolean;
  mode?: 'multiple' | 'tags';
  maxCount?: number;
  id?: string;
  ariaLabel?: string;
  title?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyContent?: React.ReactNode;
};

const optionSearchText = (option: ShopMultiSelectOption) => {
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return `${option.label} ${option.value}`.toLowerCase();
  }
  return String(option.value || '').toLowerCase();
};

const normalizeValue = (value?: string[]) => (
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
);

const ShopMultiSelect: React.FC<ShopMultiSelectProps> = ({
  value,
  options,
  onChange,
  open,
  onOpenChange,
  onSearch,
  className = '',
  popupClassName = '',
  popupZIndex = 2400,
  popupMaxHeight = 280,
  disabled = false,
  loading = false,
  allowClear = false,
  showSearch = true,
  filterOption = true,
  mode = 'multiple',
  maxCount,
  id,
  ariaLabel,
  title,
  placeholder = '',
  searchPlaceholder = '',
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
  const selectedValues = useMemo(() => normalizeValue(value), [value]);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setSearchQuery('');
  };

  const optionMap = useMemo(() => {
    const map = new Map<string, ShopMultiSelectOption>();
    options.forEach((option) => map.set(option.value, option));
    return map;
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!showSearch || !filterOption) return options;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => optionSearchText(option).includes(query));
  }, [filterOption, options, searchQuery, showSearch]);

  const selectedLabels = selectedValues.map((item) => {
    const option = optionMap.get(item);
    if (option && (typeof option.label === 'string' || typeof option.label === 'number')) {
      return String(option.label);
    }
    return item;
  });

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 180);
      const searchOffset = showSearch ? 52 : 0;
      const estimatedHeight = (filteredOptions.length > 0
        ? Math.min(popupMaxHeight, filteredOptions.length * 44 + 16)
        : Math.min(popupMaxHeight, 180)) + searchOffset;
      let left = rect.left;
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
        minWidth: width,
        maxHeight: popupMaxHeight + searchOffset,
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
  }, [filteredOptions.length, popupMaxHeight, popupZIndex, resolvedOpen, showSearch]);

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

  useEffect(() => {
    if (!resolvedOpen || !showSearch) return;
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedOpen, showSearch]);

  const isDisabled = disabled || loading;
  const resolvedSearchPlaceholder = searchPlaceholder || placeholder || 'Search';
  const displayText = selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder;
  const triggerLabel = selectedLabels.length > 0 ? selectedLabels.join(', ') : ariaLabel || placeholder || 'Select';
  const showClear = allowClear && selectedValues.length > 0 && !disabled && !loading;
  const atMax = typeof maxCount === 'number' && selectedValues.length >= maxCount;

  const emitChange = (next: string[]) => {
    const unique = Array.from(new Set(next.map((item) => String(item)).filter(Boolean)));
    const limited = typeof maxCount === 'number' ? unique.slice(0, maxCount) : unique;
    onChange?.(limited);
  };

  const toggleValue = (optionValue: string) => {
    if (isDisabled) return;
    if (selectedValues.includes(optionValue)) {
      emitChange(selectedValues.filter((item) => item !== optionValue));
      return;
    }
    if (atMax) return;
    emitChange([...selectedValues, optionValue]);
  };

  const addTagFromQuery = () => {
    if (mode !== 'tags' || isDisabled) return;
    const next = searchQuery.trim();
    if (!next) return;
    if (selectedValues.includes(next)) {
      setSearchQuery('');
      return;
    }
    if (atMax) return;
    emitChange([...selectedValues, next]);
    setSearchQuery('');
  };

  const popup = resolvedOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={listId}
          className={`shop-multi-select__popup ${showSearch ? 'shop-multi-select__popup--searchable' : ''} ${popupClassName}`.trim()}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          style={popupStyle}
        >
          {showSearch ? (
            <div className="shop-multi-select__search" role="presentation">
              <input
                ref={searchRef}
                type="search"
                className="shop-multi-select__searchInput"
                value={searchQuery}
                placeholder={resolvedSearchPlaceholder}
                aria-label={resolvedSearchPlaceholder}
                title={resolvedSearchPlaceholder}
                autoComplete="off"
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchQuery(next);
                  onSearch?.(next);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOpen(false);
                    return;
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (mode === 'tags') {
                      addTagFromQuery();
                      return;
                    }
                    const first = filteredOptions.find((option) => !option.disabled);
                    if (first) toggleValue(first.value);
                  }
                }}
              />
            </div>
          ) : null}
          {filteredOptions.length === 0 ? (
            <div className="shop-multi-select__empty" role="presentation">
              {emptyContent ?? (loading ? 'Loading…' : (mode === 'tags' && searchQuery.trim() ? 'Press Enter to add' : 'No options'))}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const active = selectedValues.includes(option.value);
              const optionLabel = typeof option.label === 'string' ? option.label : option.value;
              const optionDisabled = Boolean(option.disabled || isDisabled || (!active && atMax));
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  className={`shop-multi-select__option${active ? ' shop-multi-select__option--selected' : ''}`.trim()}
                  aria-selected={active}
                  aria-label={optionLabel}
                  title={optionLabel}
                  disabled={optionDisabled}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className={`shop-multi-select__check${active ? ' shop-multi-select__check--on' : ''}`} aria-hidden="true" />
                  <span className="shop-multi-select__optionLabel">{option.label}</span>
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
      <div className="shop-multi-select-wrap">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`shop-multi-select ${loading ? 'shop-multi-select--loading' : ''} ${className}`.trim()}
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
        >
          <span className={`shop-multi-select__value${selectedValues.length ? '' : ' shop-multi-select__value--placeholder'}`}>
            {displayText}
          </span>
          <span className={`shop-multi-select__arrow${loading ? ' shop-multi-select__arrow--loading' : ''}`} aria-hidden="true" />
        </button>
        {showClear ? (
          <button
            type="button"
            className="shop-multi-select__clear"
            aria-label="Clear"
            title="Clear"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              emitChange([]);
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {selectedValues.length > 0 ? (
        <div className="shop-multi-select__chips" aria-label={ariaLabel || 'Selected'}>
          {selectedValues.map((item) => {
            const option = optionMap.get(item);
            const label = option && typeof option.label === 'string' ? option.label : item;
            return (
              <button
                key={item}
                type="button"
                className="shop-multi-select__chip"
                disabled={isDisabled}
                aria-label={`Remove ${label}`}
                title={`Remove ${label}`}
                onClick={() => {
                  if (isDisabled) return;
                  emitChange(selectedValues.filter((entry) => entry !== item));
                }}
              >
                <span>{label}</span>
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {popup}
    </>
  );
};

export default ShopMultiSelect;
