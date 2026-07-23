import { handleRovingTablistKeyDown, resolveRovingTabIndex } from './tablistKeyboard';

describe('tablistKeyboard', () => {
  const keys = ['details', 'specs', 'service'];

  it('moves with arrows and wraps by default', () => {
    expect(resolveRovingTabIndex(keys, 'details', 'ArrowRight')).toBe(1);
    expect(resolveRovingTabIndex(keys, 'service', 'ArrowRight')).toBe(0);
    expect(resolveRovingTabIndex(keys, 'details', 'ArrowLeft')).toBe(2);
    expect(resolveRovingTabIndex(keys, 'specs', 'Home')).toBe(0);
    expect(resolveRovingTabIndex(keys, 'details', 'End')).toBe(2);
  });

  it('supports vertical orientation without treating horizontal arrows as moves', () => {
    expect(resolveRovingTabIndex(keys, 'details', 'ArrowDown', { orientation: 'vertical' })).toBe(1);
    expect(resolveRovingTabIndex(keys, 'details', 'ArrowRight', { orientation: 'vertical' })).toBeNull();
  });

  it('activates the next tab and focuses the target element after commit', () => {
    jest.useFakeTimers();
    const onActivate = jest.fn();
    const focus = jest.fn();
    const preventDefault = jest.fn();
    const getElementById = jest.spyOn(document, 'getElementById').mockReturnValue({ focus } as unknown as HTMLElement);

    const handled = handleRovingTablistKeyDown(
      { key: 'ArrowRight', preventDefault },
      {
        tabKeys: keys,
        activeKey: 'details',
        onActivate,
        getTabElementId: (key) => `product-detail-tab-${key}`,
      },
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(onActivate).toHaveBeenCalledWith('specs');
    expect(focus).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(getElementById).toHaveBeenCalledWith('product-detail-tab-specs');
    expect(focus).toHaveBeenCalled();

    getElementById.mockRestore();
    jest.useRealTimers();
  });
});
