import { MAX_AMOUNT_CENTAVOS, toCentavos } from '@/lib/money';

export type DigitKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type NumberPadKey = DigitKey | '.' | 'backspace' | 'clear';

export const INITIAL_AMOUNT_DRAFT = '0';

function isZeroDraft(draft: string): boolean {
  return /^0(?:\.0{0,2})?$/.test(draft);
}

export function appendAmountKey(draft: string, key: DigitKey | '.'): string {
  if (key === '.') {
    return draft.includes('.') ? draft : `${draft}.`;
  }

  const decimalIndex = draft.indexOf('.');
  if (decimalIndex >= 0 && draft.length - decimalIndex - 1 >= 2) {
    return draft;
  }

  const candidate = draft === '0' ? key : `${draft}${key}`;
  if (candidate === '0' || isZeroDraft(candidate)) {
    return candidate;
  }

  const centavos = toCentavos(candidate);
  return centavos !== null && centavos <= MAX_AMOUNT_CENTAVOS ? candidate : draft;
}

export function deleteAmountDigit(draft: string): string {
  if (draft.length <= 1) {
    return INITIAL_AMOUNT_DRAFT;
  }

  const nextDraft = draft.slice(0, -1);
  return nextDraft || INITIAL_AMOUNT_DRAFT;
}

export function clearAmountDraft(): string {
  return INITIAL_AMOUNT_DRAFT;
}

export function applyNumberPadKey(draft: string, key: NumberPadKey): string {
  if (key === 'clear') {
    return clearAmountDraft();
  }
  if (key === 'backspace') {
    return deleteAmountDigit(draft);
  }
  return appendAmountKey(draft, key);
}

export function normalizeAmountDraftForSave(draft: string): string {
  return draft.endsWith('.') ? draft.slice(0, -1) : draft;
}

export function amountDraftToCentavos(draft: string): number | null {
  return toCentavos(normalizeAmountDraftForSave(draft));
}

export function centavosToAmountDraft(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new RangeError('Centavos must be a non-negative safe integer.');
  }

  const whole = Math.floor(centavos / 100);
  const fraction = centavos % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
}

export function formatAmountDraft(draft: string): string {
  if (draft === INITIAL_AMOUNT_DRAFT) {
    return '₱0';
  }

  const [wholePart = '0', fractionPart] = draft.split('.');
  const groupedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionPart === undefined ? `₱${groupedWhole}` : `₱${groupedWhole}.${fractionPart}`;
}
