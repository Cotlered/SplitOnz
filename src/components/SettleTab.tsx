import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Share2, Image as ImageIcon, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Group } from '../utils/storage';
import { playSound } from '../utils/sounds';
import { getGroups, saveGroups, getReceipts, saveReceipts, getCachedRates, getSettlements, saveSettlements, getSettings } from '../utils/storage';
import { calculateBalances, runOnzAlgorithm } from '../utils/onzAlgorithm';
import type { MemberBalance, Transaction } from '../utils/onzAlgorithm';

interface SettleTabProps {
  selectedGroupId: string | null;
  setSelectedGroupId: (groupId: string | null) => void;
  onNavigate?: (tab: 'groups' | 'split' | 'settle' | 'currency') => void;
  onShowShare?: (data: any) => void;
  onShowVault?: (group: Group) => void;
}

export const SettleTab: React.FC<SettleTabProps> = ({
  selectedGroupId,
  setSelectedGroupId,
  onNavigate,
  onShowShare,
  onShowVault,
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settledTransactions, setSettledTransactions] = useState<string[]>([]);
  const [viewCurrency, setViewCurrency] = useState<string>('MYR');
  const [celebrateGroupId, setCelebrateGroupId] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({ MYR: 1.0 });
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadedGroups = getGroups();
    setGroups(loadedGroups);
    if (selectedGroupId) {
      const found = loadedGroups.find(g => g.id === selectedGroupId);
      if (found) setSelectedGroup(found);
    }

    // Load rates for conversion
    const cached = getCachedRates();
    if (cached) setRates(cached.rates);
  }, [selectedGroupId]);

  // 1. Auto-detect view currency once when group changes
  useEffect(() => {
    if (selectedGroup) {
      const allReceipts = getReceipts();
      const activeReceipts = allReceipts.filter(r => r.groupId === selectedGroup.id && !r.settledId);
      if (activeReceipts.length > 0) {
        const primaryCurrency = activeReceipts[0].currency;
        if (primaryCurrency) {
          setViewCurrency(primaryCurrency);
        }
      } else {
        setViewCurrency('MYR');
      }
      setSettledTransactions([]);
    }
  }, [selectedGroup]);

  // 2. Recalculate balances and transactions in the active viewCurrency
  useEffect(() => {
    if (selectedGroup) {
      const allReceipts = getReceipts();
      const groupBalances = calculateBalances(selectedGroup, allReceipts, rates, viewCurrency);
      setBalances(groupBalances);

      const settings = getSettings();
      const optimizedTrans = runOnzAlgorithm(groupBalances, settings.roundingMode);
      setTransactions(optimizedTrans);
    }
  }, [selectedGroup, viewCurrency, rates]);



  const handleSettleTransaction = (txIdx: number, tx: Transaction) => {
    const txId = `${tx.fromId}-${tx.toId}-${tx.amount}-${txIdx}`;
    const nextSettled = [...settledTransactions, txId];
    setSettledTransactions(nextSettled);

    // If all transactions are settled, transition group status to "Onz!"
    if (nextSettled.length === transactions.length) {
      handleFullGroupSettle();
    }
  };

  const handleFullGroupSettle = () => {
    if (!selectedGroup) return;
    // Update group status in localStorage
    const allGroups = getGroups();
    const updated = allGroups.map(g => {
      if (g.id === selectedGroup.id) {
        return { ...g, status: 'Onz!' as const };
      }
      return g;
    });
    saveGroups(updated);
    setGroups(updated);

    // Create a Settlement Record
    const allReceipts = getReceipts();
    const groupReceipts = allReceipts.filter(r => r.groupId === selectedGroup.id && !r.settledId);
    
    if (groupReceipts.length > 0) {
      const settlementId = `s-${Date.now()}`;
      let totalMYR = 0;
      
      const updatedReceipts = allReceipts.map(r => {
        if (r.groupId === selectedGroup.id && !r.settledId) {
          const rate = (r.currency === 'MYR' || !rates) ? 1 : (rates[r.currency] || 1);
          totalMYR += r.totalEntered / rate;
          return { ...r, settledId: settlementId };
        }
        return r;
      });
      
      saveReceipts(updatedReceipts);
      
      const newSettlement = {
        id: settlementId,
        groupId: selectedGroup.id,
        date: new Date().toISOString(),
        totalMYR,
        currency: viewCurrency,
        receiptIds: groupReceipts.map(r => r.id),
        transactions: transactions // This is the state variable containing the optimized transfers
      };
      
      const allSettlements = getSettlements();
      saveSettlements([newSettlement, ...allSettlements]);
    }

    // Trigger local celebration
    setCelebrateGroupId(selectedGroup.id);
    playSound('settle');
    
    // Confetti Burst!
    if (canvasRef.current) {
      const myConfetti = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true
      });
      myConfetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FF99', '#00F0FF', '#FF007F']
      });
    }

    setTimeout(() => {
      setCelebrateGroupId(null);
      // Refresh current group state
      const refreshed = updated.find(g => g.id === selectedGroup.id);
      if (refreshed) setSelectedGroup(refreshed);
    }, 1500);
  };

  return (
    <div className="tab-scroll-container" style={{ position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          zIndex: 50
        }} 
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="title-large" style={{ fontSize: '26px', lineHeight: '1.1' }}>
              {getSettings().languageTone === 'geng' ? 'Onz! Settlements' : 'Final Settlements'}
            </h2>
            <span className="title-small" style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              {getSettings().languageTone === 'geng' ? 'GREEDY DEBT MINIMIZER' : 'OPTIMIZED DEBT REDUCTION'}
            </span>
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '12px', flexShrink: 0 }} 
            onClick={() => { if (onNavigate) onNavigate('groups'); }}
          >
            <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Dashboard
          </button>
        </div>

        {selectedGroup && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ flex: 1, height: '44px', fontSize: '13px', borderRadius: '14px', background: 'var(--charcoal-deep)', border: '1px solid var(--charcoal-border)' }} 
              onClick={() => { if (onShowVault && selectedGroup) onShowVault(selectedGroup); }}
            >
              <ImageIcon size={16} style={{ marginRight: '8px' }} /> View Proofs
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              style={{ flex: 1, height: '44px', fontSize: '13px', borderRadius: '14px' }} 
              onClick={() => { if (onShowShare && selectedGroup) onShowShare({ group: selectedGroup, transactions, viewCurrency, rates }); }}
            >
              <Share2 size={16} style={{ marginRight: '8px' }} /> Share Summary
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--charcoal-deep)', borderRadius: '24px', border: '1.5px dashed var(--charcoal-border)', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '48px' }}>☕</div>
          <h3 style={{ fontWeight: '800', fontSize: '18px', color: 'var(--text-primary)' }}>No active groups found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '260px' }}>Create a new group and add receipts first to start settling bills!</p>
          <button className="btn-primary" onClick={() => { if (onNavigate) onNavigate('groups'); }} style={{ marginTop: '8px', padding: '10px 20px', borderRadius: '12px', width: 'auto' }}>Go to Groups</button>
        </div>
      ) : (
        <>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SELECT GENG</label>
            <select
              className="input-field"
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              style={{ padding: '8px 12px' }}
            >
              <option value="" disabled>-- Select a Geng --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {celebrateGroupId && (
            <div style={{ padding: '24px', borderRadius: '24px', background: 'var(--electric-mint-dim)', border: '2px solid var(--electric-mint)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '48px' }}>🎉</div>
              <h3 style={{ fontWeight: '800', fontSize: '20px', color: 'var(--electric-mint)' }}>All settled "Onz!"</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', maxWidth: '240px' }}>No more debts! Go get another teh tarik! ☕</p>
            </div>
          )}

          {!celebrateGroupId && selectedGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          
          {/* CURRENCY TOGGLE */}
          {(() => {
            const allReceipts = getReceipts().filter(r => r.groupId === selectedGroup.id);
            const usedCurrencies = Array.from(new Set(['MYR', ...allReceipts.map(r => r.currency)]));
            if (usedCurrencies.length <= 1) return null;

            return (
              <div style={{ display: 'flex', gap: '8px', padding: '4px', background: 'var(--charcoal-deep)', borderRadius: '14px', border: '1px solid var(--charcoal-border)' }}>
                {usedCurrencies.map(curr => (
                  <button
                    key={curr}
                    onClick={() => setViewCurrency(curr)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: 'none',
                      background: viewCurrency === curr ? 'var(--charcoal-light)' : 'transparent',
                      color: viewCurrency === curr ? 'var(--electric-mint)' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    SHOW IN {curr}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="bento-card bento-card-full" style={{ gap: '12px' }}>
            <span className="title-small" style={{ color: 'var(--electric-mint)', fontSize: '11px' }}>Net Ledger Balances</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {balances.map(b => {
                const activeUser = getSettings().userName || '';
                const isMe = activeUser.toLowerCase() === b.name.toLowerCase();
                return (
                  <div key={b.memberId} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px', 
                    borderRadius: '10px', 
                    background: isMe ? 'var(--electric-mint-dim)' : 'var(--charcoal-deep)', 
                    border: isMe ? '1px solid var(--electric-mint)' : '1px solid var(--charcoal-border)' 
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{b.name}</span>
                        {isMe && <span style={{ fontSize: '10px', backgroundColor: 'var(--electric-mint)', color: 'var(--charcoal-black)', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>YOU</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Spent: {viewCurrency === 'MYR' ? 'RM ' : ''}{b.paid.toFixed(2)}{viewCurrency !== 'MYR' ? ` ${viewCurrency}` : ''} | 
                        Share: {viewCurrency === 'MYR' ? 'RM ' : ''}{b.owed.toFixed(2)}{viewCurrency !== 'MYR' ? ` ${viewCurrency}` : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: b.net > 0.01 ? 'var(--electric-mint)' : b.net < -0.01 ? 'var(--accent-pink)' : 'var(--text-secondary)' }}>
                      {viewCurrency === 'MYR' ? 'RM ' : ''}
                      {b.net > 0.01 ? `+${b.net.toFixed(2)}` : b.net.toFixed(2)}
                      {viewCurrency !== 'MYR' ? ` ${viewCurrency}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bento-card bento-card-full" style={{ gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="title-small" style={{ color: 'var(--accent-blue)', fontSize: '11px' }}>Optimized Transfers</span>
            </div>

            {transactions.length === 0 || selectedGroup.status === 'Onz!' ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '32px' }}>💚</div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>
                  {getSettings().languageTone === 'geng' ? 'Semua Settle!' : 'Fully Settled'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transactions.map((tx, idx) => {
                  const txId = `${tx.fromId}-${tx.toId}-${tx.amount}-${idx}`;
                  const isSettled = settledTransactions.includes(txId);
                  return (
                    <div key={txId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', background: 'var(--charcoal-deep)', border: '1px solid var(--charcoal-border)', opacity: isSettled ? 0.4 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--accent-pink)' }}>{tx.fromName}</span>
                        <ArrowRight size={12} color="var(--text-secondary)" />
                        <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--electric-mint)' }}>{tx.toName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontWeight: '800', fontSize: '14px' }}>
                          {viewCurrency === 'MYR' ? 'RM ' : ''}
                          {tx.amount.toFixed(2)}
                          {viewCurrency !== 'MYR' ? ` ${viewCurrency}` : ''}
                        </div>
                        <button className="btn-primary" disabled={isSettled} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px' }} onClick={() => handleSettleTransaction(idx, tx)}>
                          {isSettled ? 'Settled' : 'Settle'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button className="btn-secondary" style={{ width: '100%', marginTop: '6px' }} onClick={() => setShowSettleConfirm(true)}>Settle Entire Geng</button>
              </div>
            )}
            </div>
          </div>
        )}
      </>
    )}

      {/* Settle Entire Geng Confirmation Modal */}
      {showSettleConfirm && selectedGroup && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'rgba(2, 6, 23, 0.85)', 
          backdropFilter: 'blur(20px)', 
          zIndex: 5000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '24px' 
        }}>
          <div className="bento-card" style={{ 
            background: 'var(--charcoal-deep)', 
            border: '2px solid var(--electric-mint)',
            borderRadius: '28px',
            padding: '28px 24px', 
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px var(--electric-mint-glow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              background: 'var(--electric-mint-dim)', 
              border: '1px solid var(--electric-mint)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto',
              color: 'var(--electric-mint)',
              boxShadow: '0 0 15px var(--electric-mint-glow)'
            }}>
              <CheckCircle size={32} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {getSettings().languageTone === 'geng' ? 'Confirm Payouts? 🤝' : 'Confirm Settlement? 🤝'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
                This will lock and archive all active receipts for <strong>"{selectedGroup.name}"</strong> and mark the entire group as fully settled.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--electric-mint)', fontWeight: '700', lineHeight: '1.5' }}>
                Please ensure all money transfers are completed before confirming. Jom settle?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowSettleConfirm(false)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', fontWeight: '800' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => {
                  handleFullGroupSettle();
                  setShowSettleConfirm(false);
                }}
                style={{ flex: 1, height: '48px', borderRadius: '14px', fontWeight: '800' }}
              >
                Yes, Settle Up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SettleTab;
