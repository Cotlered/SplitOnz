import React from 'react';
import { ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '../utils/onzAlgorithm';
import type { Group } from '../utils/storage';

interface ShareSheetProps {
  group: Group;
  transactions: Transaction[];
  sheetRef: React.RefObject<HTMLDivElement | null>;
  viewCurrency: string;
  rates: Record<string, number>;
  isLightTheme?: boolean;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({ 
  group, 
  transactions, 
  sheetRef, 
  viewCurrency, 
  rates,
  isLightTheme = false 
}) => {
  const date = new Date().toLocaleDateString('en-MY', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const colors = {
    bg: isLightTheme ? 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)' : 'linear-gradient(180deg, #0F172A 0%, #020617 100%)',
    cardBg: isLightTheme ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.03)',
    cardBorder: isLightTheme ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
    textPrimary: isLightTheme ? '#0F172A' : '#FFFFFF',
    textSecondary: isLightTheme ? '#475569' : '#94A3B8',
    accentMint: isLightTheme ? '#10B981' : '#00FF99',
    accentPink: isLightTheme ? '#BE185D' : '#FF4D94',
    border: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'
  };

  return (
    <div 
      ref={sheetRef}
      style={{
        width: '100%',
        maxWidth: '450px',
        padding: '48px 32px',
        background: colors.bg,
        color: colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        margin: '0 auto',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        boxSizing: 'border-box',
        borderRadius: '0',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`
      }}
    >
      {/* Decorative Elements */}
      <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: colors.accentMint, opacity: 0.05, borderRadius: '50%', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', background: colors.accentPink, opacity: 0.05, borderRadius: '50%', filter: 'blur(40px)' }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '12px' 
        }}>
          <div style={{ position: 'relative' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ 
                width: '60px', // Slightly smaller logo
                height: '60px', 
                objectFit: 'contain',
                filter: isLightTheme ? 'none' : 'drop-shadow(0 0 10px rgba(0, 255, 153, 0.3))'
              }} 
            />
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: colors.accentMint, color: isLightTheme ? 'white' : '#020617', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
              <Zap size={12} fill="currentColor" />
            </div>
          </div>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '2px', color: colors.textPrimary, letterSpacing: '-1px' }}>SplitOnz</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ height: '1px', width: '16px', background: colors.accentMint }} />
          <p style={{ fontSize: '10px', color: colors.accentMint, fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>OFFICIAL AUDIT</p>
          <div style={{ height: '1px', width: '16px', background: colors.accentMint }} />
        </div>
      </div>

      {/* Group Info Card */}
      <div style={{ 
        marginBottom: '20px', 
        background: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '24px',
        padding: '24px 20px', // More compact padding
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '10px', 
          color: colors.textSecondary, 
          fontWeight: '800', 
          marginBottom: '4px', 
          textTransform: 'uppercase', 
          letterSpacing: '1.5px',
          opacity: 0.8
        }}>
          PROJECT / GENG
        </div>
        <h2 style={{ 
          fontSize: '26px', 
          fontWeight: '900', 
          color: colors.textPrimary, 
          lineHeight: '1.1', 
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>
          {group.name}
        </h2>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px', 
          flexWrap: 'nowrap',
          marginTop: '4px'
        }}>
          <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '600', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{date}</span>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.accentMint, opacity: 0.6, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: colors.accentMint, fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{transactions.length} Settlements</span>
        </div>
      </div>

      {/* Status Badge */}
      <div style={{ 
        alignSelf: 'center',
        padding: '8px 20px',
        background: isLightTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 255, 153, 0.1)',
        border: `1px solid ${colors.accentMint}`,
        borderRadius: '100px',
        marginBottom: '24px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: `0 8px 16px ${isLightTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 255, 153, 0.1)'}`,
        whiteSpace: 'nowrap'
      }}>
        <CheckCircle2 size={14} color={colors.accentMint} />
        <span style={{ fontSize: '12px', fontWeight: '900', color: colors.accentMint, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>STATUS: ONZ!</span>
      </div>

      {/* Transactions */}
      <div>
        <div style={{ 
          fontSize: '10px', 
          color: colors.textSecondary, 
          fontWeight: '800', 
          marginBottom: '16px', 
          textAlign: 'center', 
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          opacity: 0.8
        }}>
          SETTLEMENT PROTOCOL
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {transactions.map((tx, idx) => (
            <div key={idx} style={{ 
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              padding: '16px 12px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              backdropFilter: 'blur(5px)'
            }}>
              {/* CONTENT WRAPPER - MATHEMATICAL CENTERING */}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {/* FROM NAME - 45% */}
                <div style={{ 
                  width: '45%', 
                  textAlign: 'right', 
                  fontWeight: '700', 
                  color: colors.accentPink, 
                  fontSize: '12.5px',
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  paddingRight: '4px'
                }}>
                  {tx.fromName}
                </div>
                
                {/* ARROW - 10% */}
                <div style={{ width: '10%', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.4, flexShrink: 0 }}>
                  <ArrowRight size={12} color={colors.textSecondary} />
                </div>
                
                {/* TO NAME - 45% */}
                <div style={{ 
                  width: '45%', 
                  textAlign: 'left', 
                  fontWeight: '700', 
                  color: colors.accentMint, 
                  fontSize: '12.5px',
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  paddingLeft: '4px'
                }}>
                  {tx.toName}
                </div>
              </div>
              
              {/* AMOUNT - ANCHORED RIGHT */}
              <div style={{ 
                width: '70px',
                fontSize: '18px', 
                fontWeight: '900', 
                color: colors.textPrimary, 
                whiteSpace: 'nowrap', 
                letterSpacing: '-0.5px',
                textAlign: 'right',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginLeft: '12px'
              }}>
                <span style={{ fontSize: '11px', opacity: 0.7, marginRight: '2px', fontWeight: '700' }}>
                  {viewCurrency === 'MYR' ? 'RM' : ''}
                </span>
                {(tx.amount * (viewCurrency === 'MYR' ? 1 : (rates[viewCurrency] || 1))).toFixed(2)}
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textSecondary, background: colors.cardBg, borderRadius: '24px', border: `1px dashed ${colors.cardBorder}` }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>☕</div>
              <p style={{ fontWeight: '700' }}>No outstanding transactions.</p>
              <p style={{ fontSize: '12px', opacity: 0.8 }}>All debts have been cleared!</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '48px', 
        paddingTop: '32px', 
        borderTop: `1px solid ${colors.border}`, 
        textAlign: 'center' 
      }}>
        <p style={{ fontSize: '14px', fontWeight: '800', color: colors.textPrimary, marginBottom: '4px' }}>Bagi Settle, Hati Onz! ☕</p>
        <p style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
          Certified via SplitOnz Ledger • {new Date().getFullYear()}
        </p>
        <div style={{ marginTop: '16px', fontSize: '9px', color: colors.textSecondary, opacity: 0.4, letterSpacing: '1px' }}>
          {new Date().toISOString()} • SECURE AUDIT TOKEN: {Math.random().toString(36).substring(2, 10).toUpperCase()}
        </div>
      </div>
    </div>
  );
};
