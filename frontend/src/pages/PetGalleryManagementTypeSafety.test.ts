import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'PetGalleryManagement.tsx'), 'utf8');

describe('PetGalleryManagement type-safety guards', () => {
  it('keeps pet gallery admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.petGalleryAdmin.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.petGalleryAdmin.deleteFailed'), language)");
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });
});
