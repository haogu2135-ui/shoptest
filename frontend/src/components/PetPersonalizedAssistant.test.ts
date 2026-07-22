import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'PetPersonalizedAssistant.tsx'), 'utf8');

describe('PetPersonalizedAssistant type-safety guards', () => {
  it('keeps personalized add-to-cart error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('messages.addFailed'), language)");
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });

  it('keeps the loading skeleton announced as a busy status region', () => {
    const loadingStart = source.indexOf('if (loading) {');
    const loadingEnd = source.indexOf('if (petProfiles.length === 0) {', loadingStart);
    const loadingSource = source.slice(loadingStart, loadingEnd);

    expect(loadingStart).toBeGreaterThan(-1);
    expect(loadingEnd).toBeGreaterThan(loadingStart);
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain('aria-busy="true"');
    expect(loadingSource).toContain("aria-label={`${t('home.petRecommendations')}: ${t('common.loading')}`}");
    expect(loadingSource).toContain('pet-personalized-assistant__skeleton');
    expect(loadingSource).not.toMatch(/\bSkeleton\b/);
  });
});
