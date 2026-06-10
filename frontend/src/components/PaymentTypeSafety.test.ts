import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'Payment.tsx'), 'utf8');

describe('Payment type-safety guards', () => {
    it('keeps payment creation error handling typed without broad any usage', () => {
        expect(source).toContain('} catch (error: unknown) {');
        expect(source).toContain("getApiErrorMessage(error, t('pages.payment.createFailed'), language)");
        expect(source).not.toMatch(/\bany\b/);
        expect(source).not.toContain('catch (error: any)');
        expect(source).not.toContain('catch (err: any)');
    });
});
