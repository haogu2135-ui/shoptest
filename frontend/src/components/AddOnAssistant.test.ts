import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'AddOnAssistant.tsx'), 'utf8');

describe('AddOnAssistant type-safety guards', () => {
  it('keeps add-on render failures isolated behind a local error boundary', () => {
    const boundaryStart = source.indexOf('class AddOnAssistantErrorBoundary extends Component<AddOnAssistantErrorBoundaryProps, AddOnAssistantErrorBoundaryState> {');
    const boundaryEnd = source.indexOf('const AddOnAssistantContent', boundaryStart);
    const boundarySource = source.slice(boundaryStart, boundaryEnd);
    const wrapperStart = source.indexOf('const AddOnAssistant: React.FC<AddOnAssistantProps> = (props) => {');
    const wrapperEnd = source.indexOf('export default AddOnAssistant;', wrapperStart);
    const wrapperSource = source.slice(wrapperStart, wrapperEnd);

    expect(boundaryStart).toBeGreaterThan(-1);
    expect(boundaryEnd).toBeGreaterThan(boundaryStart);
    expect(boundarySource).toContain('static getDerivedStateFromError(): AddOnAssistantErrorBoundaryState');
    expect(boundarySource).toContain('return { hasError: true };');
    expect(boundarySource).toContain('componentDidCatch(error: Error, errorInfo: ErrorInfo)');
    expect(boundarySource).toContain("reportNonBlockingError('AddOnAssistant.render', {");
    expect(boundarySource).toContain('componentStack: errorInfo.componentStack');
    expect(boundarySource).toContain('if (this.state.hasError) return null;');
    expect(boundarySource).toContain('prevProps.resetKey !== this.props.resetKey');
    expect(wrapperStart).toBeGreaterThan(-1);
    expect(wrapperEnd).toBeGreaterThan(wrapperStart);
    expect(wrapperSource).toContain('<AddOnAssistantErrorBoundary resetKey={resetKey}>');
    expect(wrapperSource).toContain('<AddOnAssistantContent {...props} />');
    expect(wrapperSource).toContain('</AddOnAssistantErrorBoundary>');
  });

  it('keeps add-on quick-add error handling typed without broad any usage', () => {
    const handleStart = source.indexOf('const handleAdd = async (product: Product) => {');
    const handleEnd = source.indexOf('if (!conversionConfig.addOnAssistant.enabled || remainingAmount <= 0) return null;', handleStart);
    const handleSource = source.slice(handleStart, handleEnd);

    expect(handleStart).toBeGreaterThan(-1);
    expect(handleEnd).toBeGreaterThan(handleStart);
    expect(handleSource).toContain('try {');
    expect(handleSource).toContain('await onAdd(product);');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('messages.addFailed'), language)");
    expect(handleSource).toContain("message.error(getApiErrorMessage(error, t('messages.addFailed'), language));");
    expect(handleSource).not.toMatch(/handleApiError\s*\([^)]*rethrow:\s*true/);
    expect(handleSource).not.toMatch(/throw\s+(err|error)\s*;/);
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });

  it('keeps the loading skeleton announced as a busy status region', () => {
    const loadingStart = source.indexOf('if (loading) {');
    const loadingEnd = source.indexOf('if (suggestions.length === 0) return null;', loadingStart);
    const loadingSource = source.slice(loadingStart, loadingEnd);

    expect(loadingStart).toBeGreaterThan(-1);
    expect(loadingEnd).toBeGreaterThan(loadingStart);
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain('aria-busy="true"');
    expect(loadingSource).toContain("aria-label={`${t('pages.addOnAssistant.title')}: ${t('common.loading')}`}");
    expect(loadingSource).toContain('<Skeleton active paragraph={{ rows: 2 }} />');
  });
});
