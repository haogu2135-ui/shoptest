import React, { act } from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import { NativeMobileUpdateGate } from './NativeMobileUpdateGate';
import { acceptCookieConsent, COOKIE_CONSENT_STORAGE_KEY } from '../utils/cookieConsent';
import {
  currentMobileVersionCode,
  fetchLatestMobileRelease,
  isMobileReleaseDownloadAllowed,
  isNativeAndroidApp,
  resolveMobileReleaseDownloadUrl,
} from '../utils/mobileUpdate';

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'appUpdate.title': 'Update available',
      'appUpdate.requiredTitle': 'Update required',
      'common.close': 'Close',
      'appUpdate.later': 'Later',
      'appUpdate.download': 'Download',
      'appUpdate.description': 'A newer version is available.',
      'appUpdate.versionSummary': 'Version summary',
      'appUpdate.copyDownloadLink': 'Copy download link',
      'appUpdate.releaseNotes': 'Release notes',
      'appUpdate.downloadFailed': 'Download failed',
      'appUpdate.copyDownloadLinkSuccess': 'Download link copied',
      'appUpdate.copyDownloadLinkFailed': 'Could not copy download link',
    }[key] || key),
  }),
}));

jest.mock('../utils/mobileUpdate', () => ({
  currentMobileVersionCode: jest.fn(),
  currentMobileVersionName: jest.fn(() => '1.0.0'),
  fetchLatestMobileRelease: jest.fn(),
  isMobileReleaseDownloadAllowed: jest.fn(),
  isNativeAndroidApp: jest.fn(),
  openMobileReleaseDownload: jest.fn(),
  resolveMobileReleaseDownloadUrl: jest.fn(),
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: jest.fn(),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

const optionalRelease = {
  versionCode: 101,
  versionName: '1.0.1',
  mandatory: false,
};
const readUpdateGateCss = () => fs.readFileSync(path.resolve(__dirname, 'NativeMobileUpdateGate.css'), 'utf8');

describe('NativeMobileUpdateGate consent priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    (currentMobileVersionCode as jest.Mock).mockReturnValue(100);
    (fetchLatestMobileRelease as jest.Mock).mockResolvedValue(optionalRelease);
    (isMobileReleaseDownloadAllowed as jest.Mock).mockReturnValue(true);
    (isNativeAndroidApp as jest.Mock).mockReturnValue(true);
    (resolveMobileReleaseDownloadUrl as jest.Mock).mockReturnValue('');
  });

  it('waits for cookie consent before showing an optional native update', async () => {
    render(<NativeMobileUpdateGate />);

    await waitFor(() => expect(fetchLatestMobileRelease).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Update available' })).not.toBeInTheDocument();

    act(() => {
      acceptCookieConsent();
    });

    expect(await screen.findByRole('dialog', { name: 'Update available' })).toBeInTheDocument();
  });

  it('shows a required native update before cookie consent', async () => {
    (fetchLatestMobileRelease as jest.Mock).mockResolvedValue({
      ...optionalRelease,
      mandatory: true,
    });

    render(<NativeMobileUpdateGate />);

    expect(await screen.findByRole('dialog', { name: 'Update required' })).toBeInTheDocument();
  });

  it('keeps a blocking update above consent and native navigation layers', () => {
    const css = readUpdateGateCss();

    expect(css).toMatch(/\.shop-mobile-update-modal-root\s*\{[\s\S]*?z-index:\s*var\(--shop-z-blocking-update\)\s*!important;/);
  });
});
