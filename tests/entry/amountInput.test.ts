import {
  amountDraftToCentavos,
  appendAmountKey,
  applyNumberPadKey,
  clearAmountDraft,
  deleteAmountDigit,
  formatAmountDraft,
  INITIAL_AMOUNT_DRAFT,
} from '@/features/entry/utils/amountInput';

describe('amount input state machine', () => {
  test('starts at zero', () => {
    expect(INITIAL_AMOUNT_DRAFT).toBe('0');
    expect(formatAmountDraft(INITIAL_AMOUNT_DRAFT)).toBe('₱0');
  });

  test('builds exact peso drafts and centavos', () => {
    let draft = appendAmountKey('0', '7');
    draft = appendAmountKey(draft, '0');
    draft = appendAmountKey(draft, '.');
    draft = appendAmountKey(draft, '5');
    expect(draft).toBe('70.5');
    expect(formatAmountDraft(draft)).toBe('₱70.5');
    expect(amountDraftToCentavos(draft)).toBe(7_050);
  });

  test('supports fractional amounts entered from zero', () => {
    const draft = appendAmountKey(appendAmountKey('0', '.'), '5');
    expect(draft).toBe('0.5');
    expect(amountDraftToCentavos(draft)).toBe(50);
  });

  test('preserves two decimal digits', () => {
    const draft = ['7', '0', '.', '5', '0'].reduce(
      (current, key) => appendAmountKey(current, key as '0' | '5' | '7' | '.'),
      '0'
    );
    expect(draft).toBe('70.50');
    expect(amountDraftToCentavos(draft)).toBe(7_050);
  });

  test('rejects a third decimal digit and a second decimal point', () => {
    expect(appendAmountKey('70.50', '1')).toBe('70.50');
    expect(appendAmountKey('70.5', '.')).toBe('70.5');
  });

  test('normalizes unnecessary leading zeros', () => {
    expect(appendAmountKey('0', '0')).toBe('0');
    expect(appendAmountKey('0', '7')).toBe('7');
  });

  test('supports backspace and clear', () => {
    expect(deleteAmountDigit('70.5')).toBe('70.');
    expect(deleteAmountDigit('7')).toBe('0');
    expect(deleteAmountDigit('0')).toBe('0');
    expect(clearAmountDraft()).toBe('0');
    expect(applyNumberPadKey('70', 'clear')).toBe('0');
  });

  test('rejects amounts beyond the maximum', () => {
    expect(appendAmountKey('9999999.99', '9')).toBe('9999999.99');
    expect(appendAmountKey('9999999', '9')).toBe('9999999');
  });

  test('zero and partial drafts are not saveable', () => {
    expect(amountDraftToCentavos('0')).toBeNull();
    expect(amountDraftToCentavos('0.')).toBeNull();
    expect(amountDraftToCentavos('0.0')).toBeNull();
  });

  test('normalizes a trailing decimal for a valid save', () => {
    expect(amountDraftToCentavos('70.')).toBe(7_000);
  });

  test('adds grouping without changing unfinished decimals', () => {
    expect(formatAmountDraft('1234.')).toBe('₱1,234.');
    expect(formatAmountDraft('1234.5')).toBe('₱1,234.5');
  });
});
