import fs from 'fs';
import path from 'path';

const readPageSource = (filename: string) => fs.readFileSync(path.join(__dirname, filename), 'utf8');

const opsLoadingSpinners = [
  { file: 'SystemMonitor.tsx', marker: 'spinning={loading && !status}' },
  { file: 'TrafficControl.tsx', marker: 'spinning={loading && !status}' },
  { file: 'ConfigCenter.tsx', marker: 'spinning={loading && !snapshot}' },
  { file: 'LogManagement.tsx', marker: 'spinning={loading && !status}' },
  { file: 'RegistryManagement.tsx', marker: 'spinning={loading && !status}' },
  { file: 'AlertManagement.tsx', marker: 'spinning={(!permissionsLoaded || loading) && alerts.length === 0}' },
];

const getSpinOpeningTag = (source: string, marker: string) => {
  const markerIndex = source.indexOf(marker);
  const openingTagStart = source.lastIndexOf('<Spin', markerIndex);
  const openingTagEnd = source.indexOf('>', markerIndex);

  return {
    markerIndex,
    openingTagStart,
    openingTagEnd,
    openingTag: openingTagStart >= 0 && openingTagEnd > openingTagStart
      ? source.slice(openingTagStart, openingTagEnd + 1)
      : '',
  };
};

describe('admin ops loading accessibility guards', () => {
  it('keeps ops monitoring spinners announced as busy status regions', () => {
    opsLoadingSpinners.forEach(({ file, marker }) => {
      const source = readPageSource(file);
      const { markerIndex, openingTagStart, openingTagEnd, openingTag } = getSpinOpeningTag(source, marker);

      expect(markerIndex).toBeGreaterThan(-1);
      expect(openingTagStart).toBeGreaterThan(-1);
      expect(openingTagEnd).toBeGreaterThan(openingTagStart);
      expect(openingTag).toContain('role="status"');
      expect(openingTag).toContain('aria-live="polite"');
      expect(openingTag).toContain(`aria-busy={${marker.replace('spinning={', '').replace(/}$/, '')}}`);
      expect(openingTag).toContain("aria-label={t('common.loading')}");
    });
  });
});
