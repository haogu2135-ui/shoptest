import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'Checkout.tsx'), 'utf8');

describe('Checkout type-safety guards', () => {
  it('keeps checkout API error handling typed without broad any usage', () => {
    expect(source).toContain('type CheckoutErrorResponseLike = {');
    expect(source).toContain('type CheckoutFormValues = {');
    expect(source).toContain('status?: unknown;');
    expect(source).toContain('const getCheckoutErrorResponse = (error: unknown)');
    expect(source).toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).toContain('const [form] = Form.useForm<CheckoutFormValues>();');
    expect(source).toContain('const buildAddress = (values: CheckoutFormValues)');
    expect(source).toContain('const handleSubmit = async (values: CheckoutFormValues)');
    expect(source).toContain('} catch (paymentError: unknown) {');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language)");
    expect(source).not.toContain('error: any');
    expect(source).not.toContain('paymentError: any');
    expect(source).not.toContain('values: any');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('as any');
    expect(source).not.toContain('error?.response');
  });
});
