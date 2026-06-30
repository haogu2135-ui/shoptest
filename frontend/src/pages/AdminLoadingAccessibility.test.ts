import fs from 'fs';
import path from 'path';

const readPageSource = (filename: string) => fs.readFileSync(path.join(__dirname, filename), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadingCards = [
  { file: 'AnnouncementManagement.tsx', className: 'announcement-management__loadingState', cardLoading: true },
  { file: 'ProductManagement.tsx', className: 'product-management-page__loadingState', cardLoading: true },
  { file: 'SecurityAuditLogManagement.tsx', className: 'audit-log-page__loadingState', cardLoading: false },
  { file: 'CategoryManagement.tsx', className: 'category-management-page__loadingState', cardLoading: true },
  { file: 'UserManagement.tsx', className: 'user-management-page__loadingState', cardLoading: true },
  { file: 'IpBlacklistManagement.tsx', className: 'ip-blacklist__loadingState', cardLoading: true },
  { file: 'BrandManagement.tsx', className: 'brand-management-page__loadingState', cardLoading: true },
  { file: 'PetGalleryManagement.tsx', className: 'pet-gallery-management-page__loadingState', cardLoading: true },
  { file: 'CouponManagement.tsx', className: 'coupon-management-page__loadingState', cardLoading: true },
  { file: 'LogisticsCarrierManagement.tsx', className: 'logistics-carrier-page__loadingState', cardLoading: true },
  { file: 'PermissionManagement.tsx', className: 'permission-management-page__loadingState', cardLoading: true },
  { file: 'OrderManagement.tsx', className: 'order-management-page__loadingState', cardLoading: true },
];

describe('admin loading accessibility guards', () => {
  it('keeps admin management loading cards announced as busy status regions', () => {
    loadingCards.forEach(({ file, className, cardLoading }) => {
      const source = readPageSource(file);
      const match = source.match(new RegExp(`<Card\\s+[\\s\\S]*?className="${escapeRegExp(className)}"[\\s\\S]*?>`));

      expect(match?.[0]).toBeTruthy();
      const loadingCardSource = match?.[0] || '';
      expect(loadingCardSource).toContain('role="status"');
      expect(loadingCardSource).toContain('aria-live="polite"');
      expect(loadingCardSource).toContain('aria-busy="true"');
      expect(loadingCardSource).toContain("aria-label={t('common.loading')}");
      if (cardLoading) {
        expect(loadingCardSource).toMatch(/\bloading\b/);
      }
    });
  });
});
