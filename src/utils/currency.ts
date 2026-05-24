export function getCurrencyInfo(currencyCode: string) {
  const exceptions: Record<string, { countryCode: string; name: string }> = {
    EUR: { countryCode: 'eu', name: 'Eurozone' },
    GBP: { countryCode: 'gb', name: 'United Kingdom' },
    AUD: { countryCode: 'au', name: 'Australia' },
    CAD: { countryCode: 'ca', name: 'Canada' },
    CHF: { countryCode: 'ch', name: 'Switzerland' },
    CNY: { countryCode: 'cn', name: 'China' },
    HKD: { countryCode: 'hk', name: 'Hong Kong' },
    NZD: { countryCode: 'nz', name: 'New Zealand' },
    KRW: { countryCode: 'kr', name: 'South Korea' },
    ZAR: { countryCode: 'za', name: 'South Africa' },
    TWD: { countryCode: 'tw', name: 'Taiwan' },
    ANG: { countryCode: 'cw', name: 'Curaçao' },
    BTC: { countryCode: 'xx', name: 'Bitcoin' }, // no flag
    XOF: { countryCode: 'sn', name: 'West African CFA' },
    XAF: { countryCode: 'cm', name: 'Central African CFA' },
    XPF: { countryCode: 'pf', name: 'CFP Franc' },
    XCD: { countryCode: 'ag', name: 'East Caribbean' },
  };

  if (exceptions[currencyCode]) return exceptions[currencyCode];

  const countryCode = String(currencyCode || '').substring(0, 2).toLowerCase();
  let name = currencyCode.toUpperCase();
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const regionName = displayNames.of(countryCode.toUpperCase());
    if (regionName) {
      name = regionName;
    }
  } catch (e) {
    // ignore
  }

  return { countryCode, name };
}
