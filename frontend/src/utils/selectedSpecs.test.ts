import { formatSelectedSpecs, parseSelectedSpecs } from './selectedSpecs';

describe('selectedSpecs', () => {
  it('trims primitive values and drops empty or object specs', () => {
    expect(parseSelectedSpecs(JSON.stringify({
      Size: ' Small ',
      Color: '',
      Meta: { nested: true },
      Count: 2,
    }))).toEqual({
      Size: 'Small',
      Count: '2',
    });
  });

  it('does not render object values as object Object', () => {
    const label = formatSelectedSpecs(JSON.stringify({
      Size: 'S',
      Bad: { nested: true },
    }));

    expect(label).toBe('Size: S');
    expect(label).not.toContain('[object Object]');
  });

  it('renders bundle metadata without reparsing unsafe display values', () => {
    const label = formatSelectedSpecs(JSON.stringify({
      Size: 'S',
      _purchaseMode: 'bundle',
      _bundleItems: 'Bowl x2',
    }));

    expect(label).toBe('Size: S / Bundle deal / Bowl x2');
  });
});
