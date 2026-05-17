import React, { useState, useRef, useEffect } from 'react';
import { getCurrencyInfo } from '../utils/currency';
import { ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  options: string[];
}

export const CurrencySelect: React.FC<Props> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedInfo = getCurrencyInfo(value);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--charcoal-deep)', border: '1px solid var(--electric-mint)', borderRadius: '12px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span className={`fi fi-${selectedInfo.countryCode} fis`} style={{ borderRadius: '50%', width: '18px', height: '18px', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }}></span>
          <span style={{ fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: 'var(--text-primary)' }}>
            {value} - {selectedInfo.name}
          </span>
        </div>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
      </div>

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--charcoal-deep)', backdropFilter: 'blur(24px)', border: '1px solid var(--charcoal-border)', borderRadius: '12px', zIndex: 1000, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          {options.map(c => {
            const info = getCurrencyInfo(c);
            return (
              <div 
                key={c}
                onClick={() => { onChange(c); setIsOpen(false); }}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid var(--charcoal-border)', background: c === value ? 'var(--electric-mint-dim)' : 'transparent' }}
              >
                <span className={`fi fi-${info.countryCode} fis`} style={{ borderRadius: '50%', width: '20px', height: '20px', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }}></span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: c === value ? 'var(--electric-mint)' : 'var(--text-primary)' }}>{c}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
