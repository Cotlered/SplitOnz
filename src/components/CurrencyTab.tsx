import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Search, X, ArrowRightLeft, Globe, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { getCachedRates, saveCachedRates, getSettings, saveSettings } from '../utils/storage';
import { getCurrencyInfo } from '../utils/currency';
import { CurrencySelect } from './CurrencySelect';
import { toast } from '../utils/toast';

export const CurrencyTab: React.FC = () => {
  const [rates, setRates] = useState<Record<string, number>>({ MYR: 1.0, SGD: 0.32, THB: 8.23 });
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Quick Converter State
  const [converterAmount, setConverterAmount] = useState<string>('100');
  const [converterSource, setConverterSource] = useState<string>('THB');
  const [baseCurrency, setBaseCurrency] = useState<string>('MYR');

  // Pinned Currencies
  const [pinnedCurrencies, setPinnedCurrencies] = useState<string[]>(['SGD', 'THB']);

  // Modals & Search
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [showStreetRateConfirm, setShowStreetRateConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Street Rate Toggle
  const [useStreetRates, setUseStreetRates] = useState(false);
  const [customRatesInput, setCustomRatesInput] = useState<Record<string, string>>({});

  const fetchRates = async (force = false) => {
    setIsLoading(true);
    
    if (!force) {
      const cached = getCachedRates();
      const isCacheValid = cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000);

      if (isCacheValid) {
        setRates(cached.rates);
        setLastUpdated(new Date(cached.timestamp).toLocaleString());
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('https://v6.exchangerate-api.com/v6/4e7dcbe37cbd9ac5981bd7cf/latest/MYR');
      if (!response.ok) throw new Error('Failed to fetch conversion rates');
      const data = await response.json();
      
      const newRates = data.conversion_rates || { MYR: 1.0, SGD: 0.32, THB: 8.23 };
      setRates(newRates);
      saveCachedRates(newRates);
      setLastUpdated(new Date().toLocaleTimeString());
      if (force) toast('Exchange rates synced from global markets!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to fetch latest rates. Using offline cache.', 'error');
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  useEffect(() => {
    fetchRates();
    const settings = getSettings();
    setUseStreetRates(!!settings.useStreetRates);
    setCustomRatesInput(settings.customRatesInput || {});
  }, []);



  // Derive active rates (merge API rates with street overrides if active)
  const activeRates = useMemo(() => {
    if (!useStreetRates) return rates;
    const merged = { ...rates };
    Object.keys(customRatesInput).forEach(curr => {
      const val = parseFloat(customRatesInput[curr]);
      if (!isNaN(val) && val > 0) merged[curr] = val;
    });
    return merged;
  }, [rates, useStreetRates, customRatesInput]);

  // Check if manually entered custom rates deviate > 30% from the live market rates
  const hasSignificantDeviation = useMemo(() => {
    let deviant = false;
    let deviantCurrency = '';
    let enteredVal = 0;
    let marketVal = 0;

    pinnedCurrencies.forEach(curr => {
      const customVal = parseFloat(customRatesInput[curr]);
      const marketRate = rates[curr];
      if (!isNaN(customVal) && customVal > 0 && marketRate > 0) {
        const pctDiff = Math.abs(customVal - marketRate) / marketRate;
        if (pctDiff > 0.3) {
          deviant = true;
          deviantCurrency = curr;
          enteredVal = customVal;
          marketVal = marketRate;
        }
      }
    });

    return { deviant, deviantCurrency, enteredVal, marketVal };
  }, [customRatesInput, rates, pinnedCurrencies]);

  // Converter Math
  const calculateConversion = () => {
    const amt = parseFloat(converterAmount);
    if (isNaN(amt)) return '0.00';
    const sourceRate = activeRates[converterSource] || 1;
    const baseRate = activeRates[baseCurrency] || 1;
    // Formula: (Amount / Source Rate) * Base Rate
    return ((amt / sourceRate) * baseRate).toFixed(2);
  };

  const handleStreetRateToggle = (enabled: boolean) => {
    setUseStreetRates(enabled);
    const settings = getSettings();
    saveSettings({
      ...settings,
      useStreetRates: enabled
    });
  };

  const handleCustomRateChange = (currency: string, value: string) => {
    setCustomRatesInput(prev => {
      const updated = { ...prev, [currency]: value };
      const settings = getSettings();
      saveSettings({
        ...settings,
        customRatesInput: updated
      });
      return updated;
    });
  };

  // Filter global rates for modal
  const allCurrencies = Object.keys(rates).sort();
  const filteredCurrencies = allCurrencies.filter(c => {
    const info = getCurrencyInfo(c);
    const search = searchQuery.toLowerCase();
    return c.toLowerCase().includes(search) || info.name.toLowerCase().includes(search);
  });

  return (
    <div className="tab-scroll-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="title-large" style={{ fontSize: '28px' }}>Trip Wallet</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="title-small" style={{ fontSize: '11px' }}>Quick-Mafs Converter</span>
            {lastUpdated && (
              <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: '600' }}>
                • Updated {lastUpdated}
              </span>
            )}
          </div>
        </div>
        <button 
          className="btn-icon" 
          onClick={() => fetchRates(true)} 
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.5 : 1, transition: 'all 0.3s ease' }}
        >
          <RefreshCw 
            size={18} 
            style={{ 
              animation: isLoading ? 'spin 1s linear infinite' : 'none',
              color: 'var(--text-secondary)'
            }} 
          />
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .currency-select {
          appearance: none;
          background: var(--charcoal-light);
          border: 1px solid var(--charcoal-border);
          color: var(--text-primary);
          padding: 8px 14px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 14px;
          outline: none;
          cursor: pointer;
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;
        }
      `}</style>

      {/* THE QUICK CONVERTER */}
      <div className="bento-card bento-card-full" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--electric-mint-dim) 0%, var(--charcoal-deep) 100%)', borderColor: 'var(--electric-mint)', flexShrink: 0, overflow: 'visible', position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Calculator size={16} style={{ color: 'var(--electric-mint)' }} />
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--electric-mint)', letterSpacing: '1px' }}>QUICK CONVERT</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <CurrencySelect 
              value={converterSource} 
              onChange={(val) => { setConverterSource(val); }} 
              options={allCurrencies} 
            />
            <input 
              type="number" 
              value={converterAmount} 
              onChange={(e) => setConverterAmount(e.target.value)}
              className="input-field"
              style={{ fontSize: '24px', fontWeight: '800', padding: '12px', textAlign: 'center', height: 'auto', background: 'var(--electric-mint-dim)', border: '1px solid var(--electric-mint)', color: 'var(--text-primary)' }}
            />
          </div>

          <ArrowRightLeft size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <CurrencySelect 
              value={baseCurrency} 
              onChange={(val) => { setBaseCurrency(val); }} 
              options={allCurrencies} 
            />
            <div className="input-field" style={{ fontSize: '24px', fontWeight: '800', padding: '12px', textAlign: 'center', height: 'auto', background: 'var(--electric-mint-dim)', color: 'var(--electric-mint)', border: '1px solid var(--electric-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {calculateConversion()}
            </div>
          </div>
        </div>
      </div>

      {/* PINNED CURRENCIES */}
      <div>
        <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '10px', marginTop: '4px', letterSpacing: '0.5px' }}>PINNED DESTINATIONS</h3>
        <div className="bento-grid">
          {pinnedCurrencies.map((currency, idx) => {
            const rate = activeRates[currency] || 1;
            const baseToCurr = rate.toFixed(4);
            // Cycle colors
            const colors = ['var(--accent-blue)', 'var(--accent-pink)', 'var(--accent-gold)'];
            const color = colors[idx % colors.length];

            return (
              <div key={currency} className="bento-card" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: color, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`fi fi-${getCurrencyInfo(currency).countryCode} fis`} style={{ borderRadius: '50%', width: '14px', height: '14px', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }}></span>
                    {getCurrencyInfo(currency).name.toUpperCase()}
                  </span>
                  <MapPin size={16} style={{ color: color }} />
                </div>
                <span style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', display: 'block', margin: '4px 0' }}>{baseToCurr}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600', opacity: 0.9, marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                  1 {baseCurrency} = {baseToCurr} {currency} <br />
                  100 {currency} = {(100 / rate).toFixed(2)} {baseCurrency}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEARCH GLOBAL RATES & STREET RATES */}
      <div className="bento-card bento-card-full" style={{ gap: '14px', flexShrink: 0 }}>
        <button 
          className="btn-secondary" 
          style={{ width: '100%', height: '44px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}
          onClick={() => { setShowGlobalModal(true); }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Globe size={16} style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '700' }}>Browse 160+ Currencies</span>
          </div>
          <Search size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>

        <div style={{ borderTop: '1px solid var(--charcoal-border)', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-gold)' }}>Street Rate Override</h4>
            <p style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '2px', opacity: 0.9 }}>Use exact money changer rates</p>
          </div>
          <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              className="sr-only" 
              style={{ display: 'none' }} 
              checked={useStreetRates} 
              onChange={() => {
                if (!useStreetRates) {
                  setShowStreetRateConfirm(true);
                } else {
                  handleStreetRateToggle(false);
                }
              }} 
            />
            <div style={{ width: '44px', height: '24px', background: useStreetRates ? 'var(--accent-gold)' : 'var(--charcoal-border)', borderRadius: '100px', transition: 'all 0.3s', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '2px', left: useStreetRates ? '22px' : '2px', width: '20px', height: '20px', background: 'var(--charcoal-deep)', borderRadius: '50%', transition: 'all 0.3s' }} />
            </div>
          </label>
        </div>

        {useStreetRates && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', animation: 'slideDownFade 0.3s' }}>
            {pinnedCurrencies.map(currency => (
              <div key={currency} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', width: '80px', color: 'var(--text-secondary)' }}>1 {baseCurrency} in {currency}</span>
                <input
                  type="number"
                  step="0.0001"
                  className="input-field"
                  placeholder={rates[currency]?.toFixed(4)}
                  value={customRatesInput[currency] || ''}
                  onChange={(e) => handleCustomRateChange(currency, e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px', flex: 1 }}
                />
              </div>
            ))}
            {hasSignificantDeviation.deviant && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1.5px solid var(--warning)',
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'slideDownFade 0.3s ease',
                marginTop: '4px'
              }}>
                <div style={{ color: 'var(--warning)', flexShrink: 0 }}>
                  <AlertCircle size={20} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', fontWeight: '500', textAlign: 'left' }}>
                  <strong style={{ color: 'var(--warning)' }}>Rate Deviation Warning! ⚠️</strong><br />
                  Your custom rate for <strong>{hasSignificantDeviation.deviantCurrency}</strong> ({hasSignificantDeviation.enteredVal}) differs by more than 30% from the live market average ({hasSignificantDeviation.marketVal.toFixed(4)}). Please check for typos to prevent major audit mistakes!
                </div>
              </div>
            )}
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic', opacity: 0.8 }}>
              * When active, these street rates will be used for all conversions on this page.
            </p>
          </div>
        )}
      </div>



      {/* GLOBAL RATES MODAL */}
      {showGlobalModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--charcoal-black)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginTop: '30px' }}>
            <h2 className="title-large" style={{ fontSize: '20px' }}>Global Rates</h2>
            <button className="btn-icon" onClick={() => { setShowGlobalModal(false); }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search currency (e.g. USD, JPY)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px', height: '40px' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '40px' }}>
            {filteredCurrencies.map(currency => {
              const isPinned = pinnedCurrencies.includes(currency);
              return (
                <div key={currency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--charcoal-light)', borderRadius: '12px', border: '1px solid var(--charcoal-border)' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className={`fi fi-${getCurrencyInfo(currency).countryCode} fis`} style={{ borderRadius: '50%', width: '24px', height: '24px', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }}></span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>{currency}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{getCurrencyInfo(currency).name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'monospace' }}>{(rates[currency] || 0).toFixed(4)}</span>
                  <button 
                    className={isPinned ? "btn-secondary" : "btn-icon"}
                    style={{ padding: '6px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: '700', border: isPinned ? '1px solid var(--electric-mint)' : '1px solid var(--charcoal-border)' }}
                    onClick={() => {
                      if (isPinned) {
                        setPinnedCurrencies(prev => prev.filter(c => c !== currency));
                      } else {
                        setPinnedCurrencies(prev => [...prev, currency]);
                      }
                    }}
                  >
                    {isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Street Rate Override Confirmation Modal */}
      {showStreetRateConfirm && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(2, 6, 23, 0.85)', 
          backdropFilter: 'blur(20px)', 
          zIndex: 6000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '24px' 
        }}>
          <div className="bento-card" style={{ 
            background: 'var(--charcoal-deep)', 
            border: '2px solid var(--accent-gold)',
            borderRadius: '28px',
            padding: '28px 24px', 
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(245, 158, 11, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              background: 'rgba(245, 158, 11, 0.1)', 
              border: '1px solid var(--accent-gold)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto',
              color: 'var(--accent-gold)',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
            }}>
              <Globe size={32} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Use Street Rates? 🪙
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
                Street rates override the standard live bank exchange rates. Once active, all trip dashboard analytics, budget progress, and individual receipt calculations will use your custom rates.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--accent-gold)', fontWeight: '700', lineHeight: '1.5' }}>
                Ensure your rates match exactly what your cash money changer gave you!
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowStreetRateConfirm(false)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', fontWeight: '800' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => {
                  handleStreetRateToggle(true);
                  setShowStreetRateConfirm(false);
                }}
                style={{ flex: 1, height: '48px', borderRadius: '14px', background: 'var(--accent-gold)', border: 'none', color: 'var(--charcoal-black)', fontWeight: '800', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.2)' }}
              >
                Yes, Enable
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CurrencyTab;
