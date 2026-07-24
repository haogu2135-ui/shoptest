import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'Checkout.tsx'), 'utf8');
const helpers = fs.readFileSync(path.join(__dirname, '../utils/checkoutHelpers.ts'), 'utf8');

describe('Checkout type-safety guards', () => {
  it('keeps checkout API error handling typed without broad any usage', () => {
    expect(helpers).toContain('type CheckoutErrorResponseLike = {');
    expect(helpers).toContain('export type CheckoutFormValues = {');
    expect(helpers).toContain('status?: unknown;');
    expect(helpers).toContain('export const getCheckoutErrorResponse = (error: unknown)');
    expect(source).toContain('type CheckoutFormValues');
    expect(source).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(source).not.toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).toContain('const [form] = Form.useForm<CheckoutFormValues>();');
    expect(source).toContain('const buildAddress = (values: CheckoutFormValues)');
    expect(source).toContain('const handleSubmit = async (values: CheckoutFormValues)');
    expect(source).toContain('} catch (paymentError: unknown) {');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language)");
    const submitStart = source.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const submitEnd = source.indexOf('const retryCreatePayment = async () => {', submitStart);
    const submitSource = source.slice(submitStart, submitEnd);
    const suggestedStart = source.indexOf('const addSuggestedProduct = async (product: Product) => {');
    const suggestedEnd = source.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {', suggestedStart);
    const suggestedSource = source.slice(suggestedStart, suggestedEnd);
    expect(submitStart).toBeGreaterThan(-1);
    expect(submitEnd).toBeGreaterThan(submitStart);
    expect(suggestedStart).toBeGreaterThan(-1);
    expect(suggestedEnd).toBeGreaterThan(suggestedStart);
    expect(submitSource).toContain("showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));");
    expect(submitSource).not.toMatch(/handleApiError\s*\([^)]*\)\s*;\s*throw\s+(err|error)\s*;/);
    expect(submitSource).not.toMatch(/throw\s+(err|error)\s*;/);
    expect(suggestedSource).not.toContain('handleApiError(');
    expect(suggestedSource).not.toMatch(/handleApiError\s*\([^)]*rethrow:\s*true/);
    expect(source).not.toContain('error: any');
    expect(source).not.toContain('paymentError: any');
    expect(source).not.toContain('values: any');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('as any');
    expect(source).not.toContain('error?.response');
  });

  it('keeps payment lifecycle hook typed without page-level poll lock wiring', () => {
    const lifecycle = fs.readFileSync(path.join(__dirname, '../hooks/useCheckoutPaymentLifecycle.ts'), 'utf8');
    expect(source).toContain("from '../hooks/useCheckoutPaymentLifecycle'");
    expect(source).toContain('useCheckoutPaymentLifecycle({');
    expect(lifecycle).toContain('export const useCheckoutPaymentLifecycle');
    expect(lifecycle).not.toContain('error: any');
    expect(helpers).toContain('export const resolveCheckoutNextActionLabelKey');
    expect(helpers).toContain('export const buildCheckoutOrderActionContext');
  });

});
