import { csvCell, csvRow, preventCsvFormulaInjection } from './csvExport';

describe('csvExport', () => {
  it('quotes values and escapes embedded quotes', () => {
    expect(csvCell('Harness "Pro", small')).toBe('"Harness ""Pro"", small"');
  });

  it('prefixes spreadsheet formula payloads', () => {
    expect(csvCell('=HYPERLINK("https://example.com")')).toBe('"\'=HYPERLINK(""https://example.com"")"');
    expect(csvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"');
    expect(csvCell('-10+20')).toBe('"\'-10+20"');
    expect(csvCell('@cmd')).toBe('"\'@cmd"');
  });

  it('detects formulas after leading whitespace without changing normal text', () => {
    expect(preventCsvFormulaInjection('  =1+1')).toBe("'  =1+1");
    expect(csvCell('Safe harness')).toBe('"Safe harness"');
  });

  it('builds rows from protected cells', () => {
    expect(csvRow(['name', '=bad'])).toBe('"name","\'=bad"');
  });
});
