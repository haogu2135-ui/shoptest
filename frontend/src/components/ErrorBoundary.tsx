import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { reportNonBlockingError } from '../utils/nonBlockingError';

interface Props {
  children: ReactNode;
  homePath?: string;
  homeLabel?: string;
}

type ErrorBoundaryCopy = {
  title: string;
  subtitle: string;
  retry: string;
  backHome: string;
};

type InnerProps = Props & {
  copy: ErrorBoundaryCopy;
  navigate: NavigateFunction;
};

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportNonBlockingError('ErrorBoundary caught', {
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.props.navigate(this.props.homePath || '/', { replace: true });
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { copy } = this.props;

      return (
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <Result
            status="error"
            title={copy.title}
            subTitle={copy.subtitle}
            extra={[
              <Button
                key="retry"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                {copy.retry}
              </Button>,
              <Button
                key="home"
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
              >
                {this.props.homeLabel || copy.backHome}
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundary: React.FC<Props> = (props) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const copy = {
    title: t('errorBoundary.title'),
    subtitle: t('errorBoundary.subtitle'),
    retry: t('errorBoundary.retry'),
    backHome: t('errorBoundary.backHome'),
  };
  return <ErrorBoundaryInner {...props} copy={copy} navigate={navigate} />;
};

export default ErrorBoundary;
