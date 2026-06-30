import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const supportLoadingRegions = [
  {
    file: '../components/CustomerSupportWidget.tsx',
    marker: 'customer-support-widget__loading',
    expectedCount: 2,
  },
  {
    file: '../components/CustomerSupportWidget.tsx',
    marker: 'customer-support-widget__orderLoading',
    expectedCount: 1,
  },
  {
    file: '../components/CustomerSupportWidget.tsx',
    marker: 'customer-support-widget__orderSelectLoading',
    expectedCount: 1,
  },
  {
    file: 'SupportManagement.tsx',
    marker: 'support-management__queueLoading',
    expectedCount: 1,
  },
  {
    file: 'SupportManagement.tsx',
    marker: 'support-management__messagesLoading',
    expectedCount: 1,
  },
  {
    file: 'SupportManagement.tsx',
    marker: 'support-management__orderLoading',
    expectedCount: 1,
  },
];

const getOpeningTagsForMarker = (source: string, marker: string) => {
  const tags: string[] = [];
  const openingTagStarts = new Set<number>();
  let markerIndex = source.indexOf(marker);

  while (markerIndex >= 0) {
    const openingTagStart = source.lastIndexOf('<', markerIndex);
    const openingTagEnd = source.indexOf('>', markerIndex);
    if (openingTagStart >= 0 && openingTagEnd > openingTagStart && !openingTagStarts.has(openingTagStart)) {
      openingTagStarts.add(openingTagStart);
      tags.push(source.slice(openingTagStart, openingTagEnd + 1));
    }
    markerIndex = source.indexOf(marker, markerIndex + marker.length);
  }

  return tags;
};

describe('support loading accessibility guards', () => {
  it('keeps customer and admin support loading regions announced as busy status regions', () => {
    supportLoadingRegions.forEach(({ file, marker, expectedCount }) => {
      const source = readSource(file);
      const loadingTags = getOpeningTagsForMarker(source, marker);

      expect(loadingTags).toHaveLength(expectedCount);
      loadingTags.forEach((loadingTag) => {
        expect(loadingTag).toContain('role="status"');
        expect(loadingTag).toContain('aria-live="polite"');
        expect(loadingTag).toContain('aria-busy="true"');
        expect(loadingTag).toContain("aria-label={t('common.loading')}");
      });
    });
  });
});
