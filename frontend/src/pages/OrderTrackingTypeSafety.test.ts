import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'OrderTracking.tsx'), 'utf8');

describe('OrderTracking type-safety guards', () => {
  it('keeps order tracking API error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.orderTracking.notFound'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.orderTracking.trackingFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.profile.continuePayFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.profile.confirmFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.profile.returnFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.profile.returnShipmentFailed'), language)");
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('as any');
  });

  it('keeps payment-return email focus ref on native HTMLInputElement', () => {
    expect(source).toContain('const paymentReturnEmailInputRef = useRef<HTMLInputElement | null>(null);');
    expect(source).not.toContain("import type { InputRef } from 'antd/es/input';");
  });

});
