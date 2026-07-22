import React from 'react';
import { ShopIcon, SI } from './ShopIcon';
import { Button, Result } from 'antd';
import './PageFeedback.css';

export type PageErrorAction = {
  key: string;
  label: string;
  onClick: () => void;
  type?: 'primary' | 'default' | 'link' | 'dashed' | 'text';
  icon?: React.ReactNode;
};

export type PageErrorProps = {
  title: string;
  description?: React.ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  homeLabel?: string;
  onHome?: () => void;
  /** Commercial multipath recovery exits beyond Retry/Home. */
  actions?: PageErrorAction[];
  className?: string;
};

const PageError: React.FC<PageErrorProps> = ({
  title,
  description,
  retryLabel,
  onRetry,
  homeLabel,
  onHome,
  actions,
  className = '',
}) => {
  const defaultActions = [
    onRetry && retryLabel ? (
      <Button
        key="retry"
        type="primary"
        icon={<ShopIcon path={SI.reload} />}
        aria-label={retryLabel}
        title={retryLabel}
        onClick={onRetry}
      >
        {retryLabel}
      </Button>
    ) : null,
    onHome && homeLabel ? (
      <Button
        key="home"
        icon={<ShopIcon path={SI.home} />}
        aria-label={homeLabel}
        title={homeLabel}
        onClick={onHome}
      >
        {homeLabel}
      </Button>
    ) : null,
  ].filter(Boolean);

  const multipathActions = Array.isArray(actions) && actions.length > 0
    ? actions.map((action, index) => (
      <Button
        key={action.key}
        type={action.type || (index === 0 ? 'primary' : 'default')}
        icon={action.icon || (index === 0 ? <ShopIcon path={SI.reload} /> : undefined)}
        aria-label={action.label}
        title={action.label}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    ))
    : null;

  const resolvedActions = multipathActions || defaultActions;

  return (
    <div
      className={`page-feedback page-feedback--error ${className}`.trim()}
      role="alert"
      aria-live="assertive"
      data-page-error-recovery={multipathActions ? 'true' : undefined}
    >
      <Result
        status="error"
        title={title}
        subTitle={description}
        extra={resolvedActions && resolvedActions.length > 0 ? (
          <div className="page-feedback__actions" data-page-error-actions="true">
            {resolvedActions}
          </div>
        ) : undefined}
      />
    </div>
  );
};

export default PageError;
