import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'OrderManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'OrderManagement.css'), 'utf8');

describe('OrderManagement modal evidence guards', () => {
  it('loads order detail items through typed admin API data instead of legacy itemsJson parsing', () => {
    expect(pageSource).not.toContain('itemsJson');
    expect(pageSource).not.toMatch(/JSON\.parse\s*\(/);
    expect(pageSource).toContain('const [orderItems, setOrderItems] = useState<OrderItem[]>([]);');
    expect(pageSource).toContain('const itemsRes = await adminApi.getOrderItems(order.id);');
    expect(pageSource).toContain('setOrderItems(itemsRes.data);');
    expect(pageSource).toContain('dataSource={orderItems}');
  });

  it('keeps order admin error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain('render: (_: unknown, record: Order)');
    expect(pageSource).toContain('render: (_: unknown, payment: AdminPayment)');
    expect(pageSource).toContain('render: (_: unknown, item: OrderItem)');
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('render: (_: any');
  });

  it('keeps fulfillment carrier dropdowns on a scoped modal-safe popup layer', () => {
    expect(pageSource).toContain("const carrierSelectClassNames = { popup: { root: 'shop-mobile-popup-layer order-management-page__carrierPopup' } };");
    expect(pageSource).toContain('className="order-management-page__carrierSelect"');
    expect(pageSource).toContain('className="order-management-page__carrierSelect order-management-page__batchCarrierSelect"');
    expect(pageSource.match(/classNames=\{carrierSelectClassNames\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pageSource.match(/placement="bottomLeft"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pageSource.match(/getPopupContainer=\{\(\) => document\.body\}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('labels refund/detail modal table cells for compact evidence cards', () => {
    expect(pageSource).toContain("Record<'data-label', string>");
    expect(pageSource).toContain("'data-label': label");
    expect(pageSource.match(/className="order-management-page__modalEvidenceSection"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(pageSource.match(/className="order-management-page__modalEvidenceTable"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(pageSource.match(/onCell: \(\) => evidenceCell\(/g)?.length).toBeGreaterThanOrEqual(16);
    expect(pageSource).toContain("onCell: () => evidenceCell(t('pages.adminOrders.paymentMethod'))");
    expect(pageSource).toContain("onCell: () => evidenceCell(t('pages.adminOrders.refundReference'))");
    expect(pageSource).toContain("onCell: () => evidenceCell(t('common.actions'))");
    expect(pageSource).toContain("onCell: () => evidenceCell(t('pages.adminOrders.createdAt'))");
    expect(pageSource).toContain("onCell: () => evidenceCell(t('common.subtotal'))");
  });

  it('localizes the customer user id prefix', () => {
    expect(pageSource).toContain("{t('common.id')} {order.userId}");
    expect(pageSource).not.toContain('>ID {order.userId}<');
  });

  it('stacks modal evidence tables inside their modal container width', () => {
    const f3536Start = cssSource.indexOf('/* F3536');
    const f3536Css = cssSource.slice(f3536Start);

    expect(f3536Start).toBeGreaterThanOrEqual(0);
    expect(cssSource).toMatch(/\.order-management-page__modalEvidenceSection\s*\{[\s\S]*?container-name:\s*order-modal-evidence;[\s\S]*?container-type:\s*inline-size;/);
    expect(f3536Css).toMatch(/@container order-modal-evidence \(max-width:\s*820px\)\s*\{/);
    expect(f3536Css).toMatch(/\.order-management-page__modalEvidenceTable \.ant-table-thead\s*\{[\s\S]*?display:\s*none;/);
    expect(f3536Css).toMatch(/\.order-management-page__modalEvidenceTable \.ant-table-tbody > tr\s*\{[\s\S]*?display:\s*grid;[\s\S]*?border:\s*1px solid #dfe9e4;[\s\S]*?border-radius:\s*12px;/);
    expect(f3536Css).toMatch(/\.order-management-page__modalEvidenceTable \.ant-table-tbody > tr > td\s*\{[\s\S]*?grid-template-columns:\s*minmax\(108px,\s*34%\) minmax\(0,\s*1fr\);[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(f3536Css).toMatch(/\.order-management-page__modalEvidenceTable \.ant-table-tbody > tr > td::before\s*\{[\s\S]*?content:\s*attr\(data-label\);/);
    expect(f3536Css).toMatch(/@container order-modal-evidence \(max-width:\s*430px\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  it('raises carrier dropdowns above shipping and batch modal chrome on narrow viewports', () => {
    const f3537Start = cssSource.indexOf('/* F3537');
    const f3537Css = cssSource.slice(f3537Start);

    expect(f3537Start).toBeGreaterThanOrEqual(0);
    expect(cssSource).toMatch(/\.order-management-page__carrierSelect\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3537Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
    expect(f3537Css).toMatch(/\.order-management-page__shippingModal \.order-management-page__carrierSelect,[\s\S]*?\.order-management-page__batchShipModal \.order-management-page__carrierSelect\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
    expect(f3537Css).toMatch(/body \.order-management-page__carrierPopup\.shop-mobile-popup-layer\.ant-select-dropdown\s*\{[\s\S]*?z-index:\s*12000\s*!important;[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;/);
    expect(f3537Css).toMatch(/body \.order-management-page__carrierPopup\.shop-mobile-popup-layer\.ant-select-dropdown\s*\{[\s\S]*?max-width:\s*calc\(100vw - 16px\)\s*!important;[\s\S]*?max-height:\s*min\(300px,\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\)\s*!important;[\s\S]*?pointer-events:\s*auto\s*!important;/);
    expect(f3537Css).toMatch(/body \.order-management-page__carrierPopup\.shop-mobile-popup-layer\.ant-select-dropdown \.ant-select-item-option-content\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?word-break:\s*break-word\s*!important;/);
  });

  it('requires refund reason confirmation and offers reason presets before issuing refunds', () => {
    const pageSource = require('fs').readFileSync(require('path').resolve(__dirname, 'OrderManagement.tsx'), 'utf8');
    expect(pageSource).toContain('REFUND_REASON_PRESET_KEYS');
    expect(pageSource).toContain('const [refundConfirmed, setRefundConfirmed] = useState(false);');
    expect(pageSource).toContain("t('pages.adminOrders.refundConfirmAcknowledge'");
    expect(pageSource).toContain("t('pages.adminOrders.refundConfirmRequired')");
    expect(pageSource).toContain('!refundReason.trim() || !refundConfirmed');
    expect(pageSource).toContain('order-management-page__refundReasonPresets');
  });


  it('prioritizes after-sales queues and exposes one-click next-action CTAs', () => {
    const pageSource = require('fs').readFileSync(require('path').resolve(__dirname, 'OrderManagement.tsx'), 'utf8');
    expect(pageSource).toContain('const displayOrders = prioritizeAfterSalesQueue');
    expect(pageSource).toContain('AFTER_SALES_STATUS_PRIORITY');
    expect(pageSource).toContain('runPrimaryNextAction');
    expect(pageSource).toContain('order-management-page__afterSalesBreakdown');
    expect(pageSource).toContain("t('pages.adminOrders.afterSalesQueuePriorityHint')");
    expect(pageSource).toContain("t('pages.adminOrders.nextActionRefundCta')");
    expect(pageSource).toContain('dataSource={displayOrders}');
  });

});
