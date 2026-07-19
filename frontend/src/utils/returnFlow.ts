export const RETURN_REASON_MIN_LENGTH = 8;
export const RETURN_REASON_MAX_LENGTH = 500;
export const RETURN_TRACKING_MIN_LENGTH = 6;
export const RETURN_TRACKING_MAX_LENGTH = 120;

export type ReturnReasonPresetKey =
  | 'damaged'
  | 'wrongItem'
  | 'notAsDescribed'
  | 'sizeFit'
  | 'changedMind'
  | 'other';

export const RETURN_REASON_PRESET_KEYS: ReturnReasonPresetKey[] = [
  'damaged',
  'wrongItem',
  'notAsDescribed',
  'sizeFit',
  'changedMind',
  'other',
];

export const normalizeReturnReason = (value?: string | null) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizeReturnTrackingNumber = (value?: string | null) => String(value || '')
  .replace(/\s+/g, '')
  .trim()
  .toUpperCase();

export const isReturnReasonReady = (value?: string | null) => {
  const normalized = normalizeReturnReason(value);
  return normalized.length >= RETURN_REASON_MIN_LENGTH && normalized.length <= RETURN_REASON_MAX_LENGTH;
};

export const isReturnTrackingReady = (value?: string | null) => {
  const normalized = normalizeReturnTrackingNumber(value);
  if (normalized.length < RETURN_TRACKING_MIN_LENGTH || normalized.length > RETURN_TRACKING_MAX_LENGTH) {
    return false;
  }
  return /^[A-Z0-9][A-Z0-9-]{4,118}[A-Z0-9]$/i.test(normalized);
};

export const returnReasonPresetI18nKey = (preset: ReturnReasonPresetKey) =>
  `pages.profile.returnReasonPreset.${preset}`;

export const returnFlowStepI18nKeys = [
  'pages.profile.returnStepRequest',
  'pages.profile.returnStepReview',
  'pages.profile.returnStepShip',
  'pages.profile.returnStepRefund',
] as const;
