import { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Coins, Signal, Wifi, BatteryMedium, X, Image as ImageIcon, Eye, Share2, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GroupsTab } from './components/GroupsTab';
import { OcrTab } from './components/OcrTab';
import { SettleTab } from './components/SettleTab';
import { CurrencyTab } from './components/CurrencyTab';
import { ToastContainer } from './components/ToastContainer';
import { SplashScreen } from './components/SplashScreen';
import { SettingsTab } from './components/SettingsTab';
import { ShareSheet } from './components/ShareSheet';
import { initializeStorage, getGroups, getSettings, getReceipts, saveCachedRates } from './utils/storage';
import { domToPng } from 'modern-screenshot';
import type { Group } from './utils/storage';

type TabType = 'groups' | 'split' | 'settle' | 'currency' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState('12:00 PM');
  const [showSplash, setShowSplash] = useState(true);
  const [appTheme, setAppTheme] = useState(getSettings().theme);
  const [appAccent, setAppAccent] = useState(getSettings().accentColor || 'mint');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Modal states
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [shareData, setShareData] = useState<{group: any, transactions: any[], viewCurrency: string, rates: any} | null>(null);
  const [showReceiptVault, setShowReceiptVault] = useState(false);
  const [vaultGroup, setVaultGroup] = useState<any>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    initializeStorage();
    const loadedGroups = getGroups();
    setGroups(loadedGroups);

    // Hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    // Silent background fetch to grab latest market rates
    fetch('https://v6.exchangerate-api.com/v6/4e7dcbe37cbd9ac5981bd7cf/latest/MYR')
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data && data.conversion_rates) {
          saveCachedRates(data.conversion_rates);
        }
      })
      .catch(err => console.error('Silent background rates fetch failed:', err));
    
    return () => clearTimeout(timer);
  }, []);

  // Update selected group whenever groups or selection changes
  const selectedGroup = useMemo(() => 
    groups.find(g => g.id === selectedGroupId) || null
  , [groups, selectedGroupId]);

  // Function to refresh data from storage
  const refreshData = () => {
    setGroups(getGroups());
  };

  // Update simulated status bar clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };
    
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Theme and Accent management - polling localStorage for changes from SettingsTab
  useEffect(() => {
    const checkTheme = () => {
      const currentSettings = getSettings();
      if (currentSettings.theme !== appTheme) {
        setAppTheme(currentSettings.theme);
      }
      const currentAccent = currentSettings.accentColor || 'mint';
      if (currentAccent !== appAccent) {
        setAppAccent(currentAccent);
      }
    };
    
    const interval = setInterval(checkTheme, 500);
    return () => clearInterval(interval);
  }, [appTheme, appAccent]);

  const isLightTheme = useMemo(() => {
    return appTheme === 'light';
  }, [appTheme]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const shareSheetRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const executeShare = async () => {
    if (!shareData || !shareSheetRef.current) return;
    setIsSharing(true);
    try {
      const node = shareSheetRef.current;
      
      // Give a tiny bit more time for any pending renders
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const bgColor = isLightTheme ? '#F8FAFC' : '#0F172A';
      
      // Use domToPng with optimized settings
      const dataUrl = await domToPng(node, {
        quality: 1,
        scale: 3, // Higher scale for better clarity on mobile
        backgroundColor: bgColor,
        width: 450,
      });

      // Manual base64 to blob conversion for better compatibility
      const base64Data = dataUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      const file = new File([blob], `SplitOnz-Summary.png`, { type: 'image/png' });

      // Check for Web Share API support with files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `SplitOnz Settlement`,
          text: `Settlement for ${shareData.group.name}! #SplitOnz`,
        });
        setShowSharePreview(false);
      } else {
        // Fallback to direct download
        const link = document.createElement('a');
        link.download = `SplitOnz-Summary.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show a message if sharing isn't supported
        console.log('Web Share API not supported or failed, falling back to download');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Sharing failed. Please try again or take a screenshot.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className={`app-container ${isLightTheme ? 'light-theme' : ''} theme-${appAccent}`} ref={containerRef}>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>
      <ToastContainer />
      <div className="status-bar">
        <span>{timeStr}</span>
        <div className="status-bar-notch" />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Signal size={13} strokeWidth={2.5} />
          <Wifi size={13} strokeWidth={2.5} />
          <BatteryMedium size={14} strokeWidth={2.5} style={{ opacity: 0.9 }} />
        </div>
      </div>

      <div className="app-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -10, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {activeTab === 'groups' && (
              <GroupsTab
                selectedGroupId={selectedGroupId}
                setSelectedGroupId={setSelectedGroupId}
                onNavigate={handleTabChange}
                onGroupsChange={refreshData}
              />
            )}

            {activeTab === 'split' && (
              <OcrTab
                selectedGroup={selectedGroup}
                onReceiptAdded={() => { refreshData(); setActiveTab('settle'); }}
                onNavigate={handleTabChange}
              />
            )}

            {activeTab === 'settle' && (
              <SettleTab
                selectedGroupId={selectedGroupId}
                setSelectedGroupId={setSelectedGroupId}
                onNavigate={handleTabChange}
                onShowShare={(data) => { setShareData(data); setShowSharePreview(true); }}
                onShowVault={(group) => { setVaultGroup(group); setShowReceiptVault(true); }}
              />
            )}

            {activeTab === 'currency' && (
              <CurrencyTab />
            )}

            {activeTab === 'settings' && (
              <SettingsTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {(activeTab === 'groups' || activeTab === 'currency' || activeTab === 'settings') && (
        <div className="bottom-navbar">
        <button
          className={`nav-item ${activeTab === 'groups' ? 'nav-item-active' : ''}`}
          onClick={() => handleTabChange('groups')}
        >
          <div className="nav-item-icon-wrapper">
            <Users size={20} />
          </div>
          <span>Gengs</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'currency' ? 'nav-item-active' : ''}`}
          onClick={() => handleTabChange('currency')}
        >
          <div className="nav-item-icon-wrapper">
            <Coins size={20} />
          </div>
          <span>Rates</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'nav-item-active' : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          <div className="nav-item-icon-wrapper">
            <Settings size={20} />
          </div>
          <span>Settings</span>
        </button>
        </div>
      )}

      <AnimatePresence>
        {showSharePreview && shareData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ 
              position: 'absolute', 
              inset: 0, 
              background: isLightTheme ? '#F1F5F9' : '#0B1120', 
              zIndex: 9000, 
              borderRadius: '40px', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }}
          >
            <div style={{ 
              padding: '16px 20px', 
              paddingTop: '48px', // Increased to clear status bar and notch
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', 
              flexShrink: 0 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={16} color={isLightTheme ? 'var(--electric-mint)' : 'var(--electric-mint)'} />
                <h3 style={{ color: isLightTheme ? '#0F172A' : 'white', fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }}>SHARE SUMMARY</h3>
              </div>
              <button 
                onClick={() => setShowSharePreview(false)} 
                style={{ 
                  background: isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', 
                  border: 'none', 
                  color: isLightTheme ? '#0F172A' : 'white', 
                  padding: '6px', 
                  borderRadius: '10px', 
                  cursor: 'pointer' 
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '24px 16px 40px', // Extra bottom padding for scroll room
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: '12px',
              minHeight: 0 // Crucial for flex scrolling
            }}>
               <div style={{ 
                 width: '100%', 
                 maxWidth: '450px', 
                 boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)', 
                 borderRadius: '8px', 
                 overflow: 'hidden',
                 flexShrink: 0, // Don't let the card shrink
                 height: 'fit-content'
               }}>
                 <ShareSheet 
                   group={shareData.group} 
                   transactions={shareData.transactions} 
                   sheetRef={shareSheetRef} 
                   viewCurrency={shareData.viewCurrency}
                   rates={shareData.rates}
                   isLightTheme={isLightTheme}
                 />
               </div>
               <p style={{ fontSize: '12px', color: isLightTheme ? '#64748B' : '#94A3B8', fontWeight: 600, opacity: 0.7, textAlign: 'center', marginTop: '8px', flexShrink: 0 }}>
                 Preview of the generated audit graphic
               </p>
            </div>
            <div style={{ 
              padding: '20px', 
              display: 'flex', 
              gap: '12px', 
              background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(11, 17, 32, 0.95)', 
              backdropFilter: 'blur(15px)', 
              borderTop: isLightTheme ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)', 
              flexShrink: 0 
            }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, height: '52px', borderRadius: '16px', fontWeight: 700 }} 
                onClick={() => setShowSharePreview(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 2, height: '52px', borderRadius: '16px', fontWeight: 800, fontSize: '16px' }} 
                onClick={executeShare} 
                disabled={isSharing}
              >
                {isSharing ? 'Generating...' : 'Confirm & Share'}
              </button>
            </div>
          </motion.div>
        )}

        {showReceiptVault && vaultGroup && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'absolute', top: '48px', left: '12px', right: '12px', bottom: '12px', background: 'var(--charcoal-black)', zIndex: 9000, borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}
          >
             <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'white' }}>Receipt Vault</h2>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{vaultGroup.name}</span>
              </div>
              <button onClick={() => setShowReceiptVault(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {getReceipts().filter(r => r.groupId === vaultGroup.id).length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)' }}>
                  <ImageIcon size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                  <p style={{ fontSize: '13px' }}>No receipts archived for this geng yet.</p>
                </div>
              ) : (
                getReceipts().filter(r => r.groupId === vaultGroup.id).map(receipt => (
                  <div key={receipt.id} className="bento-card bento-card-full" style={{ padding: '12px', background: 'var(--charcoal-deep)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'var(--charcoal-light)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      {receipt.imageUrl ? (
                        <img src={receipt.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: 'white' }}>{receipt.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                        {new Date(receipt.createdAt).toLocaleDateString()} • {receipt.currency} {receipt.totalEntered.toFixed(2)}
                      </div>
                    </div>
                    {receipt.imageUrl && (
                      <button className="btn-icon" style={{ background: 'var(--electric-mint-dim)', color: 'var(--electric-mint)', width: '36px', height: '36px' }} onClick={() => setViewingReceiptUrl(receipt.imageUrl || null)}>
                        <Eye size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {viewingReceiptUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: '12px', background: 'rgba(0,0,0,0.95)', zIndex: 10000, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            onClick={() => setViewingReceiptUrl(null)}
          >
            <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', zIndex: 10010 }}>
              <X size={24} />
            </button>
            <img src={viewingReceiptUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Receipt Proof" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
