import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  language?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const translations: Record<string, { title: string; subtitle: string; retry: string; home: string }> = {
  en: {
    title: 'Something Went Wrong',
    subtitle: 'An unexpected error occurred. Please try again.',
    retry: 'Try Again',
    home: 'Back to Home',
  },
  zh: {
    title: '出了点问题',
    subtitle: '发生了意外错误，请重试。',
    retry: '重试',
    home: '返回首页',
  },
  es: {
    title: 'Algo Salió Mal',
    subtitle: 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.',
    retry: 'Reintentar',
    home: 'Volver al Inicio',
  },
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const lang = this.props.language || 'en';
      const t = translations[lang] || translations.en;

      return (
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <Result
            status="error"
            title={t.title}
            subTitle={t.subtitle}
            extra={[
              <Button
                key="retry"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                {t.retry}
              </Button>,
              <Button
                key="home"
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
              >
                {t.home}
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
