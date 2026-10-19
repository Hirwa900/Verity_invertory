const MAX_CENTS = 999999999999n;

const toCents = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;

  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0') || '0');
  const signedCents = match[1] ? -cents : cents;
  return signedCents >= -MAX_CENTS && signedCents <= MAX_CENTS ? Number(signedCents) : null;
};

const fromCents = (cents) => {
  const value = BigInt(Math.trunc(cents));
  const absolute = value < 0n ? -value : value;
  const amount = `${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  return value < 0n ? `-${amount}` : amount;
};

module.exports = { MAX_CENTS, toCents, fromCents };
