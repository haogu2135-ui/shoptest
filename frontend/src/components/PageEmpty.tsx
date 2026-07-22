import React from 'react';
import { ShopIcon, SI } from './ShopIcon';
import { Button, Empty } from 'antd';
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
      <Empty
        image={image}
        description={description}
      >
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
      </Empty>
    </div>
  );
};

export default PageEmpty;
