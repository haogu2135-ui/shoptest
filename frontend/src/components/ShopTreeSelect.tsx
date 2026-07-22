import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ShopTreeSelect.css';

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

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const selected = useMemo(() => findOption(treeData, value), [treeData, value]);

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
    if (!resolvedOpen || typeof window === 'undefined') return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 160);
      const estimatedHeight = Math.min(popupMaxHeight, 280);
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
        maxHeight: popupMaxHeight,
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
  }, [popupMaxHeight, popupZIndex, resolvedOpen]);

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

  const displayLabel = selected ? optionText(selected) : placeholder;
  const triggerLabel = selected ? optionText(selected) : ariaLabel || placeholder || 'Tree select';
  const showClear = allowClear && value !== undefined && value !== null && value !== '' && !disabled;

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
              className="shop-tree-select__option"
              aria-selected={active}
              aria-label={label}
              title={label}
              disabled={option.disabled || disabled}
              onClick={() => {
                if (option.disabled || disabled) return;
                onChange?.(option.value);
                setOpen(false);
              }}
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
          style={popupStyle}
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
            aria-label="Clear"
            title="Clear"
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
