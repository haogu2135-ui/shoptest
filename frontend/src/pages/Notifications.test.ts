import fs from 'fs';
import path from 'path';

const readNotificationsSource = () => fs.readFileSync(path.resolve(__dirname, 'Notifications.tsx'), 'utf8');
const readNotificationsCss = () => fs.readFileSync(path.resolve(__dirname, 'Notifications.css'), 'utf8');

describe('Notifications mobile bottom-nav clearance contract', () => {
  it('renders the action plan before the notification list', () => {
    const source = readNotificationsSource();

    expect(source).toContain('className="notifications-page"');
    expect(source).toContain('className="notifications-page__actionPlan"');
    expect(source).toContain('className="notifications-page__actionSignals"');
    expect(source).toContain("t('pages.notifications.actionReviewUnread')");
    expect(source.indexOf('className="notifications-page__actionPlan"')).toBeGreaterThan(-1);
    expect(source.indexOf('<List')).toBeGreaterThan(source.indexOf('className="notifications-page__actionPlan"'));
  });

  it('reserves bottom-navigation clearance for the mobile action plan and first card', () => {
    const css = readNotificationsCss();
    const f2719Start = css.indexOf('F2719:');
    const f2719Css = css.slice(f2719Start);

    expect(f2719Start).toBeGreaterThan(css.indexOf('2026-06-07 mobile notification action closure'));
    expect(f2719Css).toContain('@media (max-width: 640px)');
    expect(f2719Css).toMatch(/\.notifications-page\s*\{[^}]*padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*96px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[^}]*scroll-padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*112px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f2719Css).toMatch(/\.notifications-page__actionPlan\s*\{[^}]*gap:\s*8px\s*!important;[^}]*margin-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*16px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[^}]*scroll-margin-bottom:/);
    expect(f2719Css).toMatch(/\.notifications-page__actionPlan > \.ant-btn\s*\{[^}]*min-height:\s*44px\s*!important;[^}]*scroll-margin-bottom:/);
    expect(f2719Css).toMatch(/\.notifications-page__item:first-child,[\s\S]*?\.notifications-page \.ant-list > \.ant-spin-nested-loading:first-child\s*\{[^}]*scroll-margin-bottom:/);
  });
});
