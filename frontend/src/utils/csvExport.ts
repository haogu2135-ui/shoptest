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
  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const csvRow = (values: unknown[]) => values.map(csvCell).join(',');
