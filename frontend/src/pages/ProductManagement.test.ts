import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ProductManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'ProductManagement.css'), 'utf8');
const richEditorSource = fs.readFileSync(path.join(__dirname, '../components/ProductRichDetailEditor.tsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(__dirname, '../api/index.ts'), 'utf8');
const typesSource = fs.readFileSync(path.join(__dirname, '../types.ts'), 'utf8');

describe('ProductManagement editor popup guards', () => {
  it('keeps admin product management type boundaries free of broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('const getErrorResponseData = (error: unknown): unknown => {');
    expect(pageSource).toContain('const parseVariantOptions = (variant: ProductVariantSource | ProductVariantFormRow | unknown): Record<string, string> => {');
    expect(pageSource).toContain('const productImportResultFromError = (error: unknown): ProductImportResult | null => {');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain('render: (_: unknown, record: Product)');
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('render: (_: any');
  });

  it('labels product row action buttons with product-specific accessible names', () => {
    expect(pageSource).toContain("const featureActionLabel = `${featureActionText}: ${productName}`;");
    expect(pageSource).toContain("const editActionLabel = `${t('common.edit')}: ${productName}`;");
    expect(pageSource).toContain("const duplicateActionLabel = `${t('pages.productAdmin.duplicateProduct')}: ${productName}`;");
    expect(pageSource).toContain("const approveActionLabel = `${t('pages.productAdmin.approve')}: ${productName}`;");
    expect(pageSource).toContain("const rejectActionLabel = `${t('pages.productAdmin.reject')}: ${productName}`;");
    expect(pageSource).toContain("const reviewActionLabel = `${t('pages.productAdmin.review')}: ${productName}`;");
    expect(pageSource).toContain("const deleteActionLabel = `${t('common.delete')}: ${productName}`;");

    expect(pageSource).toMatch(/icon=\{record\.isFeatured \? <StarFilled \/> : <StarOutlined \/>\}[\s\S]*?aria-pressed=\{Boolean\(record\.isFeatured\)\}[\s\S]*?aria-label=\{featureActionLabel\}[\s\S]*?title=\{featureActionLabel\}/);
    expect(pageSource).toMatch(/<Button type="primary" icon=\{<EditOutlined \/>\} aria-label=\{editActionLabel\} title=\{editActionLabel\}[\s\S]*?>\{t\('common\.edit'\)\}<\/Button>/);
    expect(pageSource).toMatch(/icon=\{<CopyOutlined \/>}[\s\S]*?aria-label=\{duplicateActionLabel\}[\s\S]*?title=\{duplicateActionLabel\}/);
    expect(pageSource).toMatch(/<Button size="small"[\s\S]*?aria-label=\{approveActionLabel\}[\s\S]*?title=\{approveActionLabel\}[\s\S]*?>\{t\('pages\.productAdmin\.approve'\)\}<\/Button>/);
    expect(pageSource).toMatch(/<Button size="small"[\s\S]*?danger[\s\S]*?aria-label=\{rejectActionLabel\}[\s\S]*?title=\{rejectActionLabel\}[\s\S]*?>\{t\('pages\.productAdmin\.reject'\)\}<\/Button>/);
    expect(pageSource).toMatch(/<Button size="small"[\s\S]*?aria-label=\{reviewActionLabel\}[\s\S]*?title=\{reviewActionLabel\}[\s\S]*?>\{t\('pages\.productAdmin\.review'\)\}<\/Button>/);
    expect(pageSource).toMatch(/<Button danger icon=\{<DeleteOutlined \/>} size="small"[\s\S]*?aria-label=\{deleteActionLabel\}[\s\S]*?title=\{deleteActionLabel\}[\s\S]*?>\{t\('common\.delete'\)\}<\/Button>/);
  });

  it('uses scoped product-editor popup layers for modal editor controls', () => {
    expect(pageSource).toContain("const productEditorPopupClassNames = { popup: { root: 'shop-mobile-popup-layer product-management-page__editorPopup' } };");
    expect(pageSource.match(/classNames=\{productEditorPopupClassNames\}/g)?.length).toBeGreaterThanOrEqual(6);
    expect(pageSource.match(/placement="bottomLeft"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(pageSource).toContain('<DatePicker.RangePicker');
    expect(pageSource).toContain('className="shopify-range-picker"');
    expect(pageSource).toContain('getPopupContainer={() => document.body}');
  });

  it('keeps product submit payloads typed without a broad any escape hatch', () => {
    expect(typesSource).toContain('export type ProductMutationPayload = Omit<');
    expect(apiSource).toContain('const normalizeProductPayload = (product: ProductMutationPayload) => {');
    expect(apiSource).toContain('createProduct: (product: ProductMutationPayload) =>');
    expect(apiSource).toContain('updateProduct: (id: number, product: ProductMutationPayload) =>');
    expect(pageSource).toContain('type ProductFormValues = Partial<Omit<');
    expect(pageSource).toContain('const [form] = Form.useForm<ProductFormValues>();');
    expect(pageSource).toContain('const payload: ProductMutationPayload = {');
    expect(pageSource).not.toContain('const payload: any = {');
  });

  it('keeps product image fallbacks and import template examples on local assets', () => {
    expect(pageSource).toContain('const productAdminImageFallback = productImageFallback;');
    expect(pageSource).toContain('const primaryImage = productAdminImageFallback;');
    expect(pageSource).toContain('const galleryImage = productAdminImageFallback;');
    expect(pageSource).toContain('const detailImage = productAdminImageFallback;');
    expect(pageSource).not.toContain('images.unsplash.com');
    expect(pageSource).not.toContain('unsplash.com');
  });

  it('uses the same modal-safe popup layer for rich detail block type Selects', () => {
    expect(richEditorSource).toContain("const richDetailTypePopupClassNames = { popup: { root: 'shop-mobile-popup-layer product-management-page__editorPopup' } };");
    expect(richEditorSource).toContain('className="product-rich-detail-editor__typeSelect"');
    expect(richEditorSource).toContain('classNames={richDetailTypePopupClassNames}');
    expect(richEditorSource).toContain('placement="bottomLeft"');
    expect(richEditorSource).toContain('getPopupContainer={() => document.body}');
  });

  it('keeps the mobile import upload action full-width inside the toolbar', () => {
    const uploadCssStart = cssSource.indexOf('.product-management-page__actions .ant-upload-wrapper.product-management-page__uploadAction');
    const uploadCss = cssSource.slice(uploadCssStart);

    expect(pageSource).toContain('<Upload className="product-management-page__uploadAction"');
    expect(uploadCssStart).toBeGreaterThanOrEqual(0);
    expect(uploadCss).toContain('.product-management-page__actions > .ant-space-item > .ant-upload-wrapper.product-management-page__uploadAction');
    expect(uploadCss).toMatch(/\.product-management-page__actions \.product-management-page__uploadAction\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
    expect(uploadCss).toMatch(/\.product-management-page__actions \.ant-upload-wrapper\.product-management-page__uploadAction,[\s\S]*?\.product-management-page__actions \.product-management-page__uploadAction \.ant-upload-select > span,[\s\S]*?\.product-management-page__actions \.product-management-page__uploadAction \.ant-upload-select \.ant-tooltip-disabled-compatible-wrapper > span,[\s\S]*?\.product-management-page__actions \.product-management-page__uploadAction \.ant-upload-select \.ant-tooltip-disabled-compatible-wrapper > button\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;/);
    expect(uploadCss).toMatch(/\.product-management-page__actions \.product-management-page__uploadAction \.ant-upload-select \.ant-btn\s*\{[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*44px;[\s\S]*?line-height:\s*1\.25;[\s\S]*?white-space:\s*normal;/);
    expect(uploadCss).toMatch(/\.product-management-page__actions \.product-management-page__uploadAction \.ant-upload-select \.ant-btn > span\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?text-align:\s*center;/);
  });

  it('keeps localized product names out of editor tab labels', () => {
    const tabsStart = pageSource.indexOf('className="shopify-localized-tabs"');
    const tabsEnd = pageSource.indexOf('<div className="shopify-section-title">{t(\'pages.productAdmin.media\')}</div>', tabsStart);
    const localizedTabsSource = pageSource.slice(tabsStart, tabsEnd);
    const tabLabelMatches = localizedTabsSource.match(/label:\s*<span className="shopify-localized-tabs__label">[\s\S]*?<\/span>/g) ?? [];
    const tabsCssStart = cssSource.indexOf('.shopify-localized-preview');
    const tabsCssEnd = cssSource.indexOf('@media (max-width: 720px)', tabsCssStart);
    const localizedTabsCss = cssSource.slice(tabsCssStart, tabsCssEnd);

    expect(tabsStart).toBeGreaterThanOrEqual(0);
    expect(tabsEnd).toBeGreaterThan(tabsStart);
    expect(tabLabelMatches).toEqual([
      'label: <span className="shopify-localized-tabs__label">{t(\'pages.productAdmin.spanish\')}</span>',
      'label: <span className="shopify-localized-tabs__label">{t(\'pages.productAdmin.chinese\')}</span>',
    ]);
    expect(tabLabelMatches.join('\n')).not.toContain('NamePreview');
    expect(localizedTabsSource).toContain('{t(\'pages.productAdmin.spanishTitle\')}: {spanishNamePreview}');
    expect(localizedTabsSource).toContain('{t(\'pages.productAdmin.chineseTitle\')}: {chineseNamePreview}');
    expect(localizedTabsSource.match(/className="shopify-localized-preview"/g)?.length).toBe(2);
    expect(localizedTabsCss).toMatch(/\.shopify-localized-preview\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(localizedTabsCss).toMatch(/\.shopify-localized-tabs \.ant-tabs-tab\s*\{[\s\S]*?max-width:\s*min\(160px,\s*46vw\);/);
    expect(localizedTabsCss).toMatch(/\.shopify-localized-tabs__label\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  });

  it('keeps the URL import preview modal scrollable without overlapping mobile actions', () => {
    const modalCssStart = cssSource.indexOf('.product-management-page__urlImportModal.ant-modal');
    const modalCssEnd = cssSource.indexOf('@media (max-width: 430px)', modalCssStart);
    const modalCss = cssSource.slice(modalCssStart, modalCssEnd);

    expect(pageSource).toContain('className="profile-mobile-safe-modal product-management-page__urlImportModal"');
    expect(modalCssStart).toBeGreaterThanOrEqual(0);
    expect(modalCssEnd).toBeGreaterThan(modalCssStart);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.ant-modal-content\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.ant-modal-body\s*\{[\s\S]*?flex:\s*1 1 auto\s*!important;[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important;[\s\S]*?-webkit-overflow-scrolling:\s*touch;/);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.product-url-import-preview__body p\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?-webkit-line-clamp:\s*unset\s*!important;/);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.ant-modal-footer\s*\{[\s\S]*?position:\s*static\s*!important;[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.ant-modal-footer \.ant-btn\s*\{[\s\S]*?justify-content:\s*center\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(modalCss).toMatch(/\.product-management-page__urlImportModal \.ant-modal-footer \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)\s*\{[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?text-overflow:\s*clip\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(cssSource).toMatch(/@media \(max-width:\s*360px\)\s*\{[\s\S]*?\.product-management-page__urlImportModal \.ant-modal-footer\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
  });

  it('pins product editor popups above modal chrome and keeps the range picker in view', () => {
    const f3538Start = cssSource.indexOf('/* F3538');
    const f3538Css = cssSource.slice(f3538Start);

    expect(f3538Start).toBeGreaterThanOrEqual(0);
    expect(f3538Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
    expect(f3538Css).toMatch(/body \.product-management-page__editorPopup\.shop-mobile-popup-layer\s*\{[\s\S]*?z-index:\s*12050\s*!important;[\s\S]*?pointer-events:\s*auto\s*!important;/);
    expect(f3538Css).toMatch(/body \.product-management-page__editorPopup\.shop-mobile-popup-layer\.ant-select-dropdown,[\s\S]*?body \.product-management-page__editorPopup\.shop-mobile-popup-layer\.ant-tree-select-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?max-height:\s*min\(320px,\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\)\s*!important;/);
    expect(f3538Css).toMatch(/body \.product-management-page__editorPopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?top:\s*max\(12px,\s*env\(safe-area-inset-top,\s*0px\)\)\s*!important;[\s\S]*?bottom:\s*auto\s*!important;[\s\S]*?max-height:\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f3538Css).toMatch(/body \.product-management-page__editorPopup\.shop-mobile-popup-layer \.ant-picker-panels\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(f3538Css).toMatch(/body \.product-management-page__editorPopup\.shop-mobile-popup-layer \.ant-select-item-option-content,[\s\S]*?body \.product-management-page__editorPopup\.shop-mobile-popup-layer \.ant-tree-title\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?word-break:\s*break-word\s*!important;/);
  });
});
