const DANGEROUS_SPREADSHEET_PREFIXES = new Set(['=', '+', '-', '@']);

export const preventCsvFormulaInjection = (value: string) => {
  const formulaCandidate = value.trimStart();
  if (!formulaCandidate) {
    return value;
  }
  return DANGEROUS_SPREADSHEET_PREFIXES.has(formulaCandidate.charAt(0))
    ? `'${value}`
    : value;
};

export const csvCell = (value: unknown) => {
  const safeValue = preventCsvFormulaInjection(String(value ?? ''));
  let escapedValue = '';
  for (const char of safeValue) escapedValue += char === '"' ? '""' : char;
  return `"${escapedValue}"`;
};

export const csvRow = (values: unknown[]) => {
  let row = '';
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) row += ',';
    row += csvCell(values[index]);
  }
  return row;
};
