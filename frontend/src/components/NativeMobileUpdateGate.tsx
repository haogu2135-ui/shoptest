import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Space, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
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

const { Text } = Typography;
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
      message.success(t('appUpdate.copyDownloadLinkSuccess'));
    } catch (error) {
      reportNonBlockingError('App.copyDownloadLink', error);
      message.error(t('appUpdate.copyDownloadLinkFailed'));
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
    <Modal
      open
      centered
      closable={!updateRequired}
      maskClosable={!updateRequired}
      onCancel={handleDismiss}
      title={t(updateRequired ? 'appUpdate.requiredTitle' : 'appUpdate.title')}
      rootClassName="shop-mobile-update-modal-root"
      className="profile-mobile-safe-modal shop-mobile-update-modal"
      maskStyle={{
        background: 'rgba(15, 30, 22, 0.48)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        filter: 'none',
      }}
      footer={(
        <Space wrap>
          {!updateRequired ? (
            <Button aria-label={updateLaterActionLabel} title={updateLaterActionLabel} onClick={handleDismiss}>{t('appUpdate.later')}</Button>
          ) : null}
          <Button type="primary" loading={openingDownload} aria-label={updateDownloadActionLabel} title={updateDownloadActionLabel} onClick={handleDownload}>
            {t('appUpdate.download')}
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text>{t('appUpdate.description')}</Text>
        <Text type="secondary">
          {t('appUpdate.versionSummary', { current: currentVersionLabel, latest: latestVersionLabel })}
        </Text>
        {downloadFailed ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text type="danger">{t('appUpdate.downloadFailed')}</Text>
            <Button
              icon={<CopyOutlined />}
              aria-label={copyDownloadActionLabel}
              title={copyDownloadActionLabel}
              onClick={handleCopyDownloadLink}
              disabled={!downloadUrl}
              block
            >
              {t('appUpdate.copyDownloadLink')}
            </Button>
            {downloadUrl ? (
              <Text code copyable={{ text: downloadUrl }} style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                {downloadUrl}
              </Text>
            ) : null}
          </Space>
        ) : null}
        {releaseNotes.length ? (
          <div>
            <Text strong>{t('appUpdate.releaseNotes')}</Text>
            <ul>
              {releaseNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Space>
    </Modal>
  );
};

export default NativeMobileUpdateGate;
