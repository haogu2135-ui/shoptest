import React from 'react';
import './ShopSegmented.css';

export type ShopSegmentedOption = {
  label: React.ReactNode;
  value: string;
};

export type ShopSegmentedProps = {
  value: string;
  options: ShopSegmentedOption[];
  onChange: (value: string) => void;
  block?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
};

const ShopSegmented: React.FC<ShopSegmentedProps> = ({
  value,
  options,
  onChange,
  block = false,
  className = '',
  ariaLabel,
  title,
}) => {
  if (!options.length) return null;

  return (
    <div
      className={`shop-segmented${block ? ' shop-segmented--block' : ''} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
      title={title}
    >
      <div className="shop-segmented__group">
        {options.map((option) => {
          const selected = option.value === value;
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
              onClick={() => {
                if (!selected) onChange(option.value);
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
