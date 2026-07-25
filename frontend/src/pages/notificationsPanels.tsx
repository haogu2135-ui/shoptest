import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopPopconfirm from '../components/ShopPopconfirm';
import type { AppNotification } from '../types';
import { buildLoginUrl } from '../utils/authRedirect';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  buildNotificationItemActionLabels,
  extractOrderNoFromNotification,
  formatNotificationType,
  typeColors,
  type NotificationInsights,
  type NotificationQuickFilter,
  type NotificationsTranslate,
} from './notificationsHelpers';

export type NotificationsActionPlan = {
  title: string;
  text: string;
  label: string;
  onClick: () => void;
};

export type NotificationsPanelsProps = {
  t: NotificationsTranslate;
  language: string;
  navigate: NavigateFunction;
  notifications: AppNotification[];
  filteredNotifications: AppNotification[];
  notificationInsights: NotificationInsights;
  quickFilter: NotificationQuickFilter;
  setQuickFilter: React.Dispatch<React.SetStateAction<NotificationQuickFilter>>;
  actionPlan: NotificationsActionPlan;
  fetchError: string;
  fetchNotifications: (nextPage?: number, append?: boolean) => void;
  handleMarkAllAsRead: () => void;
  handleMarkAsRead: (id: number) => void;
  handleDelete: (id: number) => void;
  openRelatedNotification: (item: AppNotification) => void;
  markAllActionLabel: string;
  clearFilterActionLabel: string;
  notificationActionPlanLabel: string;
  loadMoreActionLabel: string;
  notificationActionsDisabled: boolean;
  hasMoreNotifications: boolean;
  notificationPage: number;
  loadingMore: boolean;
};

const renderMessage = (item: AppNotification) => {
  if (item.contentFormat === 'HTML') {
    return (
      <div
        className="notification-rich-content"
        dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(item.message || '') }}
      />
    );
  }
  return <div className="notifications-page__plainText">{item.message}</div>;
};

export const NotificationsAuthGateShell: React.FC<{
  t: NotificationsTranslate;
  language: string;
  navigate: NavigateFunction;
  authGateLoginLabel: string;
  authGateRegisterLabel: string;
}> = ({ t, language, navigate, authGateLoginLabel, authGateRegisterLabel }) => (
  <div
    className={`notifications-page notifications-page--${language} notifications-page--empty notifications-page--authGate`}
    data-auth-gate="notifications-login-required"
  >
    <PageEmpty
      className="notifications-page__authGate"
      description={(
        <div className="notifications-page__emptyCopy">
          <h1 className="notifications-page__title">{t('pages.notifications.authGateTitle')}</h1>
          <div className="notifications-page__emptyHint">{t('pages.notifications.authGateHint')}</div>
        </div>
      )}
      actions={[
        {
          key: 'login',
          label: authGateLoginLabel,
          onClick: () => navigate(buildLoginUrl('/notifications')),
        },
        {
          key: 'register',
          label: authGateRegisterLabel,
          onClick: () => navigate('/register?redirect=%2Fnotifications'),
          type: 'default',
        },
        {
          key: 'browse',
          label: t('pages.cart.browse'),
          onClick: () => navigate('/products'),
          type: 'default',
        },
        {
          key: 'track',
          label: t('pages.notifications.emptyTrackOrder'),
          onClick: () => navigate('/track-order'),
          type: 'default',
        },
        {
          key: 'coupons',
          label: t('pages.notifications.emptyCoupons'),
          onClick: () => navigate('/coupons'),
          type: 'default',
        },
      ]}
    />
  </div>
);

export const NotificationsLoadingShell: React.FC<{
  t: NotificationsTranslate;
}> = ({ t }) => (
  <div
    className="notifications-page notifications-page--loading"
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={t('common.loading')}
  >
    <h1 className="notifications-page__title">{t('pages.notifications.title')}</h1>
    <span className="notifications-page__spinner" aria-hidden="true" />
  </div>
);

export const NotificationsMainPanels: React.FC<NotificationsPanelsProps> = ({
  t,
  language,
  navigate,
  notifications,
  filteredNotifications,
  notificationInsights,
  quickFilter,
  setQuickFilter,
  actionPlan,
  fetchError,
  fetchNotifications,
  handleMarkAllAsRead,
  handleMarkAsRead,
  handleDelete,
  openRelatedNotification,
  markAllActionLabel,
  clearFilterActionLabel,
  notificationActionPlanLabel,
  loadMoreActionLabel,
  notificationActionsDisabled,
  hasMoreNotifications,
  notificationPage,
  loadingMore,
}) => (
  <div className="notifications-page">
    <div className="notifications-page__header">
      <div className="notifications-page__title">
        <ShopIcon path={SI.bell} />
        <h1 className="notifications-page__title">{t('pages.notifications.title')}</h1>
      </div>
      {notifications.some(n => !n.isRead) && (
        <ShopButton
          icon={<ShopIcon path={SI.check} />}
          aria-label={markAllActionLabel}
          title={markAllActionLabel}
          onClick={handleMarkAllAsRead}
          disabled={notificationActionsDisabled}
        >
          {t('pages.notifications.markAll')}
        </ShopButton>
      )}
    </div>
    {notifications.length > 0 ? (
      <section className="notifications-page__assistant" aria-label={t('pages.notifications.assistantTitle')}>
        <div className="notifications-page__assistantCopy">
          <span className="notifications-page__text notifications-page__eyebrow">{t('pages.notifications.assistantEyebrow')}</span>
          <h4 className="notifications-page__title">{t('pages.notifications.assistantTitle')}</h4>
          <span className="notifications-page__text notifications-page__text--secondary">{t('pages.notifications.assistantSubtitle')}</span>
        </div>
        <div className="notifications-page__signalGrid">
          <button
            type="button"
            className={`notifications-page__signal ${quickFilter === 'UNREAD' ? 'is-active' : ''}`}
            aria-pressed={quickFilter === 'UNREAD'}
            aria-label={`${t('pages.notifications.unreadCount')}: ${notificationInsights.unread}`}
            title={`${t('pages.notifications.unreadCount')}: ${notificationInsights.unread}`}
            onClick={() => setQuickFilter('UNREAD')}
          >
            <ShopIcon path={SI.bell} />
            <strong>{notificationInsights.unread}</strong>
            <span>{t('pages.notifications.unreadCount')}</span>
          </button>
          <button
            type="button"
            className={`notifications-page__signal ${quickFilter === 'PROMOTION' ? 'is-active' : ''}`}
            aria-pressed={quickFilter === 'PROMOTION'}
            aria-label={`${t('pages.notifications.promotionCount')}: ${notificationInsights.promotions}`}
            title={`${t('pages.notifications.promotionCount')}: ${notificationInsights.promotions}`}
            onClick={() => setQuickFilter('PROMOTION')}
          >
            <ShopIcon path={SI.gift} />
            <strong>{notificationInsights.promotions}</strong>
            <span>{t('pages.notifications.promotionCount')}</span>
          </button>
          <button
            type="button"
            className={`notifications-page__signal ${quickFilter === 'ORDER' ? 'is-active' : ''}`}
            aria-pressed={quickFilter === 'ORDER'}
            aria-label={`${t('pages.notifications.orderCount')}: ${notificationInsights.orders}`}
            title={`${t('pages.notifications.orderCount')}: ${notificationInsights.orders}`}
            onClick={() => setQuickFilter('ORDER')}
          >
            <ShopIcon path={SI.shopping} />
            <strong>{notificationInsights.orders}</strong>
            <span>{t('pages.notifications.orderCount')}</span>
          </button>
          <button
            type="button"
            className={`notifications-page__signal ${quickFilter === 'DELIVERY' ? 'is-active' : ''}`}
            aria-pressed={quickFilter === 'DELIVERY'}
            aria-label={`${t('pages.notifications.deliveryCount')}: ${notificationInsights.deliveries}`}
            title={`${t('pages.notifications.deliveryCount')}: ${notificationInsights.deliveries}`}
            onClick={() => setQuickFilter('DELIVERY')}
          >
            <ShopIcon path={SI.truck} />
            <strong>{notificationInsights.deliveries}</strong>
            <span>{t('pages.notifications.deliveryCount')}</span>
          </button>
        </div>
        {quickFilter !== 'ALL' ? (
          <ShopButton size="small" aria-label={clearFilterActionLabel} title={clearFilterActionLabel} onClick={() => setQuickFilter('ALL')}>{t('pages.notifications.clearFilter')}</ShopButton>
        ) : null}
      </section>
    ) : null}
    {notifications.length > 0 ? (
      <section className="notifications-page__actionPlan" aria-label={t('pages.notifications.actionPlanTitle')}>
        <div>
          <span className="notifications-page__text notifications-page__eyebrow">{t('pages.notifications.actionPlanEyebrow')}</span>
          <h4 className="notifications-page__title">{actionPlan.title}</h4>
          <span className="notifications-page__text notifications-page__text--secondary">{actionPlan.text}</span>
        </div>
        <div className="notifications-page__actionSignals">
          <span><ShopIcon path={SI.bell} /> {t('pages.notifications.actionSignalUnread', { count: notificationInsights.unread })}</span>
          <span><ShopIcon path={SI.gift} /> {t('pages.notifications.actionSignalOffers', { count: notificationInsights.promotions })}</span>
          <span><ShopIcon path={SI.truck} /> {t('pages.notifications.actionSignalDelivery', { count: notificationInsights.deliveries })}</span>
        </div>
        <ShopButton type="primary" aria-label={notificationActionPlanLabel} title={notificationActionPlanLabel} onClick={actionPlan.onClick}>{actionPlan.label}</ShopButton>
      </section>
    ) : null}
    {fetchError && notifications.length === 0 ? (
      <div data-notifications-load-recovery="true">
        <PageError
          className="notifications-page__loadError"
          title={t('common.loadFailed')}
          description={t('common.loadFailedRetry')}
          actions={[
            {
              key: 'retry',
              label: t('common.retry'),
              onClick: () => fetchNotifications(),
              type: 'primary',
            },
            {
              key: 'browse',
              label: t('pages.cart.browse'),
              onClick: () => navigate('/products'),
              type: 'default',
            },
            {
              key: 'coupons',
              label: t('pages.notifications.emptyCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'track',
              label: t('pages.notifications.emptyTrackOrder'),
              onClick: () => navigate('/track-order'),
              type: 'default',
            },
            {
              key: 'support',
              label: t('pages.productList.loadRecoverySupport'),
              onClick: () => dispatchDomEvent('shop:open-support'),
              type: 'default',
            },
          ]}
        />
      </div>
    ) : notifications.length === 0 ? (
      <PageEmpty
        className="notifications-page__emptyPanel"
        description={(
          <div className="notifications-page__emptyCopy">
            <h1 className="notifications-page__title">{t('pages.notifications.empty')}</h1>
            <div className="notifications-page__emptyHint">{t('pages.notifications.emptyHint')}</div>
          </div>
        )}
        actions={[
          {
            key: 'browse',
            label: t('pages.cart.browse'),
            onClick: () => navigate('/products'),
          },
          {
            key: 'coupons',
            label: t('pages.notifications.emptyCoupons'),
            onClick: () => navigate('/coupons'),
            type: 'default',
          },
          {
            key: 'track',
            label: t('pages.notifications.emptyTrackOrder'),
            onClick: () => navigate('/track-order'),
            type: 'default',
          },
        ]}
      />
    ) : (
      <>
        {fetchError ? (
          <ShopAlert
            className="notifications-page__staleAlert"
            type="warning"
            showIcon
            message={t('pages.notifications.fetchFailed')}
            description={t('pages.notifications.staleDataWarning')}
            action={<ShopButton size="small" onClick={() => fetchNotifications()}>{t('common.retry')}</ShopButton>}
          />
        ) : null}
        {filteredNotifications.length === 0 ? (
          <div className="notifications-page__filterEmpty" data-notifications-filter-empty="true">
            <div className="notifications-page__emptyCopy">
              <div>{t('pages.notifications.noFilterResults')}</div>
              <div className="notifications-page__emptyHint">{t('pages.notifications.noFilterResultsHint')}</div>
            </div>
            <div className="notifications-page__filterEmptyActions" data-notifications-filter-empty-actions="true">
              <ShopButton
                type="primary"
                aria-label={t('pages.notifications.clearFilter')}
                title={t('pages.notifications.clearFilter')}
                onClick={() => setQuickFilter('ALL')}
              >
                {t('pages.notifications.clearFilter')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={t('pages.cart.browse')}
                title={t('pages.cart.browse')}
                onClick={() => navigate('/products')}
              >
                {t('pages.cart.browse')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.gift} />}
                aria-label={t('pages.notifications.emptyCoupons')}
                title={t('pages.notifications.emptyCoupons')}
                onClick={() => navigate('/coupons')}
              >
                {t('pages.notifications.emptyCoupons')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.truck} />}
                aria-label={t('pages.notifications.emptyTrackOrder')}
                title={t('pages.notifications.emptyTrackOrder')}
                onClick={() => navigate('/track-order')}
              >
                {t('pages.notifications.emptyTrackOrder')}
              </ShopButton>
            </div>
          </div>
        ) : (
          <>
            <ul className="notifications-page__itemList" role="list">
              {filteredNotifications.map((item) => {
                const notificationName = item.title || formatNotificationType(item.type, t) || `#${item.id}`;
                const relatedOrderNo = extractOrderNoFromNotification(item);
                const relatedType = String(item.type || '').trim().toUpperCase();
                const {
                  openRelatedLabel,
                  markReadActionLabel,
                  deleteActionLabel,
                } = buildNotificationItemActionLabels({
                  t,
                  notificationName,
                  relatedOrderNo,
                  relatedType,
                });
                const showOpenRelated = Boolean(relatedOrderNo || relatedType === 'DELIVERY' || relatedType === 'ORDER' || relatedType === 'PROMOTION');
                return (
                  <li
                    key={item.id}
                    className={item.isRead ? 'notifications-page__item' : 'notifications-page__item notifications-page__item--unread'}
                  >
                    <div className="notifications-page__itemMeta">
                      <div className="notifications-page__itemBody">
                        <div className="notifications-page__itemActions">
                          <ShopTag color={typeColors[String(item.type || '').trim().toUpperCase()] || 'default'}>
                            {formatNotificationType(item.type, t)}
                          </ShopTag>
                          <button
                            type="button"
                            className="notifications-page__titleButton"
                            onClick={() => openRelatedNotification(item)}
                            aria-label={openRelatedLabel}
                            title={openRelatedLabel}
                          >
                            <span className={`notifications-page__text${!item.isRead ? ' notifications-page__text--strong' : ''}`}>{item.title}</span>
                          </button>
                          {item.isRead && <ShopIcon path={SI.checkCircle} className="notifications-page__readIcon" aria-hidden="true" />}
                        </div>
                        <div>
                          {renderMessage(item)}
                          <span className="notifications-page__text notifications-page__text--secondary notifications-page__timestamp">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="notifications-page__itemSideActions">
                      {showOpenRelated ? (
                        <ShopButton
                          size="small"
                          type="link"
                          aria-label={openRelatedLabel}
                          title={openRelatedLabel}
                          onClick={() => openRelatedNotification(item)}
                          disabled={notificationActionsDisabled}
                        >
                          {relatedOrderNo
                            ? (relatedType === 'DELIVERY' ? t('pages.notifications.actionTrackOrder') : t('pages.notifications.actionOpenOrders'))
                            : openRelatedLabel}
                        </ShopButton>
                      ) : null}
                      {!item.isRead ? (
                        <ShopButton
                          size="small"
                          type="link"
                          aria-label={markReadActionLabel}
                          title={markReadActionLabel}
                          onClick={() => handleMarkAsRead(item.id)}
                          disabled={notificationActionsDisabled}
                        >
                          {t('pages.notifications.markRead')}
                        </ShopButton>
                      ) : null}
                      <ShopPopconfirm
                        rootClassName='shop-mobile-popup-layer notifications-delete-popconfirm'
                        title={t('pages.notifications.deleteConfirm')}
                        onConfirm={() => handleDelete(item.id)}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                        disabled={notificationActionsDisabled}
                      >
                        <ShopButton
                          className="notifications-page__deleteButton"
                          size="small"
                          type="link"
                          danger
                          icon={<ShopIcon path={SI.delete} />}
                          aria-label={deleteActionLabel}
                          title={deleteActionLabel}
                          disabled={notificationActionsDisabled}
                        />
                      </ShopPopconfirm>
                    </div>
                  </li>
                );
              })}
            </ul>
            {hasMoreNotifications ? (
              <div className="notifications-page__loadMore">
                <span className="notifications-page__text notifications-page__text--secondary">{t('pages.notifications.loadedCount', { count: notifications.length })}</span>
                <ShopButton
                  onClick={() => fetchNotifications(notificationPage + 1, true)}
                  loading={loadingMore}
                  disabled={loadingMore}
                  aria-label={loadMoreActionLabel}
                  title={loadMoreActionLabel}
                >
                  {loadingMore ? t('pages.notifications.loadingMore') : t('pages.notifications.loadMore')}
                </ShopButton>
              </div>
            ) : null}
          </>
        )}
      </>
    )}
  </div>
);
