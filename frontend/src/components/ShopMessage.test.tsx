import ShopMessage from './ShopMessage';
import { subscribeAccessibleMessages, type AccessibleMessageAnnouncement } from '../utils/accessibleMessage';

describe('ShopMessage', () => {
  it('emits shell-toast announcements for static helpers', () => {
    const announcements: AccessibleMessageAnnouncement[] = [];
    const unsubscribe = subscribeAccessibleMessages((item) => announcements.push(item));

    ShopMessage.success('Saved');
    ShopMessage.error('Failed');
    ShopMessage.warning('Careful');
    ShopMessage.info('Note');
    ShopMessage.loading('Working');
    ShopMessage.open({ type: 'error', content: 'Open failed' });

    expect(announcements.map((item) => ({ text: item.text, type: item.type, shellToast: item.shellToast }))).toEqual([
      { text: 'Saved', type: 'success', shellToast: true },
      { text: 'Failed', type: 'error', shellToast: true },
      { text: 'Careful', type: 'warning', shellToast: true },
      { text: 'Note', type: 'info', shellToast: true },
      { text: 'Working', type: 'info', shellToast: true },
      { text: 'Open failed', type: 'error', shellToast: true },
    ]);

    unsubscribe();
  });

  it('returns a no-op closer and tolerates destroy/config', () => {
    const closer = ShopMessage.success('ok');
    expect(typeof closer).toBe('function');
    expect(() => closer()).not.toThrow();
    expect(() => ShopMessage.destroy()).not.toThrow();
    expect(() => ShopMessage.config({})).not.toThrow();
  });
});
