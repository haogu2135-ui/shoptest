import fs from 'fs';
import path from 'path';

const readCss = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const expectVisibleMetricGrid = (css: string, selector: string, minTrack: string) => {
  expect(css).toMatch(new RegExp(`${escapeRegExp(selector)}[\\s\\S]*?\\{[\\s\\S]*?display:\\s*grid\\s*!important;[\\s\\S]*?grid-template-columns:\\s*repeat\\(auto-fit,\\s*minmax\\(${escapeRegExp(minTrack)},\\s*1fr\\)\\)\\s*!important;[\\s\\S]*?overflow:\\s*visible\\s*!important;[\\s\\S]*?scroll-snap-type:\\s*none\\s*!important;[\\s\\S]*?-webkit-mask-image:\\s*none\\s*!important;[\\s\\S]*?mask-image:\\s*none\\s*!important;`));
};

const expectRailCardReset = (css: string, selector: string) => {
  expect(css).toMatch(new RegExp(`${escapeRegExp(selector)}[\\s\\S]*?\\{[\\s\\S]*?flex:\\s*initial\\s*!important;[\\s\\S]*?min-width:\\s*0\\s*!important;[\\s\\S]*?scroll-snap-align:\\s*initial\\s*!important;`));
};

describe('Admin summary/status responsive rails', () => {
  it('keeps order, product, support, user, alert, and dashboard risk metrics visible by default', () => {
    const contracts = [
      {
        file: 'OrderManagement.css',
        grids: [{ selector: '.order-management-page__summaryGrid', minTrack: '104px' }],
        cards: ['.order-management-page__summaryCard'],
      },
      {
        file: 'ProductManagement.css',
        grids: [{ selector: '.product-listing-quality__metrics', minTrack: '96px' }],
        cards: ['.product-listing-quality__metrics button'],
      },
      {
        file: 'SupportManagement.css',
        grids: [
          { selector: '.support-management__insightStats', minTrack: '96px' },
          { selector: '.support-management__summaryBar', minTrack: '96px' },
        ],
        cards: ['.support-management__insightStats .ant-tag', '.support-management__summaryCard'],
      },
      {
        file: 'UserManagement.css',
        grids: [{ selector: '.user-management-page__healthGrid', minTrack: '104px' }],
        cards: ['.user-management-page__healthItem'],
      },
      {
        file: 'AlertManagement.css',
        grids: [{ selector: '.alert-management__stats', minTrack: '132px' }],
        cards: ['.alert-management__stats .ant-card'],
      },
      {
        file: 'AdminDashboard.css',
        grids: [
          { selector: '.admin-dashboard__readinessGrid', minTrack: '112px' },
          { selector: '.admin-dashboard__actionGrid', minTrack: '112px' },
          { selector: '.admin-dashboard__paymentOpsGrid', minTrack: '112px' },
          { selector: '.admin-dashboard__slaGrid', minTrack: '112px' },
        ],
        cards: [
          '.admin-dashboard__actionCard',
          '.admin-dashboard__readinessItem',
          '.admin-dashboard__paymentOpsCard',
          '.admin-dashboard__slaCard',
        ],
      },
    ];

    for (const contract of contracts) {
      const cssSource = readCss(contract.file);
      const f2761Start = cssSource.indexOf('/* F2761: admin summary/status metrics must wrap instead of hiding risk counts in scroll rails. */');
      const f2761Css = cssSource.slice(f2761Start);

      expect(f2761Start).toBeGreaterThanOrEqual(0);
      expect(f2761Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);

      for (const grid of contract.grids) {
        expectVisibleMetricGrid(f2761Css, grid.selector, grid.minTrack);
      }

      for (const card of contract.cards) {
        expectRailCardReset(f2761Css, card);
      }
    }
  });

  it('collapses wide dashboard and user health shells before tablet or phone-landscape clipping', () => {
    const userCss = readCss('UserManagement.css');
    const dashboardCss = readCss('AdminDashboard.css');
    const userF2761 = userCss.slice(userCss.indexOf('/* F2761: admin summary/status metrics must wrap instead of hiding risk counts in scroll rails. */'));
    const dashboardF2761 = dashboardCss.slice(dashboardCss.indexOf('/* F2761: admin summary/status metrics must wrap instead of hiding risk counts in scroll rails. */'));

    expect(userF2761).toMatch(/\.user-management-page__health\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(dashboardF2761).toMatch(/\.admin-dashboard__readiness\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(dashboardF2761).toMatch(/@media \(max-width:\s*430px\)\s*\{[\s\S]*?\.admin-dashboard__readinessGrid,[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
  });
});
