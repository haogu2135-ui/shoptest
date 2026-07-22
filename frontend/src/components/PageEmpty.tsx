import React from 'react';
import { ShopIcon, SI } from './ShopIcon';
import { Button } from 'antd';
import './PageFeedback.css';

export type PageEmptyAction = {
  key: string;
  label: string;
  onClick: () => void;
  type?: 'primary' | 'default' | 'link' | 'dashed' | 'text';
  icon?: React.ReactNode;
};

export type PageEmptyProps = {
  description: React.ReactNode;
  image?: React.ReactNode;
  primaryAction?: PageEmptyAction;
  secondaryAction?: PageEmptyAction;
  actions?: PageEmptyAction[];
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

const PageEmpty: React.FC<PageEmptyProps> = ({
  description,
  image,
  primaryAction,
  secondaryAction,
  actions,
  className = '',
  ...rest
}) => {
  const resolvedActions = actions
    || [primaryAction, secondaryAction].filter(Boolean) as PageEmptyAction[];

  return (
    <div
      className={`page-feedback page-feedback--empty ${className}`.trim()}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <div className="page-feedback__empty">
        <div className="page-feedback__emptyImage" aria-hidden="true">
          {image ?? <span className="page-feedback__emptyIcon"><ShopIcon path={SI.shopping} /></span>}
        </div>
        <div className="page-feedback__emptyDescription">{description}</div>
        {resolvedActions.length > 0 ? (
          <div className="page-feedback__actions">
            {resolvedActions.map((action, index) => (
              <Button
                key={action.key}
                type={action.type || (index === 0 ? 'primary' : 'default')}
                icon={action.icon || (index === 0 ? <ShopIcon path={SI.shopping} /> : <ShopIcon path={SI.home} />)}
                aria-label={action.label}
                title={action.label}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PageEmpty;
