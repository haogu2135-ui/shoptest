import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { UserAddress, UserProfile, PetProfile } from '../types';
import ShopButton from '../components/ShopButton';
import ShopProgress from '../components/ShopProgress';
import ShopTag from '../components/ShopTag';

type ProfileInfoPanelProps = {
  accountHealthScore: number;
  addresses: UserAddress[];
  defaultAddressReady: boolean;
  openEditModal: () => void;
  petProfiles: PetProfile[];
  setPasswordModalVisible: (visible: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  user: UserProfile;
};

/**
 * Commercial profile info tab:
 * account health score, identity summary, and security entry actions.
 */
export const ProfileInfoPanel: React.FC<ProfileInfoPanelProps> = ({
  accountHealthScore,
  addresses,
  defaultAddressReady,
  openEditModal,
  petProfiles,
  setPasswordModalVisible,
  t,
  user,
}) => (
              <section className="profile-section-card">
                <div className="profile-health-panel">
                  <div>
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.accountHealthTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.accountHealthText')}</span>
                  </div>
                  <ShopProgress type="circle" percent={accountHealthScore} size={72} strokeColor="#124734" />
                  <div className="profile-health-panel__chips">
                    <ShopTag color={user.email ? 'green' : 'gold'}>{t('pages.profile.accountHealthEmail')}</ShopTag>
                    <ShopTag color={user.phone ? 'green' : 'gold'}>{t('pages.profile.accountHealthPhone')}</ShopTag>
                    <ShopTag color={defaultAddressReady ? 'green' : 'gold'}>{t('pages.profile.accountHealthDefaultAddress')}</ShopTag>
                    <ShopTag color={petProfiles.length > 0 ? 'green' : 'gold'}>{t('pages.profile.accountHealthPet')}</ShopTag>
                  </div>
                </div>
                <dl className="profile-page__descList">
                  <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.username')}</dt>
                <dd className="profile-page__descValue">{user.username}</dd>
              </div>
                  <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.email')}</dt>
                <dd className="profile-page__descValue">{user.email || t('common.unset')}</dd>
              </div>
                  <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.phone')}</dt>
                <dd className="profile-page__descValue">{user.phone || t('common.unset')}</dd>
              </div>
                  <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.defaultAddress')}</dt>
                <dd className="profile-page__descValue">{addresses.find((item) => item.isDefault)?.address || t('common.unset')}</dd>
              </div>
                </dl>
                <div className="profile-info-actions">
                  <ShopButton icon={<ShopIcon path={SI.edit} />} onClick={openEditModal}>{t('pages.profile.editProfile')}</ShopButton>
                  <ShopButton icon={<ShopIcon path={SI.lock} />} onClick={() => setPasswordModalVisible(true)}>{t('pages.profile.changePassword')}</ShopButton>
                </div>
              </section>

);

export default ProfileInfoPanel;
