export const MAX_AMOUNT_CENTAVOS = 999_999_999;

const MONEY_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

export function toCentavos(input: string | number): number | null {
  if (typeof input === 'number') {
    return numberToCentavos(input);
  }

  const normalized = input.replace(/[₱,\s]/g, '');
  if (!MONEY_PATTERN.test(normalized)) {
    return null;
  }

  const [wholePart = '0', decimalPart = ''] = normalized.split('.');
  const wholeCentavos = Number(wholePart || '0') * 100;
  const decimalCentavos = Number(decimalPart.padEnd(2, '0'));
  const centavos = wholeCentavos + decimalCentavos;

  if (!Number.isSafeInteger(centavos) || centavos <= 0 || centavos > MAX_AMOUNT_CENTAVOS) {
    return null;
  }

  return centavos;
}

function numberToCentavos(input: number): number | null {
  if (!Number.isFinite(input) || input <= 0) {
    return null;
  }

  const scaled = input * 100;
  const rounded = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;

  if (Math.abs(scaled - rounded) > tolerance) {
    return null;
  }
  if (!Number.isSafeInteger(rounded) || rounded < 1 || rounded > MAX_AMOUNT_CENTAVOS) {
    return null;
  }

  return rounded;
}

type FormatPesoOptions = {
  hideZeroDecimals?: boolean;
};

export function formatPeso(centavos: number, options: FormatPesoOptions = {}): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError('Centavos must be a safe integer.');
  }

  const sign = centavos < 0 ? '-' : '';
  const absoluteCentavos = Math.abs(centavos);
  const wholePesos = Math.floor(absoluteCentavos / 100);
  const decimalCentavos = absoluteCentavos % 100;
  const groupedPesos = String(wholePesos).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals =
    options.hideZeroDecimals && decimalCentavos === 0
      ? ''
      : `.${String(decimalCentavos).padStart(2, '0')}`;

  return `${sign}₱${groupedPesos}${decimals}`;
}
