import { buildHomeMobileQuickActionDescriptors } from './homeHelpers';

describe('home mobile quick actions', () => {
  it('keeps flash sales discoverable without removing existing commerce actions', () => {
    const actions = buildHomeMobileQuickActionDescriptors({
      t: (key) => key,
      isAuthenticated: false,
    });

    expect(actions).toHaveLength(9);
    expect(actions.map((action) => action.key)).toEqual([
      'orders',
      'cart',
      'coupons',
      'seckill',
      'wishlist',
      'track',
      'support',
      'finder',
      'history',
    ]);
    expect(actions.find((action) => action.key === 'seckill')).toMatchObject({
      label: 'nav.seckill',
      iconKey: 'thunder',
      intent: 'seckill',
    });
  });
});
