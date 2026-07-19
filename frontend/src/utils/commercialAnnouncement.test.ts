import {
  commercialAnnouncementRejectionReason,
  isCommercialAnnouncement,
  isCommercialAnnouncementCopy,
} from './commercialAnnouncement';

describe('commercialAnnouncement', () => {
  it('accepts customer-facing promo copy', () => {
    expect(isCommercialAnnouncementCopy(
      'Free shipping this week',
      'Spend $49 or more and unlock free nationwide shipping on pet essentials.',
    )).toBe(true);
    expect(isCommercialAnnouncement({
      title: 'Spring pet sale',
      content: 'Save on beds, toys, and smart feeders while inventory lasts.',
    })).toBe(true);
  });

  it('rejects placeholder and gibberish announcement copy', () => {
    expect(isCommercialAnnouncementCopy('TEST fast', 'sadsadsafffffqewqe1231413214132141231')).toBe(false);
    expect(isCommercialAnnouncementCopy('lorem ipsum', 'placeholder banner for qa')).toBe(false);
    expect(isCommercialAnnouncementCopy('demo', 'xxx')).toBe(false);
    expect(isCommercialAnnouncementCopy('hello world', 'asdfgh keyboard mash')).toBe(false);
    expect(isCommercialAnnouncementCopy('', '')).toBe(false);
    expect(isCommercialAnnouncementCopy('12345678901234', '!!!!!!!!')).toBe(false);
    expect(commercialAnnouncementRejectionReason('sample offer', 'tmp content')).toBe('placeholder');
    expect(commercialAnnouncementRejectionReason('', '')).toBe('empty');
    expect(commercialAnnouncementRejectionReason('Weekend deal', 'Buy one treat bag and get a toy accessory guide.')).toBe(null);
  });
});
