import React, { useMemo } from 'react';
import './ShopSegmented.css';

export type ShopSegmentedOption = {
  label: React.ReactNode;
  value: string;
  disabled?: boolean;
};

export type ShopSegmentedProps = {
  value?: string;
  options: ShopSegmentedOption[];
  // Method syntax keeps callbacks bivariant under strictFunctionTypes.
  onChange?(value: string): void;
  block?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
};

const ShopSegmented: React.FC<ShopSegmentedProps> = ({
  value = '',
  options,
  onChange,
  block = false,
  className = '',
  ariaLabel,
  title,
}) => {
  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [options]);
  const enabledOptions = normalizedOptions.filter((option) => !option.disabled);
  const fallbackTabValue = normalizedOptions.some((option) => option.value === value && !option.disabled)
    ? value
    : enabledOptions[0]?.value;
  if (!options.length) return null;

  return (
    <div
      className={`shop-segmented${block ? ' shop-segmented--block' : ''} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
      title={title}
    >
      <div className="shop-segmented__group">
        {normalizedOptions.map((option) => {
          const selected = option.value === fallbackTabValue;
          const optionLabel = typeof option.label === 'string' ? option.label : option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={`shop-segmented__item${selected ? ' shop-segmented__item--selected' : ''}`}
              aria-checked={selected}
              aria-label={optionLabel}
              title={optionLabel}
              disabled={option.disabled}
              data-value={option.value}
              tabIndex={selected || (!fallbackTabValue && option === enabledOptions[0]) ? 0 : -1}
              onClick={() => {
                if (!option.disabled && !selected) onChange?.(option.value);
              }}
              onKeyDown={(event) => {
                if (option.disabled || enabledOptions.length < 2) return;
                const currentIndex = enabledOptions.findIndex((item) => item.value === option.value);
                const nextIndex = event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? enabledOptions.length - 1
                    : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? (currentIndex + 1) % enabledOptions.length
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? (currentIndex - 1 + enabledOptions.length) % enabledOptions.length
                        : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                const next = enabledOptions[nextIndex];
                onChange?.(next.value);
                const nextButton = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-value]') || [])
                  .find((button) => button.dataset.value === next.value);
                nextButton?.focus();
              }}
            >
              <span className="shop-segmented__label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ShopSegmented;
