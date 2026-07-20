import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import { CustomerServiceOutlined, HomeOutlined, ReloadOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { dispatchDomEvent } from '../utils/domEvents';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  homePath?: string;
  homeLabel?: string;
}

type ErrorBoundaryCopy = {
  title: string;
  subtitle: string;
  hint: string;
  retry: string;
  backHome: string;
  browseProducts: string;
  contactSupport: string;
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

  handleBrowseProducts = () => {
    this.reportRecoveryAction('ErrorBoundary browse products');
    this.props.navigate('/products', { replace: true });
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  handleContactSupport = () => {
    this.reportRecoveryAction('ErrorBoundary contact support');
    dispatchDomEvent('shop:open-support', { source: 'error-boundary' });
  };

  render() {
    if (this.state.hasError) {
      const { copy } = this.props;

      return (
        <div className="shop-error-boundary" role="alert" aria-live="assertive">
          <Result
            status="error"
            title={copy.title}
            subTitle={(
              <div className="shop-error-boundary__copy">
                <div>{copy.subtitle}</div>
                <div className="shop-error-boundary__hint">{copy.hint}</div>
              </div>
            )}
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
              <Button
                key="products"
                icon={<ShoppingOutlined />}
                onClick={this.handleBrowseProducts}
              >
                {copy.browseProducts}
              </Button>,
              <Button
                key="support"
                icon={<CustomerServiceOutlined />}
                onClick={this.handleContactSupport}
              >
                {copy.contactSupport}
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
    hint: t('errorBoundary.hint'),
    retry: t('errorBoundary.retry'),
    backHome: t('errorBoundary.backHome'),
    browseProducts: t('errorBoundary.browseProducts'),
    contactSupport: t('errorBoundary.contactSupport'),
  };
  return <ErrorBoundaryInner {...props} copy={copy} navigate={navigate} />;
};

export default ErrorBoundary;
