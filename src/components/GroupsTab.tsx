import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, ArrowLeft, UserPlus, Sparkles, Image as ImageIcon, CheckCircle, X, ArrowRight, BarChart3, Target, TrendingUp, Coins, Share2 } from 'lucide-react';
import type { Group, Member, Receipt, Settlement } from '../utils/storage';
import { getGroups, saveGroups, getRecentMembers, getReceipts, getSettlements, getCachedRates, getSettings } from '../utils/storage';
import { calculateBalances } from '../utils/onzAlgorithm';
import { playSound } from '../utils/sounds';
import { getRandomQuote } from '../utils/quotes';

interface GroupsTabProps {
  onSelectGroup?: (groupId: string) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (groupId: string | null) => void;
  onNavigate?: (tab: 'groups' | 'split' | 'settle' | 'currency') => void;
  onGroupsChange?: () => void;
}

export const GroupsTab: React.FC<GroupsTabProps> = ({
  selectedGroupId,
  setSelectedGroupId,
  onNavigate,
  onGroupsChange,
}) => {
  const [randomQuote, setRandomQuote] = useState('');
  
  useEffect(() => {
    setRandomQuote(getRandomQuote());
  }, []);

  const handleCycleQuote = () => {
    playSound('tick');
    setRandomQuote(getRandomQuote());
  };
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [tempMembers, setTempMembers] = useState<string[]>([]);
  const [recentMembers, setRecentMembers] = useState<string[]>([]);
  const [isAddingToExisting, setIsAddingToExisting] = useState(false);
  const [editingMemberName, setEditingMemberName] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [viewingSettlement, setViewingSettlement] = useState<Settlement | null>(null);
  const [isViewingDashboard, setIsViewingDashboard] = useState(false);
  const [dashboardGroup, setDashboardGroup] = useState<Group | null>(null);
  const [dailyBudgetInput, setDailyBudgetInput] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);


  // Load groups and recent members
  useEffect(() => {
    let loadedGroups = getGroups();
    const settings = getSettings();
    
    if (settings.hideSettledGroups) {
      loadedGroups = loadedGroups.filter(g => g.status !== 'Onz!');
    }
    
    setGroups(loadedGroups);
    setRecentMembers(getRecentMembers());
  }, [isCreating, selectedGroupId]);

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroupMembers: Member[] = [
      ...tempMembers.map((name, idx) => ({ id: `m-${Date.now()}-${idx}`, name: name.trim() }))
    ];

    if (newGroupMembers.length === 0) {
      newGroupMembers.push({ id: `m-${Date.now()}-owner`, name: 'Me' });
    }

    const newGroup: Group = {
      id: `g-${Date.now()}`,
      name: newGroupName.trim(),
      members: newGroupMembers,
      status: 'Pending...',
      createdAt: new Date().toISOString(),
    };

    const updatedGroups = [newGroup, ...getGroups()];
    saveGroups(updatedGroups);
    setGroups(updatedGroups);

    // Reset Form
    setNewGroupName('');
    setTempMembers([]);
    setIsCreating(false);
    if (onGroupsChange) onGroupsChange();
  };

  const handleAddTempMember = () => {
    if (newMemberName.trim() && !tempMembers.includes(newMemberName.trim())) {
      setTempMembers([...tempMembers, newMemberName.trim()]);
      setNewMemberName('');
    }
  };

  const handleToggleRecentMember = (name: string) => {
    if (tempMembers.includes(name)) {
      setTempMembers(tempMembers.filter(m => m !== name));
    } else {
      setTempMembers([...tempMembers, name]);
    }
  };

  const handleAddMemberToExisting = () => {
    if (!selectedGroupId || !editingMemberName.trim()) {
      setIsAddingToExisting(false);
      return;
    }
    const currentGroups = getGroups();
    const updated = currentGroups.map(g => {
      if (g.id === selectedGroupId) {
        const newMember = { id: `m-${Date.now()}`, name: editingMemberName.trim() };
        return { ...g, members: [...g.members, newMember] };
      }
      return g;
    });
    saveGroups(updated);
    setGroups(updated);
    setEditingMemberName('');
    setIsAddingToExisting(false);
    if (onGroupsChange) onGroupsChange();
  };

  const handleDeleteGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGroupToDelete(id);
  };

  const confirmDeleteGroup = (id: string) => {
    const updated = getGroups().filter(g => g.id !== id);
    saveGroups(updated);
    setGroups(updated);
    if (selectedGroupId === id) {
      setSelectedGroupId(null);
    }
    setGroupToDelete(null);
    if (onGroupsChange) onGroupsChange();
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const receipts = getReceipts().filter(r => r.groupId === selectedGroupId);

  return (
    <div className="tab-scroll-container" style={{ position: 'relative' }}>
      
      {/* --- DRILL-DOWN GROUP DETAILS --- */}
      {selectedGroupId && selectedGroup ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn-icon" onClick={() => { setSelectedGroupId(null); }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="title-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedGroup.name}
              </h2>
              <span className="title-small" style={{ fontSize: '11px' }}>
                {getSettings().languageTone === 'geng' ? 'Group Breakdown' : 'Group Details'}
              </span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span className={`status-sticker ${selectedGroup.status === 'Onz!' ? 'status-sticker-onz' : 'status-sticker-pending'}`}>
                {selectedGroup.status === 'Onz!' ? 'Onz!' : 'Pending'}
              </span>
            </div>
          </div>

          <div className="bento-card bento-card-full">
            <h3 className="title-small" style={{ color: 'var(--electric-mint)', marginBottom: '8px' }}>
              {getSettings().languageTone === 'geng' ? 'Geng Members' : 'Group Members'}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedGroup.members.map(m => (
                <div key={m.id} style={{
                  background: 'var(--charcoal-deep)',
                  border: '1px solid var(--charcoal-border)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--electric-mint)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                </div>
              ))}
              
              {isAddingToExisting ? (
                <div style={{ display: 'flex', gap: '4px', width: '100%', marginTop: '4px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ height: '36px', fontSize: '13px', padding: '0 12px' }}
                    placeholder="Friend's name"
                    value={editingMemberName}
                    onChange={(e) => setEditingMemberName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMemberToExisting(); if (e.key === 'Escape') setIsAddingToExisting(false); }}
                    autoFocus
                  />
                  <button className="btn-primary" style={{ height: '36px', padding: '0 12px', fontSize: '11px' }} onClick={handleAddMemberToExisting}>Add</button>
                  <button className="btn-secondary" style={{ height: '36px', padding: '0 12px', fontSize: '11px' }} onClick={() => setIsAddingToExisting(false)}>Cancel</button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAddingToExisting(true)}
                  style={{
                    background: 'rgba(0, 255, 153, 0.05)',
                    border: '1px dashed rgba(0, 255, 153, 0.3)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'var(--electric-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Add Member
                </button>
              )}
            </div>
          </div>

          <div className="bento-card bento-card-full">
            <h3 className="title-small" style={{ marginBottom: '12px' }}>Group History</h3>
            {(() => {
              const settlements = getSettlements().filter(s => s.groupId === selectedGroupId);
              const timeline: (Receipt | Settlement)[] = [
                ...receipts,
                ...settlements
              ].sort((a, b) => {
                const dateA = 'createdAt' in a ? a.createdAt : a.date;
                const dateB = 'createdAt' in b ? b.createdAt : b.date;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
              });

              if (timeline.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--charcoal-light)', borderRadius: '16px', border: '1px dashed var(--charcoal-border)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                      No activity yet. Go to Split tab to add a bill!
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {timeline.map(item => {
                    const isSettlement = 'totalMYR' in item;
                    
                    if (isSettlement) {
                      const s = item as Settlement;
                      return (
                        <div 
                          key={s.id} 
                          onClick={() => setViewingSettlement(s)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '12px',
                            borderRadius: '16px',
                            background: 'var(--electric-mint-dim)',
                            border: '1.5px solid var(--electric-mint)',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--charcoal-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--electric-mint)' }}>
                            <CheckCircle size={24} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>Geng Settled! ✅</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Total RM {s.totalMYR.toFixed(2)} reconciled
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'var(--electric-mint)', fontWeight: 800 }}>
                              {new Date(s.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    }                    const r = item as Receipt;
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => setViewingReceipt(r)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '12px',
                          borderRadius: '16px',
                          background: 'var(--charcoal-deep)',
                          border: '1px solid var(--charcoal-border)',
                          opacity: r.settledId ? 0.6 : 1,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--charcoal-deep)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                          {r.imageUrl ? (
                            <img src={r.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                              <ImageIcon size={18} />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{r.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Paid by <span style={{ color: 'var(--electric-mint)', fontWeight: 700 }}>{selectedGroup.members.find(m => m.id === r.paidBy)?.name || 'Someone'}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '900', color: 'var(--text-primary)', fontSize: '14px' }}>
                            {r.currency} {r.totalEntered.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            {r.settledId ? 'SETTLED' : 'ACTIVE'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Receipt Details Modal */}
          {viewingReceipt && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--charcoal-black)', backdropFilter: 'blur(20px)', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: '20px', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-icon" onClick={() => setViewingReceipt(null)}>
                    <X size={24} />
                  </button>
                  <h2 className="title-medium" style={{ color: 'var(--text-primary)' }}>Bill Details</h2>
                  <div style={{ width: '40px' }} />
               </div>

               <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 40px' }}>
                  {viewingReceipt.imageUrl && (
                    <div style={{ width: '100%', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', border: '1px solid var(--charcoal-border)' }}>
                      <img src={viewingReceipt.imageUrl} style={{ width: '100%', display: 'block' }} alt="Full Receipt" />
                    </div>
                  )}

                  <div className="bento-card bento-card-full" style={{ background: 'var(--charcoal-deep)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{viewingReceipt.title}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(viewingReceipt.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--electric-mint)' }}>{viewingReceipt.currency} {viewingReceipt.totalEntered.toFixed(2)}</div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 800 }}>PAID BY {selectedGroup.members.find(m => m.id === viewingReceipt.paidBy)?.name || 'UNKNOWN'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {viewingReceipt.items.map(it => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--charcoal-border)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              Shared by: {it.assignedTo.map(mid => selectedGroup.members.find(m => m.id === mid)?.name).join(', ')}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{viewingReceipt.currency} {it.price.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid var(--charcoal-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {viewingReceipt.taxServiceCharge && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Service Charge (10%)</span>
                          <span>Included</span>
                        </div>
                      )}
                      {viewingReceipt.taxSst && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>SST (6%)</span>
                          <span>Included</span>
                        </div>
                      )}
                      {(viewingReceipt.flatTax || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Flat Tax / Fees</span>
                          <span>{viewingReceipt.currency} {viewingReceipt.flatTax?.toFixed(2)}</span>
                        </div>
                      )}
                      {viewingReceipt.roundingAdjustment !== 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Rounding</span>
                          <span>{viewingReceipt.currency} {viewingReceipt.roundingAdjustment?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="title-small" style={{ margin: '24px 0 12px', color: 'var(--electric-mint)' }}>Who Pays What</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {calculateBalances(selectedGroup, [viewingReceipt]).map(bal => (
                      <div key={bal.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--charcoal-light)', borderRadius: '16px', border: '1px solid var(--charcoal-border)' }}>
                         <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{bal.name}</div>
                         <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                            {viewingReceipt.currency} {bal.owed.toFixed(2)}
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {/* Settlement Details Modal */}
          {viewingSettlement && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--charcoal-black)', backdropFilter: 'blur(20px)', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: '20px', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-icon" onClick={() => setViewingSettlement(null)}>
                    <X size={24} />
                  </button>
                  <h2 className="title-medium" style={{ color: 'var(--text-primary)' }}>Payout History</h2>
                  <div style={{ width: '40px' }} />
               </div>

               <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 40px' }}>
                  <div className="bento-card bento-card-full" style={{ background: 'var(--charcoal-deep)', textAlign: 'center', padding: '32px 20px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--electric-mint-dim)', color: 'var(--electric-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                       <CheckCircle size={32} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>RM {viewingSettlement.totalMYR.toFixed(2)}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Reconciled on {new Date(viewingSettlement.date).toLocaleDateString()}</p>
                  </div>

                  <h3 className="title-small" style={{ margin: '24px 0 12px', color: 'var(--electric-mint)' }}>Who Paid Whom</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {viewingSettlement.transactions && viewingSettlement.transactions.length > 0 ? (
                      viewingSettlement.transactions.map((tx, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '16px', 
                          borderRadius: '20px', 
                          background: 'var(--charcoal-light)', 
                          border: '1px solid var(--charcoal-border)' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: '800', color: 'var(--accent-pink)' }}>{tx.fromName}</span>
                            <ArrowRight size={14} color="var(--text-secondary)" />
                            <span style={{ fontWeight: '800', color: 'var(--electric-mint)' }}>{tx.toName}</span>
                          </div>
                          <div style={{ fontWeight: '900', color: 'var(--text-primary)' }}>
                            RM {tx.amount.toFixed(2)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No transaction records found for this settlement.</div>
                    )}
                  </div>

                  <h3 className="title-small" style={{ margin: '24px 0 12px', color: 'var(--text-secondary)' }}>Bills Included</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {getReceipts().filter(r => viewingSettlement.receiptIds.includes(r.id)).map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--charcoal-light)', border: '1px solid var(--charcoal-border)', borderRadius: '12px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{r.currency} {r.totalEntered.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', height: '70px', borderRadius: '20px', justifyContent: 'space-between', padding: '0 24px', boxShadow: '0 10px 25px rgba(0, 255, 153, 0.2)' }}
              onClick={() => { if (onNavigate) onNavigate('split'); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '28px' }}>🧾</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>Add New Receipt</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Start Guided OCR Split</div>
                </div>
              </div>
              <ArrowLeft size={20} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={receipts.length === 0}
              style={{ 
                width: '100%', 
                height: '70px', 
                borderRadius: '20px', 
                justifyContent: 'space-between', 
                padding: '0 24px', 
                background: 'var(--charcoal-light)', 
                border: '1px solid var(--charcoal-border)',
                opacity: receipts.length === 0 ? 0.4 : 1,
                cursor: receipts.length === 0 ? 'not-allowed' : 'pointer',
                filter: receipts.length === 0 ? 'grayscale(1)' : 'none'
              }}
              onClick={() => { if (onNavigate) onNavigate('settle'); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '28px' }}>💸</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>Settle Up Now</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>View Optimized Debts</div>
                </div>
              </div>
              <ArrowLeft size={20} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
            </button>
          </div>
        </div>
      ) : isCreating ? (
        
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" className="btn-icon" onClick={() => { setIsCreating(false); }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="title-medium">
                {getSettings().languageTone === 'geng' ? 'Create New Geng' : 'Create New Group'}
              </h2>
              <span className="title-small" style={{ fontSize: '11px' }}>Start tracking debts</span>
            </div>
          </div>

          <div className="bento-card bento-card-full" style={{ gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--electric-mint)', display: 'block', marginBottom: '6px' }}>GROUP NAME</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Genting Trip ⛰️"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>ADD MEMBERS</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Friend's Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTempMember(); } }}
                />
                <button type="button" className="btn-primary" style={{ padding: '0 16px' }} onClick={handleAddTempMember}>
                  <UserPlus size={18} />
                </button>
              </div>
            </div>

            {tempMembers.length > 0 && (
              <div>
                <span className="title-small" style={{ fontSize: '10px', marginBottom: '4px', display: 'block' }}>Geng in this list ({tempMembers.length}):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tempMembers.map(name => (
                    <div key={name} style={{ background: 'var(--electric-mint-dim)', border: '1px solid var(--electric-mint)', color: 'var(--electric-mint)', padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => handleToggleRecentMember(name)}>
                      {name} <span style={{ fontSize: '10px', opacity: 0.8 }}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentMembers.length > 0 && (
              <div>
                <span className="title-small" style={{ fontSize: '10px', marginBottom: '4px', display: 'block' }}>From Recent Memory:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {recentMembers.map(name => {
                    const isAdded = tempMembers.includes(name);
                    return (
                      <div
                        key={name}
                        onClick={() => handleToggleRecentMember(name)}
                        style={{ background: isAdded ? 'var(--electric-mint-dim)' : 'var(--charcoal-deep)', border: isAdded ? '1px solid var(--electric-mint)' : '1px solid var(--charcoal-border)', color: isAdded ? 'var(--electric-mint)' : 'var(--text-secondary)', padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                      >
                        {isAdded ? '✓ ' : '+ '} {name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', height: '50px' }}>
            <Sparkles size={18} /> Let's Onz!
          </button>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="/logo.png" 
                alt="SplitOnz Logo" 
                style={{ 
                  height: '52px', 
                  width: 'auto',
                  // Screen removes black backgrounds in dark mode
                  mixBlendMode: getSettings().theme === 'dark' ? 'screen' : 'normal',
                  // Invert + Hue Rotate removes dark backgrounds in light mode while keeping mint tones
                  filter: getSettings().theme === 'light' ? 'invert(1) hue-rotate(180deg) brightness(1.1)' : 'none',
                  transition: 'all 0.3s ease'
                }} 
              />
              <div>
                <h2 className="title-large" style={{ fontSize: '24px', marginBottom: '-2px' }}>SplitOnz</h2>
                <span className="title-small" style={{ fontSize: '11px' }}>Multi-User Trackers</span>
              </div>
            </div>
            <button className="btn-primary" style={{ borderRadius: '12px', padding: '10px 14px' }} onClick={() => { setIsCreating(true); }}>
              <Plus size={18} /> {getSettings().languageTone === 'geng' ? 'Geng' : 'Group'}
            </button>
          </div>

          {groups.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', gap: '16px', backgroundColor: 'var(--charcoal-light)', borderRadius: '24px', border: '1.5px dashed var(--charcoal-border)' }}>
              <div style={{ fontSize: '50px' }}>☕</div>
              <p style={{ fontWeight: '800', fontSize: '18px' }}>Sunyi giler...</p>
              <button className="btn-primary" onClick={() => { setIsCreating(true); }}>Create Group Now</button>
            </div>
          ) : (
            <div className="bento-grid">
              {groups.map(group => (
                <div key={group.id} className="bento-card" style={{ cursor: 'pointer', gridColumn: 'span 2' }} onClick={() => { setSelectedGroupId(group.id); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--charcoal-deep)', border: '1px solid var(--charcoal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--electric-mint)' }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: '800', fontSize: '17px', color: 'var(--text-primary)' }}>{group.name}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{group.members.length} members</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn-icon"
                        style={{ width: '36px', height: '36px', background: 'var(--charcoal-light)', border: '1px solid var(--charcoal-border)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDashboardGroup(group);
                          setDailyBudgetInput(group.dailyBudget?.toString() || '');
                          setIsViewingDashboard(true);
                        }}
                      >
                        <BarChart3 size={16} color="var(--accent-gold)" />
                      </button>
                      <span className={`status-sticker ${group.status === 'Onz!' ? 'status-sticker-onz' : 'status-sticker-pending'}`} style={{ fontSize: '10px', padding: '4px 8px' }}>{group.status}</span>
                      <button className="btn-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} onClick={(e) => handleDeleteGroup(group.id, e)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dynamic Interactive Geng Wisdom Card */}
          <div 
            onClick={handleCycleQuote}
            className="bento-card bento-card-full" 
            style={{ 
              marginTop: '16px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0, 255, 153, 0.04), rgba(0, 240, 255, 0.02))', 
              border: '1px dashed var(--electric-mint-glow)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              userSelect: 'none',
              padding: '16px 20px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '15px' }}>💡</span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--electric-mint)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {getSettings().languageTone === 'geng' ? 'Geng Slang of the Day' : 'Financial wisdom of the day'}
              </span>
            </div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4', fontStyle: 'italic', margin: 0 }}>
              "{randomQuote || 'Bagi settle, hati ONZ!'}"
            </p>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '2px', fontWeight: 600 }}>
              Tanya Geng Lagi 🔄
            </span>
          </div>
        </div>
      )}
      {/* Trip HQ Dashboard Modal */}
      {isViewingDashboard && dashboardGroup && (
        <div id="trip-hq-dashboard" style={{ position: 'absolute', inset: 0, background: 'var(--charcoal-black)', zIndex: 4000, display: 'flex', flexDirection: 'column' }}>
           <div id="trip-hq-full-report" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--charcoal-black)' }}>
              <div style={{ padding: '20px', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--charcoal-deep)', borderBottom: '1px solid var(--charcoal-border)' }}>
                 <div style={{ width: '48px', visibility: isCapturing ? 'hidden' : 'visible' }}>
                   <button className="btn-icon" onClick={() => setIsViewingDashboard(false)}>
                     <X size={24} />
                   </button>
                 </div>
                 <div style={{ textAlign: 'center', flex: 1 }}>
                   <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>TRIP HQ</h2>
                   <span style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{dashboardGroup.name}</span>
                 </div>
                 <div style={{ width: '48px', display: 'flex', justifyContent: 'flex-end', visibility: isCapturing ? 'hidden' : 'visible' }}>
                   <button className="btn-icon" onClick={async () => {
                      const element = document.getElementById('trip-hq-full-report');
                      if (element) {
                         try {
                            setIsCapturing(true);
                            // Longer delay to ensure DOM is clean
                            await new Promise(r => setTimeout(r, 500));

                            const { domToPng } = await import('modern-screenshot');
                            const dataUrl = await domToPng(element, { 
                              backgroundColor: '#0f172a',
                              scale: 3, // Ultra HD
                              quality: 1,
                              features: {
                                removeControlCharacter: true
                              }
                            });
                            
                            setIsCapturing(false);
                            if (!dataUrl) return;
                            
                            const res = await fetch(dataUrl);
                            const blob = await res.blob();
                            const file = new File([blob], `SplitOnz_${dashboardGroup.name}.png`, { type: 'image/png' });
                            
                            const rates = getCachedRates()?.rates || { MYR: 1 };
                            const totalSpentMYR = getReceipts()
                               .filter(r => r.groupId === dashboardGroup.id)
                               .reduce((sum, r) => sum + (r.totalEntered / (rates[r.currency] || 1)), 0);

                            const shareData = {
                               title: `SplitOnz Trip HQ: ${dashboardGroup.name}`,
                               text: `Onz! Here is our Trip HQ Audit for ${dashboardGroup.name}.\nTotal Spent: RM ${totalSpentMYR.toFixed(2)}\nGenerated by SplitOnz.`,
                               files: [file]
                            };

                            if (navigator.canShare && navigator.canShare(shareData)) {
                               await navigator.share(shareData);
                            } else {
                               const link = document.createElement('a');
                               link.download = `SplitOnz_${dashboardGroup.name}.png`;
                               link.href = dataUrl;
                               link.click();
                            }
                         } catch (err) {
                            setIsCapturing(false);
                            console.error('Share failed', err);
                          }
                       }
                    }}>
                      <Share2 size={20} />
                    </button>
                  </div>
              </div>

              <div id="trip-hq-content" style={{ flex: 1, overflowY: isCapturing ? 'visible' : 'auto', padding: '20px' }}>
                 {/* Budget Tracker Section */}
              <div className="bento-card bento-card-full" style={{ background: 'var(--charcoal-deep)', marginBottom: '24px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                       <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0, 255, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--electric-mint)' }}>
                          <Target size={22} />
                       </div>
                       <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Daily Budget</h3>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tracking today's spending</p>
                       </div>
                    </div>
                    {!(isCapturing && !dashboardGroup.dailyBudget) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--charcoal-light)', padding: '6px 12px', borderRadius: '12px' }}>
                         <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>RM</span>
                         {isCapturing ? (
                           <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '16px' }}>
                              {dashboardGroup.dailyBudget ? dashboardGroup.dailyBudget.toFixed(2) : 'No Limit'}
                           </span>
                         ) : (
                           <input 
                             type="number" 
                             className="input-field" 
                             style={{ width: '80px', height: '28px', background: 'transparent', border: 'none', padding: 0, textAlign: 'right', fontWeight: 900, color: 'var(--text-primary)', fontSize: '16px' }} 
                             value={dailyBudgetInput}
                             onChange={(e) => setDailyBudgetInput(e.target.value)}
                             onBlur={() => {
                               const budget = parseFloat(dailyBudgetInput) || 0;
                               const updatedGroups = getGroups().map(g => g.id === dashboardGroup.id ? { ...g, dailyBudget: budget } : g);
                               saveGroups(updatedGroups);
                               setDashboardGroup({ ...dashboardGroup, dailyBudget: budget });
                               setGroups(updatedGroups);
                             }}
                             placeholder="Set Limit"
                           />
                         )}
                      </div>
                    )}
                 </div>

                     {(() => {

                        const rates = getCachedRates()?.rates || { MYR: 1 };
                        const today = new Date();
                        const todayReceipts = getReceipts().filter(r => {
                          if (r.groupId !== dashboardGroup.id) return false;
                          const d = new Date(r.createdAt);
                          return d.getFullYear() === today.getFullYear() &&
                                 d.getMonth() === today.getMonth() &&
                                 d.getDate() === today.getDate();
                        });
                        
                        const spentTodayMYR = todayReceipts.reduce((sum, r) => {
                           const rate = rates[r.currency] || 1;
                           return sum + (r.totalEntered / rate);
                        }, 0);

                        const budget = dashboardGroup.dailyBudget || 0;
                        const progress = budget > 0 ? Math.min((spentTodayMYR / budget) * 100, 100) : 0;
                        const isOver = budget > 0 && spentTodayMYR > budget;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                   <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>RM {spentTodayMYR.toFixed(2)}</span>
                                   <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                      {isCapturing ? "TODAY'S TOTAL (MYR)" : "spent today (MYR)"}
                                   </span>
                                </div>
                                {!isCapturing && (
                                   <span style={{ fontSize: '12px', fontWeight: 800, color: isOver ? 'var(--danger)' : 'var(--electric-mint)' }}>
                                      {budget > 0 ? `${progress.toFixed(0)}% used` : 'No Limit Set'}
                                   </span>
                                )}
                             </div>
                             <div style={{ height: '8px', background: 'var(--charcoal-light)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: isOver ? 'var(--danger)' : 'var(--electric-mint)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: `0 0 10px ${isOver ? 'var(--danger)' : 'var(--electric-mint)'}` }} />
                             </div>
                          </div>
                        );
                     })()}
              </div>

              {/* Trip Stats Section */}
              <h3 className="title-small" style={{ marginBottom: '12px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>TRIP ANALYTICS</h3>
              
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                     <div className="bento-card" style={{ padding: '20px', background: 'var(--charcoal-deep)' }}>
                        <div style={{ color: 'var(--accent-pink)', marginBottom: '12px' }}><TrendingUp size={20} /></div>
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL SPENT (MYR)</span>
                        <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          RM {(() => {
                            const rates = getCachedRates()?.rates || { MYR: 1 };
                            return getReceipts()
                              .filter(r => r.groupId === dashboardGroup.id)
                              .reduce((sum, r) => sum + (r.totalEntered / (rates[r.currency] || 1)), 0)
                              .toFixed(2);
                          })()}
                        </span>
                     </div>
                     <div className="bento-card" style={{ padding: '20px', background: 'var(--charcoal-deep)' }}>
                        <div style={{ color: 'var(--accent-blue)', marginBottom: '12px' }}><Coins size={20} /></div>
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL BILLS</span>
                        <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {getReceipts().filter(r => r.groupId === dashboardGroup.id).length} Receipts
                        </span>
                     </div>
                  </div>

                  {/* Member Leaderboard */}
                  <div className="bento-card bento-card-full" style={{ background: 'var(--charcoal-deep)' }}>
                     <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={14} /> THE TOP PAYMASTERS (MYR)
                     </h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {dashboardGroup.members.map(m => {
                           const rates = getCachedRates()?.rates || { MYR: 1 };
                           const totalPaidMYR = getReceipts()
                             .filter(r => r.groupId === dashboardGroup.id && r.paidBy === m.id)
                             .reduce((sum, r) => sum + (r.totalEntered / (rates[r.currency] || 1)), 0);
                             
                           return (
                             <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--charcoal-light)', border: '1px solid var(--charcoal-border)', borderRadius: '12px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{m.name}</span>
                                <span style={{ fontWeight: 900, color: totalPaidMYR > 0 ? 'var(--electric-mint)' : 'var(--text-secondary)' }}>RM {totalPaidMYR.toFixed(2)}</span>
                             </div>
                           );
                        })}
                     </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Group Delete Confirmation Modal */}
      {groupToDelete && (
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
        }} onClick={(e) => e.stopPropagation()}>
          <div className="bento-card" style={{ 
            background: 'var(--charcoal-deep)', 
            border: '2px solid var(--danger)',
            borderRadius: '28px',
            padding: '28px 24px', 
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid var(--danger)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto',
              color: 'var(--danger)',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)'
            }}>
              <Trash2 size={32} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {getSettings().languageTone === 'geng' ? 'Wipe this Geng? 🗑️' : 'Delete Group? 🗑️'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
                This will permanently delete the group <strong>"{groups.find(g => g.id === groupToDelete)?.name}"</strong> along with all its scanned receipts, budgets, and debts.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--accent-pink)', fontWeight: '700', lineHeight: '1.5' }}>
                There is absolutely no undo! Are you sure?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setGroupToDelete(null)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', fontWeight: '800' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => confirmDeleteGroup(groupToDelete)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', background: 'var(--danger)', boxShadow: 'none', fontWeight: '800' }}
              >
                Yes, Wipe It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default GroupsTab;
