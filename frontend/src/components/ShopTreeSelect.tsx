import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ShopTreeSelect.css';
import { cancelScheduledAnimationFrame, scheduleAnimationFrame } from '../utils/animationFrame';

export type ShopTreeSelectOption = {
  value: string | number;
  label: React.ReactNode;
  title?: React.ReactNode;
  disabled?: boolean;
  children?: ShopTreeSelectOption[];
};

export type ShopTreeSelectProps = {
  value?: string | number | null;
  treeData: ShopTreeSelectOption[];
  // Method syntax keeps callbacks bivariant under strictFunctionTypes (number setters OK).
  onChange?(value: string | number | undefined): void;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  className?: string;
  popupClassName?: string;
  popupZIndex?: number;
  popupMaxHeight?: number;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  treeDefaultExpandAll?: boolean;
  id?: string;
  ariaLabel?: string;
  title?: string;
  placeholder?: string;
};

const valueKey = (value: string | number) => String(value);

const findOption = (
  options: ShopTreeSelectOption[],
  value?: string | number | null,
): ShopTreeSelectOption | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const target = valueKey(value);
  for (const option of options) {
    if (valueKey(option.value) === target) return option;
    if (option.children?.length) {
      const nested = findOption(option.children, value);
      if (nested) return nested;
    }
  }
  return undefined;
};

const collectExpandableKeys = (options: ShopTreeSelectOption[]): string[] => {
  const keys: string[] = [];
  const walk = (nodes: ShopTreeSelectOption[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        keys.push(valueKey(node.value));
        walk(node.children);
      }
    });
  };
  walk(options);
  return keys;
};

const collectAncestorKeys = (
  options: ShopTreeSelectOption[],
  value?: string | number | null,
  trail: string[] = [],
): string[] | null => {
  if (value === undefined || value === null || value === '') return null;
  const target = valueKey(value);
  for (const option of options) {
    const key = valueKey(option.value);
    if (key === target) return trail;
    if (option.children?.length) {
      const nested = collectAncestorKeys(option.children, value, [...trail, key]);
      if (nested) return nested;
    }
  }
  return null;
};

const optionText = (option: ShopTreeSelectOption) => {
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return String(option.label);
  }
  if (typeof option.title === 'string' || typeof option.title === 'number') {
    return String(option.title);
  }
  return String(option.value);
};

const ShopTreeSelect: React.FC<ShopTreeSelectProps> = ({
  value,
  treeData,
  onChange,
  open,
  onOpenChange,
  className = '',
  popupClassName = '',
  popupZIndex = 2400,
  popupMaxHeight = 320,
  disabled = false,
  allowClear = false,
  clearLabel = 'Clear',
  treeDefaultExpandAll = false,
  id,
  ariaLabel,
  title,
  placeholder = '',
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => (
    treeDefaultExpandAll
      ? new Set(collectExpandableKeys(treeData))
      : new Set(collectAncestorKeys(treeData, value) || [])
  ));
  const safePopupMaxHeight = Number.isFinite(popupMaxHeight)
    ? Math.max(120, Math.min(Math.floor(popupMaxHeight), 720))
    : 320;
  const safePopupZIndex = Number.isFinite(popupZIndex) ? popupZIndex : 2400;
  const [activeValue, setActiveValue] = useState<string | undefined>(value == null ? undefined : valueKey(value));

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const selected = useMemo(() => findOption(treeData, value), [treeData, value]);

  const visibleOptions = useMemo(() => {
    const result: ShopTreeSelectOption[] = [];
    const walk = (nodes: ShopTreeSelectOption[]) => {
      nodes.forEach((node) => {
        result.push(node);
        if (node.children?.length && expandedKeys.has(valueKey(node.value))) walk(node.children);
      });
    };
    walk(treeData);
    return result;
  }, [expandedKeys, treeData]);

  useEffect(() => {
    if (!resolvedOpen) return;
    const firstEnabled = visibleOptions.find((option) => !option.disabled);
    setActiveValue((current) => (
      visibleOptions.some((option) => valueKey(option.value) === current && !option.disabled)
        ? current
        : selected && !selected.disabled ? valueKey(selected.value) : (firstEnabled ? valueKey(firstEnabled.value) : undefined)
    ));
  }, [resolvedOpen, selected, visibleOptions]);

  useEffect(() => {
    if (!treeDefaultExpandAll) return;
    setExpandedKeys(new Set(collectExpandableKeys(treeData)));
  }, [treeData, treeDefaultExpandAll]);

  useEffect(() => {
    if (treeDefaultExpandAll || value === undefined || value === null) return;
    const ancestors = collectAncestorKeys(treeData, value);
    if (!ancestors?.length) return;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      ancestors.forEach((key) => next.add(key));
      return next;
    });
  }, [treeData, treeDefaultExpandAll, value]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return;
    let frameId: number | null = null;
    const updatePosition = () => {
      if (frameId !== null) return;
      frameId = scheduleAnimationFrame(() => {
        frameId = null;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(Math.max(rect.width, 160), Math.max(140, window.innerWidth - 16));
        const estimatedHeight = Math.min(safePopupMaxHeight, 280);
        let left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
        let top = rect.bottom + 6;
        if (top + estimatedHeight > window.innerHeight - 8) {
          top = Math.max(8, rect.top - 6 - estimatedHeight);
        }
        setPopupStyle({
          position: 'fixed',
          top,
          left,
          minWidth: width,
          maxHeight: safePopupMaxHeight,
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
  }, [safePopupMaxHeight, safePopupZIndex, resolvedOpen]);

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

  const displayLabel = selected ? optionText(selected) : placeholder;
  const triggerLabel = selected ? optionText(selected) : ariaLabel || placeholder || 'Tree select';
  const showClear = allowClear && value !== undefined && value !== null && value !== '' && !disabled;

  const moveActive = (direction: 1 | -1, edge?: 'start' | 'end') => {
    const enabled = visibleOptions.filter((option) => !option.disabled);
    if (!enabled.length) return;
    if (edge) {
      setActiveValue(valueKey(edge === 'start' ? enabled[0].value : enabled[enabled.length - 1].value));
      return;
    }
    const index = enabled.findIndex((option) => valueKey(option.value) === activeValue);
    const next = index < 0 ? (direction > 0 ? 0 : enabled.length - 1) : (index + direction + enabled.length) % enabled.length;
    setActiveValue(valueKey(enabled[next].value));
  };

  const selectActive = () => {
    const option = visibleOptions.find((item) => valueKey(item.value) === activeValue && !item.disabled);
    if (!option || disabled) return;
    onChange?.(option.value);
    setOpen(false);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderNodes = (nodes: ShopTreeSelectOption[], depth: number): React.ReactNode =>
    nodes.map((option) => {
      const key = valueKey(option.value);
      const hasChildren = Boolean(option.children?.length);
      const expanded = expandedKeys.has(key);
      const active = value !== undefined && value !== null && valueKey(value) === key;
      const label = optionText(option);
      return (
        <div key={key} className="shop-tree-select__node" role="presentation">
          <div
            className={`shop-tree-select__row${active ? ' shop-tree-select__row--selected' : ''}${option.disabled ? ' shop-tree-select__row--disabled' : ''}`}
            style={{ paddingLeft: 8 + depth * 16 }}
          >
            {hasChildren ? (
              <button
                type="button"
                className={`shop-tree-select__expand${expanded ? ' shop-tree-select__expand--open' : ''}`}
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                title={expanded ? `Collapse ${label}` : `Expand ${label}`}
                aria-expanded={expanded}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleExpand(key);
                }}
              />
            ) : (
              <span className="shop-tree-select__expandSpacer" aria-hidden="true" />
            )}
            <button
              type="button"
              role="option"
              id={`${listId}-option-${visibleOptions.findIndex((item) => valueKey(item.value) === key)}`}
              className={`shop-tree-select__option${activeValue === key ? ' shop-tree-select__option--active' : ''}`}
              aria-selected={active}
              aria-label={label}
              title={label}
              disabled={option.disabled || disabled}
              onClick={() => {
                if (option.disabled || disabled) return;
                onChange?.(option.value);
                setOpen(false);
              }}
              onMouseEnter={() => setActiveValue(key)}
            >
              {option.label}
            </button>
          </div>
          {hasChildren && expanded ? renderNodes(option.children || [], depth + 1) : null}
        </div>
      );
    });

  const popup = resolvedOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={listId}
          className={`shop-tree-select__popup ${popupClassName}`.trim()}
          role="listbox"
          aria-label={ariaLabel || placeholder || 'Tree select'}
          aria-activedescendant={activeValue ? `${listId}-option-${visibleOptions.findIndex((option) => valueKey(option.value) === activeValue)}` : undefined}
          style={popupStyle}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              moveActive(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              moveActive(-1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              moveActive(1, 'start');
            } else if (event.key === 'End') {
              event.preventDefault();
              moveActive(-1, 'end');
            } else if (event.key === 'Enter') {
              event.preventDefault();
              selectActive();
            }
          }}
        >
          {treeData.length === 0 ? (
            <div className="shop-tree-select__empty" role="presentation">
              No options
            </div>
          ) : (
            renderNodes(treeData, 0)
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="shop-tree-select-wrap">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`shop-tree-select ${className}`.trim()}
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
              moveActive(event.key === 'ArrowDown' ? 1 : -1);
            }
          }}
        >
          <span className={`shop-tree-select__value${selected ? '' : ' shop-tree-select__value--placeholder'}`}>
            {displayLabel}
          </span>
          <span className="shop-tree-select__arrow" aria-hidden="true" />
        </button>
        {showClear ? (
          <button
            type="button"
            className="shop-tree-select__clear"
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

export default ShopTreeSelect;
