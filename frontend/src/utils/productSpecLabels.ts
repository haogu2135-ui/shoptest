const PRODUCT_SPEC_LABEL_KEYS: Record<string, string> = {
  'pet size': 'petSize',
  capacity: 'capacity',
  material: 'material',
  color: 'color',
  size: 'size',
  weight: 'weight',
  volume: 'volume',
  pack: 'pack',
  filter: 'filter',
  formula: 'formula',
  closure: 'closure',
  care: 'care',
  flavor: 'flavor',
  'life stage': 'lifeStage',
  'coat type': 'coatType',
};

type Translate = (key: string) => string;

export const formatProductSpecLabel = (value: string, t: Translate) => {
  const rawValue = String(value || '').trim();
  const labelKey = PRODUCT_SPEC_LABEL_KEYS[rawValue.toLowerCase()];
  return labelKey ? t(`productSpecs.${labelKey}`) : rawValue;
};
