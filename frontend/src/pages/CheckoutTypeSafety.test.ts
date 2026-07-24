import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'Checkout.tsx'), 'utf8');
const orderActions = fs.readFileSync(path.join(__dirname, '../hooks/useCheckoutOrderActions.ts'), 'utf8');
const helpers = fs.readFileSync(path.join(__dirname, '../utils/checkoutHelpers.ts'), 'utf8');
const checkoutSurface = `${source}
${orderActions}`;

describe('Checkout type-safety guards', () => {
  it('keeps checkout API error handling typed without broad any usage', () => {
    expect(helpers).toContain('type CheckoutErrorResponseLike = {');
    expect(helpers).toContain('export type CheckoutFormValues = {');
    expect(helpers).toContain('status?: unknown;');
    expect(helpers).toContain('export const getCheckoutErrorResponse = (error: unknown)');
    expect(source).toContain('type CheckoutFormValues');
    expect(orderActions).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(checkoutSurface).not.toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).toContain('const [form] = Form.useForm<CheckoutFormValues>();');
    expect(orderActions).toContain('const buildAddress = (values: CheckoutFormValues)');
    expect(orderActions).toContain('const handleSubmit = async (values: CheckoutFormValues)');
    expect(orderActions).toContain('} catch (paymentError: unknown) {');
    expect(orderActions).toContain('} catch (error: unknown) {');
    expect(orderActions).toContain("getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language)");
    expect(orderActions).toContain("getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language)");
    const submitStart = orderActions.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const submitEnd = orderActions.indexOf('const retryCreatePayment = async () => {', submitStart);
    const submitSource = orderActions.slice(submitStart, submitEnd);
    const suggestedStart = orderActions.indexOf('const addSuggestedProduct = async (product: Product) => {');
    const suggestedEnd = orderActions.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {', suggestedStart);
    const suggestedSource = orderActions.slice(suggestedStart, suggestedEnd);
    expect(submitStart).toBeGreaterThan(-1);
    expect(submitEnd).toBeGreaterThan(submitStart);
    expect(suggestedStart).toBeGreaterThan(-1);
    expect(suggestedEnd).toBeGreaterThan(suggestedStart);
    expect(submitSource).toContain("showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));");
    expect(submitSource).not.toMatch(/handleApiError\s*\([^)]*\)\s*;\s*throw\s+(err|error)\s*;/);
    expect(submitSource).not.toMatch(/throw\s+(err|error)\s*;/);
    expect(suggestedSource).not.toContain('handleApiError(');
    expect(suggestedSource).not.toMatch(/handleApiError\s*\([^)]*rethrow:\s*true/);
    expect(checkoutSurface).not.toContain('error: any');
    expect(checkoutSurface).not.toContain('paymentError: any');
    expect(checkoutSurface).not.toContain('values: any');
    expect(checkoutSurface).not.toContain('catch (error: any)');
    expect(checkoutSurface).not.toContain('as any');
    expect(checkoutSurface).not.toContain('error?.response');
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
