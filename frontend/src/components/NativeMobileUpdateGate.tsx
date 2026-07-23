import React, { useCallback, useEffect, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';

import ShopModal from './ShopModal';
import { useLanguage } from '../i18n';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { useNativeBackHandler } from '../utils/nativeBack';
import {
  currentMobileVersionCode,
  currentMobileVersionName,
  fetchLatestMobileRelease,
  isMobileReleaseDownloadAllowed,
  isNativeAndroidApp,
  openMobileReleaseDownload,
  resolveMobileReleaseDownloadUrl,
  type MobileReleaseManifest,
} from '../utils/mobileUpdate';
import './NativeMobileUpdateGate.css';
import ShopButton from './ShopButton';

const MOBILE_UPDATE_DISMISSED_KEY_PREFIX = 'shop-mobile-update-dismissed';

export const NativeMobileUpdateGate: React.FC = () => {
  const { t } = useLanguage();
  const [release, setRelease] = useState<MobileReleaseManifest | null>(null);
  const [openingDownload, setOpeningDownload] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const installedVersionCode = currentMobileVersionCode();
  const latestVersionCode = release?.versionCode || 0;
  const updateRequired = Boolean(release && (release.mandatory || (release.minSupportedVersionCode || 0) > installedVersionCode));
  const downloadUrl = resolveMobileReleaseDownloadUrl(release);

  useEffect(() => {
    if (!isNativeAndroidApp()) return;

    let disposed = false;
    let checking = false;
    let retryTimer: number | null = null;
    const listenerRemovers: Array<() => Promise<void> | void> = [];

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const checkLatestRelease = async () => {
      if (disposed || checking) return;
      checking = true;
      try {
        const latestRelease = await fetchLatestMobileRelease();
        if (disposed) return;
        const latestReleaseVersionCode = latestRelease?.versionCode || 0;
        if (
          !latestRelease
          || latestReleaseVersionCode <= installedVersionCode
          || !isMobileReleaseDownloadAllowed(latestRelease)
        ) {
          return;
        }
        const required = latestRelease.mandatory || (latestRelease.minSupportedVersionCode || 0) > installedVersionCode;
        const dismissed = getLocalStorageItem(`${MOBILE_UPDATE_DISMISSED_KEY_PREFIX}:${latestReleaseVersionCode}`) === '1';
        if (!required && dismissed) {
          return;
        }
        setDownloadFailed(false);
        setRelease(latestRelease);
      } finally {
        checking = false;
      }
    };

    const scheduleReleaseCheck = () => {
      if (disposed) return;
      clearRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void checkLatestRelease();
      }, 300);
    };

    void checkLatestRelease();
    window.addEventListener('online', scheduleReleaseCheck);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleReleaseCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      const addNativeListener = (
        eventName: 'appStateChange' | 'resume',
        listener: (event?: { isActive?: boolean }) => void,
      ) => {
        try {
          const registration = appPlugin.addListener?.(eventName, listener);
          Promise.resolve(registration).then((handle) => {
            if (!handle || typeof handle.remove !== 'function') return;
            if (disposed) {
              void handle.remove();
              return;
            }
            listenerRemovers.push(() => handle.remove());
          });
        } catch (error) {
          reportNonBlockingError('App.addNativeReleaseCheckListener', error);
        }
      };

      addNativeListener('appStateChange', (event) => {
        if (event?.isActive !== false) {
          scheduleReleaseCheck();
        }
      });
      addNativeListener('resume', scheduleReleaseCheck);
    }

    return () => {
      disposed = true;
      clearRetryTimer();
      window.removeEventListener('online', scheduleReleaseCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      listenerRemovers.forEach((remove) => {
        void remove();
      });
    };
  }, [installedVersionCode]);

  const handleDismiss = useCallback(() => {
    if (!release || updateRequired) return;
    setLocalStorageItem(`${MOBILE_UPDATE_DISMISSED_KEY_PREFIX}:${release.versionCode}`, '1');
    setDownloadFailed(false);
    setRelease(null);
  }, [release, updateRequired]);

  const handleNativeBack = useCallback(() => {
    if (updateRequired) {
      return true;
    }
    handleDismiss();
    return true;
  }, [handleDismiss, updateRequired]);

  useNativeBackHandler(Boolean(release), handleNativeBack);

  const handleDownload = async () => {
    if (!release) return;
    setOpeningDownload(true);
    setDownloadFailed(false);
    try {
      const opened = await openMobileReleaseDownload(release);
      setDownloadFailed(!opened);
    } catch (error) {
      reportNonBlockingError('App.mobileUpdateDownload', error);
      setDownloadFailed(true);
    } finally {
      setOpeningDownload(false);
    }
  };

  const handleCopyDownloadLink = async () => {
    if (!downloadUrl) return;
    try {
      await navigator.clipboard.writeText(downloadUrl);
      announceAccessibleMessage(t('appUpdate.copyDownloadLinkSuccess'), 'success');
    } catch (error) {
      reportNonBlockingError('App.copyDownloadLink', error);
      announceAccessibleMessage(t('appUpdate.copyDownloadLinkFailed'), 'error');
    }
  };

  if (!release) return null;

  const releaseNotes = release.releaseNotes || [];
  const currentVersionLabel = currentMobileVersionName();
  const latestVersionLabel = release.versionName || String(latestVersionCode);
  const updateTargetLabel = `${latestVersionLabel} (${currentVersionLabel} -> ${latestVersionLabel})`;
  const updateLaterActionLabel = `${t('appUpdate.later')}: ${updateTargetLabel}`;
  const updateDownloadActionLabel = `${t('appUpdate.download')}: ${updateTargetLabel}`;
  const copyDownloadActionLabel = `${t('appUpdate.copyDownloadLink')}: ${latestVersionLabel}`;

  return (
    <ShopModal
      open
      closable={!updateRequired}
      maskClosable={!updateRequired}
      onClose={handleDismiss}
      title={t(updateRequired ? 'appUpdate.requiredTitle' : 'appUpdate.title')}
      rootClassName="shop-mobile-update-modal-root"
      className="profile-mobile-safe-modal shop-mobile-update-modal"
      closeLabel={t('common.close', { defaultValue: 'Close' })}
      footer={(
        <div className="shop-mobile-update-modal__actions">
          {!updateRequired ? (
            <ShopButton aria-label={updateLaterActionLabel} title={updateLaterActionLabel} onClick={handleDismiss}>{t('appUpdate.later')}</ShopButton>
          ) : null}
          <ShopButton type="primary" loading={openingDownload} aria-label={updateDownloadActionLabel} title={updateDownloadActionLabel} onClick={handleDownload}>
            {t('appUpdate.download')}
          </ShopButton>
        </div>
      )}
    >
      <div className="shop-mobile-update-modal__stack">
        <p className="shop-mobile-update-modal__text">{t('appUpdate.description')}</p>
        <p className="shop-mobile-update-modal__text shop-mobile-update-modal__text--secondary">
          {t('appUpdate.versionSummary', { current: currentVersionLabel, latest: latestVersionLabel })}
        </p>
        {downloadFailed ? (
          <div className="shop-mobile-update-modal__stack shop-mobile-update-modal__stack--tight">
            <p className="shop-mobile-update-modal__text shop-mobile-update-modal__text--danger">{t('appUpdate.downloadFailed')}</p>
            <ShopButton
              icon={<ShopIcon path={SI.copy} />}
              aria-label={copyDownloadActionLabel}
              title={copyDownloadActionLabel}
              onClick={handleCopyDownloadLink}
              disabled={!downloadUrl}
              block
            >
              {t('appUpdate.copyDownloadLink')}
            </ShopButton>
            {downloadUrl ? (
              <code className="shop-mobile-update-modal__code">{downloadUrl}</code>
            ) : null}
          </div>
        ) : null}
        {releaseNotes.length ? (
          <div>
            <p className="shop-mobile-update-modal__text shop-mobile-update-modal__text--strong">{t('appUpdate.releaseNotes')}</p>
            <ul>
              {releaseNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ShopModal>
  );
};

export default NativeMobileUpdateGate;
