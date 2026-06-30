const readProductManagementSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'ProductManagement.tsx'), 'utf8') as string;
const readProductManagementStyles = () => require('fs').readFileSync(require('path').resolve(__dirname, 'ProductManagement.css'), 'utf8') as string;

describe('ProductManagement source contracts', () => {
  it('keeps admin import translations and variant merges free of broad assertions', () => {
    const source = readProductManagementSource();

    expect(source).not.toMatch(/\bas any\b/);
    expect(source).toContain("const productImportTranslationParams = (result: Pick<ProductImportResult, 'totalRows' | 'created' | 'updated' | 'failed'>)");
    expect(source).toContain("t('pages.productAdmin.importSummary', productImportTranslationParams(result))");
    expect(source).toContain("t('pages.productAdmin.importPreviewMessage', productImportTranslationParams(preview))");
    expect(source).toContain("t('pages.productAdmin.importSuccess', productImportTranslationParams(result))");
    expect(source).toContain('const existing = existingRows.get(normalizeVariantOptionText(optionText));');
  });

  it('keeps product description input aligned to the backend limit', () => {
    const source = readProductManagementSource();
    const descriptionFieldStart = source.indexOf('name="description"');
    const descriptionField = source.slice(descriptionFieldStart, source.indexOf('</Form.Item>', descriptionFieldStart));

    expect(source).toContain('const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;');
    expect(descriptionField).toContain('max: PRODUCT_DESCRIPTION_MAX_LENGTH');
    expect(descriptionField).toContain('maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}');
    expect(descriptionField).toContain('showCount');
    expect(descriptionField).toContain("t('pages.productAdmin.descriptionMaxLength', { count: PRODUCT_DESCRIPTION_MAX_LENGTH })");
  });

  it('keeps product name input aligned to the backend and schema limit', () => {
    const source = readProductManagementSource();
    const nameFieldStart = source.indexOf('name="name"');
    const nameField = source.slice(nameFieldStart, source.indexOf('</Form.Item>', nameFieldStart));

    expect(source).toContain('const PRODUCT_NAME_MAX_LENGTH = 200;');
    expect(nameField).toContain('max: PRODUCT_NAME_MAX_LENGTH');
    expect(nameField).toContain('maxLength={PRODUCT_NAME_MAX_LENGTH}');
    expect(nameField).toContain('showCount');
    expect(nameField).toContain("t('pages.productAdmin.nameMaxLength', { count: PRODUCT_NAME_MAX_LENGTH })");
  });

  it('keeps mobile import controls explicit and recoverable', () => {
    const source = readProductManagementSource();
    const styles = readProductManagementStyles();

    expect(source).toContain("const urlImportActionLabel = `${pageLabel}: ${t('pages.productAdmin.importFromUrl')}`;");
    expect(source).toContain('aria-label={urlImportActionLabel}');
    expect(source).toContain('title={urlImportActionLabel}');
    expect(source).toContain('overlayClassName="product-management-page__importTooltip"');
    expect(styles).toContain('.product-management-page__urlImportModal .ant-modal-footer .ant-btn');
    expect(styles).toContain('white-space: normal;');
    expect(styles).toContain('.product-management-page__importTooltip');
    expect(styles).toContain('max-width: min(360px, calc(100vw - 24px));');
  });
});
