import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { UserAddress } from '../types';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopProgress from '../components/ShopProgress';
import ShopTag from '../components/ShopTag';
import { dispatchDomEvent } from '../utils/domEvents';

type ProfileAddressesPanelProps = {
  addressReadinessProgress: number;
  addressReadinessText: string;
  addresses: UserAddress[];
  addressesLoadFailed: boolean;
  addressesMissingDetailCount: number;
  addressesMissingPhoneCount: number;
  addressesStale: boolean;
  defaultAddressReady: boolean;
  fetchAddresses: () => void | Promise<void>;
  handleDeleteAddress: (id: number) => void | Promise<void>;
  handleSetDefault: (id: number) => void | Promise<void>;
  navigate: (path: string) => void;
  openAddressModal: (address?: UserAddress) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile addresses tab panel:
 * readiness summary, load/empty recovery, and address cards.
 */
export const ProfileAddressesPanel: React.FC<ProfileAddressesPanelProps> = ({
  addressReadinessProgress,
  addressReadinessText,
  addresses,
  addressesLoadFailed,
  addressesMissingDetailCount,
  addressesMissingPhoneCount,
  addressesStale,
  defaultAddressReady,
  fetchAddresses,
  handleDeleteAddress,
  handleSetDefault,
  navigate,
  openAddressModal,
  t,
}) => (
  <>
              <div>
                <div className="profile-address-readiness">
                  <div className="profile-address-readiness__copy">
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.addressReadinessTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{addressReadinessText}</span>
                    <ShopProgress percent={addressReadinessProgress} size="small" strokeColor="#124734" />
                  </div>
                  <div className="profile-address-readiness__stats">
                    <span>
                      <strong>{defaultAddressReady ? 1 : 0}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressDefaultReady')}</span>
                    </span>
                    <span>
                      <strong>{addressesMissingPhoneCount}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressMissingPhone')}</span>
                    </span>
                    <span>
                      <strong>{addressesMissingDetailCount}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressMissingDetail')}</span>
                    </span>
                  </div>
                </div>
                <ShopButton
                  className="profile-block-button profile-section-action"
                  type="dashed"
                  icon={<ShopIcon path={SI.plus} />}
                  block
                  disabled={addressesStale}
                  title={addressesStale ? t('pages.profile.addressesStaleWarning') : undefined}
                  onClick={() => openAddressModal()}
                >
                  {t('pages.profile.addAddress')}
                </ShopButton>
                {addressesStale && (
                  <ShopAlert
                    type="warning"
                    showIcon
                    message={t('pages.profile.addressesStaleTitle')}
                    description={t('pages.profile.addressesStaleWarning')}
                    action={<ShopButton size="small" onClick={() => fetchAddresses()}>{t('common.retry')}</ShopButton>}
                  />
                )}
                {addressesLoadFailed && addresses.length === 0 ? (
                  <div data-profile-addresses-load-recovery="true">
                    <PageError
                      className="profile-section-card profile-load-error"
                      title={t('common.loadFailed')}
                      description={t('common.loadFailedRetry')}
                      actions={[
                        {
                          key: 'retry',
                          label: t('common.retry'),
                          onClick: () => fetchAddresses(),
                          type: 'primary',
                        },
                        {
                          key: 'checkout',
                          label: t('pages.cart.checkout'),
                          onClick: () => navigate('/checkout'),
                          type: 'default',
                        },
                        {
                          key: 'track',
                          label: t('nav.trackOrder'),
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
                ) : addresses.length === 0 ? (
                  <PageEmpty
                    className="profile-empty-addresses"
                    data-profile-addresses-empty-actions="true"
                    description={(
                      <div className="profile-empty-orders__copy">
                        <div>{t('pages.profile.noAddresses')}</div>
                        <div className="profile-empty-orders__hint">{t('pages.profile.addressReadinessEmpty')}</div>
                      </div>
                    )}
                    actions={[
                      {
                        key: 'add-address',
                        label: t('pages.profile.addAddress'),
                        onClick: () => openAddressModal(),
                      },
                      {
                        key: 'shop',
                        label: t('pages.profile.goShopping'),
                        onClick: () => navigate('/products'),
                        type: 'default',
                      },
                      {
                        key: 'coupons',
                        label: t('pages.profile.emptyOrdersCoupons'),
                        onClick: () => navigate('/coupons'),
                        type: 'default',
                      },
                      {
                        key: 'track',
                        label: t('pages.profile.authGateTrackOrder'),
                        onClick: () => navigate('/track-order'),
                        type: 'default',
                      },
                    ]}
                  />
                ) : (
                  <ul className="profile-page__itemList profile-page__addressList" role="list">
                    {addresses.map((address) => {
                      const addressLabel = [address.recipientName, address.phone, address.address].filter(Boolean).join(' / ') || `#${address.id}`;
                      const defaultActionLabel = `${t('pages.profile.setDefault')}: ${addressLabel}`;
                      const editActionLabel = `${t('common.edit')}: ${addressLabel}`;
                      const deleteActionLabel = `${t('common.delete')}: ${addressLabel}`;
                      return (
                      <li key={address.id} className="profile-page__item">
                      <section className="profile-section-card profile-address-card">
                        <div className="profile-address-card__content">
                          <div>
                            <div className="profile-page__inlineRow">
                              <span className="profile-page__text profile-page__text--strong">{address.recipientName}</span>
                              <span className="profile-page__text profile-page__text--secondary">{address.phone}</span>
                              {address.isDefault && <ShopTag color="orange">{t('pages.checkout.defaultAddress')}</ShopTag>}
                            </div>
                            <div className="profile-address-card__address"><span className="profile-page__text">{address.address}</span></div>
                          </div>
                            <div className="profile-page__chipRow">
                              {!address.isDefault ? (
                              <ShopButton size="small" icon={<ShopIcon path={SI.starOutline} />} aria-label={defaultActionLabel} title={defaultActionLabel} disabled={addressesStale} onClick={() => handleSetDefault(address.id)}>{t('pages.profile.setDefault')}</ShopButton>
                            ) : (
                              <ShopButton size="small" icon={<ShopIcon path={SI.star} />} disabled type="primary">{t('pages.profile.defaultAddressButton')}</ShopButton>
                            )}
                            <ShopButton size="small" icon={<ShopIcon path={SI.edit} />} aria-label={editActionLabel} title={editActionLabel} disabled={addressesStale} onClick={() => openAddressModal(address)}>{t('common.edit')}</ShopButton>
                            <ShopPopconfirm
                              rootClassName='shop-mobile-popup-layer profile-popconfirm'
                              title={t('pages.profile.deleteAddressConfirm')}
                              onConfirm={() => handleDeleteAddress(address.id)}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                            >
                              <ShopButton size="small" danger icon={<ShopIcon path={SI.delete} />} aria-label={deleteActionLabel} title={deleteActionLabel} disabled={addressesStale}>{t('common.delete')}</ShopButton>
                            </ShopPopconfirm>
                          </div>
                        </div>
                      </section>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>

  </>
);

export default ProfileAddressesPanel;
