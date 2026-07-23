import React from 'react';
import './ShopSpin.css';

export type ShopSpinSize = 'small' | 'default' | 'large';

export type ShopSpinProps = {
  spinning?: boolean;
  size?: ShopSpinSize;
  tip?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  'aria-label'?: string;
};

const ShopSpin: React.FC<ShopSpinProps> = ({
  spinning = true,
  size = 'default',
  tip,
  className = '',
  style,
  children,
  'aria-label': ariaLabel,
}) => {
  const hasChildren = children != null && children !== false;
  const sizeClass =
    size === 'small' ? 'shop-spin--small ant-spin-sm' : size === 'large' ? 'shop-spin--large ant-spin-lg' : 'shop-spin--default';
  const indicator = spinning ? (
    <span className={['shop-spin__indicator', 'ant-spin', sizeClass, tip ? 'ant-spin-show-text' : ''].filter(Boolean).join(' ')} aria-hidden="true">
      <span className="shop-spin__dot ant-spin-dot ant-spin-dot-spin">
        <i className="ant-spin-dot-item" />
        <i className="ant-spin-dot-item" />
        <i className="ant-spin-dot-item" />
        <i className="ant-spin-dot-item" />
      </span>
      {tip != null && tip !== false && tip !== '' ? <span className="shop-spin__tip ant-spin-text">{tip}</span> : null}
    </span>
  ) : null;

  if (!hasChildren) {
    return (
      <span
        className={['shop-spin', 'shop-spin--standalone', spinning ? 'shop-spin--spinning ant-spin-spinning' : '', className].filter(Boolean).join(' ')}
        style={style}
        role="status"
        aria-live="polite"
        aria-busy={spinning || undefined}
        aria-label={ariaLabel || (typeof tip === 'string' ? tip : 'Loading')}
      >
        {indicator}
      </span>
    );
  }

  return (
    <div
      className={['shop-spin', 'shop-spin--nested', 'ant-spin-nested-loading', className].filter(Boolean).join(' ')}
      style={style}
    >
      {spinning ? (
        <div
          className="shop-spin__overlay ant-spin-container"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={ariaLabel || (typeof tip === 'string' ? tip : 'Loading')}
        >
          {indicator}
        </div>
      ) : null}
      <div className={['shop-spin__content', 'ant-spin-container', spinning ? 'ant-spin-blur' : ''].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
};

export default ShopSpin;
