export function formatRWF(cents, { decimals = 2 } = {}) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMoney(cents, { decimals = 2 } = {}) {
  return `RWF ${formatRWF(cents, { decimals })}`;
}

export function parseToCents(input) {
  if (input === '' || input === null || input === undefined) return NaN;
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}
