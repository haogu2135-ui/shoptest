import React from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import './PageFeedback.css';

export type PageErrorProps = {
  title: string;
  description?: React.ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  homeLabel?: string;
  onHome?: () => void;
  className?: string;
};

const PageError: React.FC<PageErrorProps> = ({
  title,
  description,
  retryLabel,
  onRetry,
  homeLabel,
  onHome,
  className = '',
}) => {
  const actions = [
    onRetry && retryLabel ? (
      <Button
        key="retry"
        type="primary"
        icon={<ReloadOutlined />}
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
        icon={<HomeOutlined />}
        aria-label={homeLabel}
        title={homeLabel}
        onClick={onHome}
      >
        {homeLabel}
      </Button>
    ) : null,
  ].filter(Boolean);

  return (
    <div
      className={`page-feedback page-feedback--error ${className}`.trim()}
      role="alert"
      aria-live="assertive"
    >
      <Result
        status="error"
        title={title}
        subTitle={description}
        extra={actions.length > 0 ? actions : undefined}
      />
    </div>
  );
};

export default PageError;
