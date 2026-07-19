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

const getLoadingRegion = (source: string, marker: string) => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return {
      markerIndex,
      regionStart: -1,
      region: '',
      openingTag: '',
    };
  }

  // Prefer the accessible wrapper region that owns ARIA announcements.
  const wrapperStart = source.lastIndexOf('<div', markerIndex);
  const spinStart = source.lastIndexOf('<Spin', markerIndex);
  const regionStart = wrapperStart >= 0 && wrapperStart > spinStart - 200 ? wrapperStart : spinStart;
  const regionEnd = source.indexOf('>', markerIndex);

  return {
    markerIndex,
    regionStart,
    region: regionStart >= 0 && regionEnd > regionStart
      ? source.slice(regionStart, regionEnd + 1)
      : '',
    openingTag: spinStart >= 0 && regionEnd > spinStart
      ? source.slice(spinStart, regionEnd + 1)
      : '',
  };
};

describe('admin ops loading accessibility guards', () => {
  it('keeps ops monitoring spinners announced as busy status regions', () => {
    opsLoadingSpinners.forEach(({ file, marker }) => {
      const source = readPageSource(file);
      const busyExpression = marker.replace('spinning={', '').replace(/}$/, '');
      const { markerIndex, regionStart, region, openingTag } = getLoadingRegion(source, marker);

      expect(markerIndex).toBeGreaterThan(-1);
      expect(regionStart).toBeGreaterThan(-1);
      expect(region).toContain('role="status"');
      expect(region).toContain('aria-live="polite"');
      expect(region).toContain(`aria-busy={${busyExpression}}`);
      expect(region).toContain("aria-label={t('common.loading')}");
      // Spinner remains the visual busy indicator; ARIA lives on a valid DOM host.
      expect(openingTag).toContain(marker);
    });
  });
});
