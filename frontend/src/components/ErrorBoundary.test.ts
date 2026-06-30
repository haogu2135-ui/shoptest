import fs from 'fs';
import path from 'path';

const componentSource = fs.readFileSync(path.join(__dirname, 'ErrorBoundary.tsx'), 'utf8');
const localeData = ['en', 'zh', 'es'].map((locale) => ({
  locale,
  messages: JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${locale}.json`), 'utf8')),
}));

describe('ErrorBoundary i18n fallback guards', () => {
  it('renders fallback copy from locale resources instead of hardcoded visible text', () => {
    expect(componentSource).toContain('const { t } = useLanguage();');
    expect(componentSource).toContain("title: t('errorBoundary.title')");
    expect(componentSource).toContain("subtitle: t('errorBoundary.subtitle')");
    expect(componentSource).toContain("retry: t('errorBoundary.retry')");
    expect(componentSource).toContain("backHome: t('errorBoundary.backHome')");
    expect(componentSource).not.toContain('data-testid="error-fallback"');
    expect(componentSource).not.toContain('title="Error"');
    expect(componentSource).not.toContain('>Error<');
    expect(componentSource).toContain('retryKey: number;');
    expect(componentSource).toContain('retryKey: 0');
    expect(componentSource).toContain('retryKey: prevState.retryKey + 1');
    expect(componentSource).toContain('React.Fragment key={this.state.retryKey}');
    expect(componentSource).toContain("reportNonBlockingError(context, this.state.error || 'ErrorBoundary recovery action');");
    expect(componentSource).toContain("this.reportRecoveryAction('ErrorBoundary retry');");
    expect(componentSource).toContain("this.reportRecoveryAction('ErrorBoundary go home');");
    expect(componentSource.indexOf("this.reportRecoveryAction('ErrorBoundary retry');")).toBeLessThan(
      componentSource.indexOf('this.setState((prevState) => ({'),
    );
    expect(componentSource.indexOf("this.reportRecoveryAction('ErrorBoundary go home');")).toBeLessThan(
      componentSource.indexOf('this.props.navigate(this.props.homePath || \'/\', { replace: true });'),
    );

    for (const { messages } of localeData) {
      expect(messages.errorBoundary.title).toBeTruthy();
      expect(messages.errorBoundary.subtitle).toBeTruthy();
      expect(messages.errorBoundary.retry).toBeTruthy();
      expect(messages.errorBoundary.backHome).toBeTruthy();
    }
  });
});
