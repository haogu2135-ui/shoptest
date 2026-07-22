import React, { Component, ErrorInfo, ReactNode } from 'react';
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
  browseCoupons: string;
  trackOrder: string;
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

  handleBrowseCoupons = () => {
    this.reportRecoveryAction('ErrorBoundary browse coupons');
    this.props.navigate('/coupons', { replace: true });
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  handleTrackOrder = () => {
    this.reportRecoveryAction('ErrorBoundary track order');
    this.props.navigate('/track-order', { replace: true });
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const { copy } = this.props;
      const homeLabel = this.props.homeLabel || copy.backHome;

      return (
        <div className="shop-error-boundary" data-error-boundary-recovery="true" role="alert" aria-live="assertive">
          <div className="shop-error-boundary__panel">
            <p className="shop-error-boundary__eyebrow" aria-hidden="true">!</p>
            <h1 className="shop-error-boundary__title">{copy.title}</h1>
            <div className="shop-error-boundary__copy">
              <div>{copy.subtitle}</div>
              <div className="shop-error-boundary__hint">{copy.hint}</div>
            </div>
            <div className="shop-error-boundary__actions">
              <button type="button" className="shop-error-boundary__btn shop-error-boundary__btn--primary" onClick={this.handleRetry}>
                {copy.retry}
              </button>
              <button type="button" className="shop-error-boundary__btn" onClick={this.handleGoHome}>
                {homeLabel}
              </button>
              <button type="button" className="shop-error-boundary__btn" onClick={this.handleBrowseProducts}>
                {copy.browseProducts}
              </button>
              <button type="button" className="shop-error-boundary__btn" onClick={this.handleBrowseCoupons}>
                {copy.browseCoupons}
              </button>
              <button type="button" className="shop-error-boundary__btn" onClick={this.handleTrackOrder}>
                {copy.trackOrder}
              </button>
              <button type="button" className="shop-error-boundary__btn" onClick={this.handleContactSupport}>
                {copy.contactSupport}
              </button>
            </div>
          </div>
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
    browseCoupons: t('nav.coupons'),
    trackOrder: t('nav.trackOrder'),
    contactSupport: t('errorBoundary.contactSupport'),
  };
  return <ErrorBoundaryInner {...props} copy={copy} navigate={navigate} />;
};

export default ErrorBoundary;
