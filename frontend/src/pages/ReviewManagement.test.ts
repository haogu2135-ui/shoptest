import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ReviewManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'ReviewManagement.css'), 'utf8');

describe('ReviewManagement health metric guards', () => {
  it('blocks review mutations while showing stale cached rows after a reload failure', () => {
    expect(pageSource).toContain('const [loadError, setLoadError] = useState<string | null>(null);');
    expect(pageSource).toContain('const [reviewSnapshotLoaded, setReviewSnapshotLoaded] = useState(false);');
    expect(pageSource).toContain('const actionsDisabledByStaleData = Boolean(loadError);');
    expect(pageSource).toContain("message={t('pages.adminReviews.loadErrorTitle')}");
    expect(pageSource).toContain("description={reviewSnapshotLoaded ? t('pages.adminReviews.staleDataWarning') : loadError}");
    expect(pageSource).toContain("onClick={() => fetchReviews(pageState.page || 1, pageState.size || pageSizeRef.current)}");
    expect(pageSource).toContain('disabled={actionsDisabledByStaleData}');
  });

  it('uses typed nested review product and user fields without broad assertions', () => {
    expect(pageSource).not.toMatch(/\bas any\b|\bany\b/);
    expect(pageSource).toContain('record.product?.id');
    expect(pageSource).toContain('record.product?.imageUrl');
    expect(pageSource).toContain('record.user?.username');
  });

  it('renders all four review operations metrics before the table', () => {
    expect(pageSource).toContain('className="review-ops-panel"');
    expect(pageSource).toContain('className="review-ops-panel__metrics"');
    expect(pageSource).toContain("t('pages.adminReviews.averageRating')");
    expect(pageSource).toContain("t('pages.adminReviews.lowRating')");
    expect(pageSource).toContain("t('pages.adminReviews.needsReply')");
    expect(pageSource).toContain("t('pages.adminReviews.approvedReviews')");
    expect(pageSource).toContain('reviewStats.needsReply');
    expect(pageSource).toContain('reviewStats.approved');
  });

  it('keeps mobile review health metrics visible instead of a hidden rail', () => {
    const f3524Start = cssSource.indexOf('/* F3524');
    const f3524Css = cssSource.slice(f3524Start);

    expect(f3524Start).toBeGreaterThanOrEqual(0);
    expect(f3524Css).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*?\.review-ops-panel\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(f3524Css).toMatch(/\.review-ops-panel__metrics\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(f3524Css).toMatch(/\.review-ops-panel__metrics\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3524Css).toMatch(/\.review-ops-panel__metrics\s*\{[\s\S]*?margin-inline:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f3524Css).toMatch(/\.review-ops-panel__metrics\s*\{[\s\S]*?scroll-snap-type:\s*none\s*!important;[\s\S]*?-webkit-mask-image:\s*none\s*!important;[\s\S]*?mask-image:\s*none\s*!important;[\s\S]*?scrollbar-width:\s*auto;/);
    expect(f3524Css).toMatch(/\.review-ops-panel__metrics div,[\s\S]*?\.review-management-page--es \.review-ops-panel__metrics div\s*\{[\s\S]*?flex:\s*initial\s*!important;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?scroll-snap-align:\s*none;/);
    expect(f3524Css).not.toMatch(/display:\s*flex/);
    expect(f3524Css).not.toMatch(/overflow-x:\s*auto/);
    expect(f3524Css).not.toMatch(/scrollbar-width:\s*none/);
    expect(f3524Css).not.toMatch(/mask-image:\s*linear-gradient/);
  });
});
