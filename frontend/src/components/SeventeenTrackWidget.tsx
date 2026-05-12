import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';

declare global {
  interface Window {
    YQV5?: {
      trackSingle: (options: {
        YQ_ContainerId: string;
        YQ_Height: number;
        YQ_Fc: string;
        YQ_Lang: string;
        YQ_Num: string;
      }) => void;
    };
  }
}

const SCRIPT_ID = 'seventeen-track-external-call';
const SCRIPT_SRC = 'https://www.17track.net/externalcall.js';

const getWidgetLanguage = (language: string) => {
  if (language === 'zh') return 'zh-cn';
  if (language === 'es') return 'es';
  return 'en';
};

type SeventeenTrackWidgetProps = {
  trackingNumber?: string;
  carrierCode?: string;
  height?: number;
};

const SeventeenTrackWidget: React.FC<SeventeenTrackWidgetProps> = ({ trackingNumber = '', height = 560 }) => {
  const { t, language } = useLanguage();
  const [value, setValue] = useState(trackingNumber);
  const [scriptReady, setScriptReady] = useState(Boolean(window.YQV5?.trackSingle));
  const containerId = useMemo(() => `YQContainer-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    setValue(trackingNumber);
  }, [trackingNumber]);

  useEffect(() => {
    if (window.YQV5?.trackSingle) {
      setScriptReady(true);
      return undefined;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoad = () => setScriptReady(true);
    const handleError = () => message.error(t('pages.orderTracking.trackingFailed'));

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    return () => {
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };
  }, [t]);

  const runTrack = () => {
    const num = value.trim();
    if (!num) {
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }
    if (!window.YQV5?.trackSingle) {
      message.warning(t('common.loading'));
      return;
    }

    window.YQV5.trackSingle({
      YQ_ContainerId: containerId,
      YQ_Height: height,
      YQ_Fc: '0',
      YQ_Lang: getWidgetLanguage(language),
      YQ_Num: num,
    });
  };

  return (
    <Space className="seventeen-track-widget" direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space.Compact className="seventeen-track-widget__search" style={{ width: '100%' }}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPressEnter={runTrack}
          placeholder={t('pages.orderTracking.trackingNumber')}
          autoComplete="off"
        />
        <Button type="primary" icon={<SearchOutlined />} loading={!scriptReady} onClick={runTrack}>
          {t('pages.adminOrders.track')}
        </Button>
      </Space.Compact>
      <div
        id={containerId}
        className="seventeen-track-widget__results"
        style={{
          minHeight: 280,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
        }}
      >
        <Typography.Text type="secondary" style={{ display: 'block', padding: 24, textAlign: 'center' }}>
          {t('pages.orderTracking.noTrackingData')}
        </Typography.Text>
      </div>
    </Space>
  );
};

export default SeventeenTrackWidget;
