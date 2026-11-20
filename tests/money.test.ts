import { formatPeso, MAX_AMOUNT_CENTAVOS, toCentavos } from '@/lib/money';

describe('toCentavos', () => {
  test.each([
    ['70', 7_000],
    ['70.5', 7_050],
    ['70.50', 7_050],
    ['1,234.5', 123_450],
    ['₱70', 7_000],
    ['.5', 50],
    [' ₱ 1,234.50 ', 123_450],
    ['9,999,999.99', MAX_AMOUNT_CENTAVOS],
  ])('parses %s exactly', (input, expected) => {
    expect(toCentavos(input)).toBe(expected);
  });

  test.each(['0', '-5', '7.123', 'abc', '', '10,000,000'])('rejects %s', (input) => {
    expect(toCentavos(input)).toBeNull();
  });

  test('accepts harmless floating-point noise', () => {
    expect(toCentavos(0.1 + 0.2)).toBe(30);
  });

  test('rejects numbers that are not representable to two decimals', () => {
    expect(toCentavos(1.005)).toBeNull();
  });
});

describe('formatPeso', () => {
  test('uses deterministic peso and thousands formatting', () => {
    expect(formatPeso(123_450)).toBe('₱1,234.50');
  });

  test('can hide zero decimal places', () => {
    expect(formatPeso(7_000, { hideZeroDecimals: true })).toBe('₱70');
    expect(formatPeso(7_050, { hideZeroDecimals: true })).toBe('₱70.50');
  });
});
