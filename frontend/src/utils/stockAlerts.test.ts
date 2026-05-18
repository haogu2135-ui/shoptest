import { addStockAlert, readStockAlerts, removeStockAlert } from './stockAlerts';

describe('stockAlerts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deduplicates and drops malformed stock alerts from storage', () => {
    localStorage.setItem('shop-stock-alerts', JSON.stringify([
      { productId: 1, productName: 'Harness', createdAt: '2026-01-01T00:00:00.000Z' },
      { productId: '1', productName: 'Harness duplicate', createdAt: '2026-01-02T00:00:00.000Z' },
      { productId: 2.5, productName: 'Fractional', createdAt: '2026-01-02T00:00:00.000Z' },
      { productId: -2, productName: 'Invalid', createdAt: '2026-01-03T00:00:00.000Z' },
      { productId: 3, productName: '', createdAt: '2026-01-04T00:00:00.000Z' },
    ]));

    expect(readStockAlerts()).toEqual([
      { productId: 1, productName: 'Harness', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('does not add duplicate alerts', () => {
    addStockAlert({ id: 5, name: 'Bowl', imageUrl: '' });
    const result = addStockAlert({ id: 5, name: 'Bowl', imageUrl: '' });

    expect(result.status).toBe('exists');
    expect(readStockAlerts()).toHaveLength(1);
  });

  it('rejects malformed products before adding alerts', () => {
    const result = addStockAlert({ id: 0, name: '', imageUrl: '' });

    expect(result.status).toBe('invalid');
    expect(readStockAlerts()).toEqual([]);
  });

  it('normalizes dates and ignores invalid remove ids', () => {
    addStockAlert({ id: 9, name: ' Food ', imageUrl: ' /food.png ' });
    localStorage.setItem('shop-stock-alerts', JSON.stringify([
      { ...readStockAlerts()[0], createdAt: 'not-a-date' },
    ]));

    removeStockAlert(Number.NaN);

    expect(readStockAlerts()).toHaveLength(1);
    expect(Number.isFinite(new Date(readStockAlerts()[0].createdAt).getTime())).toBe(true);
    expect(readStockAlerts()[0].imageUrl).toBe('/food.png');
  });

  it('does not throw when alert storage writes are unavailable', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => addStockAlert({ id: 7, name: 'Food', imageUrl: '' })).not.toThrow();

    setItemSpy.mockRestore();
  });
});
