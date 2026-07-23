import React from 'react';
import { ShopIcon, SI } from './ShopIcon';

import './PageFeedback.css';
import ShopButton from './ShopButton';

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
      <ShopButton
        key="retry"
        type="primary"
        icon={<ShopIcon path={SI.reload} />}
        aria-label={retryLabel}
        title={retryLabel}
        onClick={onRetry}
      >
        {retryLabel}
      </ShopButton>
    ) : null,
    onHome && homeLabel ? (
      <ShopButton
        key="home"
        icon={<ShopIcon path={SI.home} />}
        aria-label={homeLabel}
        title={homeLabel}
        onClick={onHome}
      >
        {homeLabel}
      </ShopButton>
    ) : null,
  ].filter(Boolean);

  const multipathActions = Array.isArray(actions) && actions.length > 0
    ? actions.map((action, index) => (
      <ShopButton
        key={action.key}
        type={action.type || (index === 0 ? 'primary' : 'default')}
        icon={action.icon || (index === 0 ? <ShopIcon path={SI.reload} /> : undefined)}
        aria-label={action.label}
        title={action.label}
        onClick={action.onClick}
      >
        {action.label}
      </ShopButton>
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
      <section className="page-feedback__result page-feedback__result--error" role="status">
        <div className="page-feedback__resultIcon" aria-hidden="true" />
        <h2 className="page-feedback__resultTitle">{title}</h2>
        {description ? <div className="page-feedback__resultSubtitle">{description}</div> : null}
        {resolvedActions && resolvedActions.length > 0 ? (
          <div className="page-feedback__resultExtra page-feedback__actions" data-page-error-actions="true">
            {resolvedActions}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default PageError;
