import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { PetProfile } from '../types';
import PageEmpty from '../components/PageEmpty';
import ShopButton from '../components/ShopButton';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopProgress from '../components/ShopProgress';
import ShopTag from '../components/ShopTag';

type ProfilePetsPanelProps = {
  handleDeletePet: (id: number) => void | Promise<void>;
  navigate: (path: string) => void;
  openPetModal: (pet?: PetProfile) => void;
  openPetShoppingPath: (pet?: PetProfile | null) => void;
  petCompletenessText: string;
  petProfileFocus: PetProfile | null;
  petProfileProgress: number;
  petProfiles: PetProfile[];
  petSizeLabel: (value?: string) => string;
  petTypeLabel: (value?: string) => string;
  petsMissingBirthdayCount: number;
  petsMissingFitCount: number;
  petProfileFocusText: string;
  profilePetShoppingFocus: PetProfile | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile pets tab panel:
 * completeness insights, shopping path, empty recovery, and pet cards.
 */
export const ProfilePetsPanel: React.FC<ProfilePetsPanelProps> = ({
  handleDeletePet,
  navigate,
  openPetModal,
  openPetShoppingPath,
  petCompletenessText,
  petProfileFocus,
  petProfileFocusText,
  petProfileProgress,
  petProfiles,
  petSizeLabel,
  petTypeLabel,
  petsMissingBirthdayCount,
  petsMissingFitCount,
  profilePetShoppingFocus,
  t,
}) => (
  <>
              <div>
                <div className="profile-pet-insights">
                  <section className="profile-pet-insights__card">
                    <div className="profile-page__stack">
                      <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petCompletenessTitle')}</span>
                      <span className="profile-page__text profile-page__text--secondary">{petCompletenessText}</span>
                      <ShopProgress percent={petProfileProgress} size="small" strokeColor="#ff4d00" />
                    </div>
                  </section>
                  <section className="profile-pet-insights__card">
                    <div className="profile-page__stack">
                      <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petBirthdayPerkTitle')}</span>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.petBirthdayPerkText')}</span>
                      <div className="profile-page__chipRow">
                        <ShopTag color={petsMissingBirthdayCount > 0 ? 'gold' : 'green'}>{t('pages.profile.petMissingBirthday', { count: petsMissingBirthdayCount })}</ShopTag>
                        <ShopTag color={petsMissingFitCount > 0 ? 'orange' : 'green'}>{t('pages.profile.petMissingFit', { count: petsMissingFitCount })}</ShopTag>
                      </div>
                    </div>
                  </section>
                </div>
                <div className="profile-pet-next-step">
                  <div>
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petProfileActionTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{petProfileFocusText}</span>
                  </div>
                  <ShopButton
                    type="primary"
                    onClick={() => petProfileFocus ? openPetModal(petProfileFocus) : openPetModal()}
                  >
                    {petProfileFocus ? t('pages.profile.completePetProfile') : t('pages.profile.addPet')}
                  </ShopButton>
                </div>
                <div className="profile-pet-shop-path">
                  <div>
                    <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.petShopPathEyebrow')}</span>
                    <span className="profile-page__text profile-page__text--strong">
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathTitleWithName', { name: profilePetShoppingFocus.name })
                        : t('pages.profile.petShopPathTitle')}
                    </span>
                    <span className="profile-page__text profile-page__text--secondary">
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathText', {
                          type: petTypeLabel(profilePetShoppingFocus.petType),
                          size: petSizeLabel(profilePetShoppingFocus.size),
                        })
                        : t('pages.profile.petShopPathEmpty')}
                    </span>
                  </div>
                  <div className="profile-pet-shop-path__actions">
                    {profilePetShoppingFocus ? (
                      <ShopTag color="green">{t('pages.profile.petShopPathSignalReady')}</ShopTag>
                    ) : (
                      <ShopTag color="gold">{t('pages.profile.petShopPathNeedsProfile')}</ShopTag>
                    )}
                    <ShopButton
                      icon={<ShopIcon path={SI.cart} />}
                      onClick={() => profilePetShoppingFocus ? openPetShoppingPath(profilePetShoppingFocus) : openPetModal()}
                    >
                      {profilePetShoppingFocus ? t('pages.profile.shopForThisPet') : t('pages.profile.addPet')}
                    </ShopButton>
                  </div>
                </div>
                <ShopButton className="profile-block-button profile-section-action" type="dashed" icon={<ShopIcon path={SI.plus} />} block onClick={() => openPetModal()}>
                  {t('pages.profile.addPet')}
                </ShopButton>
                {petProfiles.length === 0 ? (
                  <PageEmpty
                    className="profile-pets-empty"
                    description={(
                      <div className="profile-pets-empty__copy">
                        <div>{t('pages.profile.noPets')}</div>
                        <div className="profile-pets-empty__hint">{t('pages.profile.noPetsHint')}</div>
                      </div>
                    )}
                    actions={[
                      {
                        key: 'add-pet',
                        label: t('pages.profile.addPet'),
                        onClick: () => openPetModal(),
                      },
                      {
                        key: 'pet-finder',
                        label: t('pages.profile.noPetsFindFit'),
                        onClick: () => navigate('/pet-finder'),
                        type: 'default',
                      },
                      {
                        key: 'browse',
                        label: t('pages.profile.noPetsBrowse'),
                        onClick: () => navigate('/products'),
                        type: 'default',
                      },
                    ]}
                  />
                ) : (
                  <ul className="profile-page__itemList profile-page__petGrid" role="list">
                    {petProfiles.map((pet) => {
                      const petLabel = pet.name || `#${pet.id}`;
                      const editActionLabel = `${t('common.edit')}: ${petLabel}`;
                      const deleteActionLabel = `${t('common.delete')}: ${petLabel}`;
                      const shopActionLabel = `${t('pages.profile.shopForThisPet')}: ${petLabel}`;
                      return (
                      <li key={pet.id} className="profile-page__item profile-page__petGridItem">
                        <section className="profile-section-card profile-pet-card"><div className="shop-panel__head"><div className="shop-panel__title">{pet.name}</div><div className="shop-panel__extra">{<ShopTag color="green">{petTypeLabel(pet.petType)}</ShopTag>}</div></div>
                          <div className="profile-page__stack">
                            <span className="profile-page__text">{t('pages.profile.petBreed')}: {pet.breed || t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petBirthday')}: {pet.birthday || t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petWeight')}: {pet.weight ? t('pages.profile.petWeightValue', { weight: pet.weight }) : t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petSize')}: {petSizeLabel(pet.size)}</span>
                            {pet.birthday ? <ShopTag color="gold">{t('pages.profile.birthdayCouponEnabled')}</ShopTag> : null}
                            <div className="profile-page__chipRow">
                              <ShopButton size="small" icon={<ShopIcon path={SI.cart} />} aria-label={shopActionLabel} title={shopActionLabel} onClick={() => openPetShoppingPath(pet)}>
                                {t('pages.profile.shopForThisPet')}
                              </ShopButton>
                              <ShopButton size="small" icon={<ShopIcon path={SI.edit} />} aria-label={editActionLabel} title={editActionLabel} onClick={() => openPetModal(pet)}>
                                {t('common.edit')}
                              </ShopButton>
                              <ShopPopconfirm
                                rootClassName='shop-mobile-popup-layer profile-popconfirm'
                                title={t('pages.profile.deletePetConfirm')}
                                onConfirm={() => handleDeletePet(pet.id)}
                                okText={t('common.confirm')}
                                cancelText={t('common.cancel')}
                                okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                              >
                                <ShopButton size="small" danger icon={<ShopIcon path={SI.delete} />} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</ShopButton>
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

export default ProfilePetsPanel;
