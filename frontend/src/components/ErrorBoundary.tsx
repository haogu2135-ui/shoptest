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
  retryKey: number;
}

class ErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportNonBlockingError('ErrorBoundary caught', {
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  reportRecoveryAction = (context: string) => {
    reportNonBlockingError(context, this.state.error || 'ErrorBoundary recovery action');
  };

  handleRetry = () => {
    this.reportRecoveryAction('ErrorBoundary retry');
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  handleGoHome = () => {
    this.reportRecoveryAction('ErrorBoundary go home');
    this.props.navigate(this.props.homePath || '/', { replace: true });
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
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

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
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
