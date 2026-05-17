import { useState } from 'react';
import { 
  User, 
  Moon, 
  Sun, 
  Trash2, 
  ShieldCheck, 
  CreditCard,
  Download,
  Upload
} from 'lucide-react';
import { getSettings, saveSettings, clearAllData, type AppSettings } from '../utils/storage';

export function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleClearData = () => {
    clearAllData();
    window.location.reload(); // Refresh to clear state
  };

  const handleExportData = () => {
    try {
      const backup: Record<string, any> = {};
      const keys = ['onz_groups', 'onz_receipts', 'onz_recent_members', 'onz_rates', 'onz_gemini_key', 'onz_settlements', 'onz_settings'];
      
      keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) backup[key] = JSON.parse(val);
      });

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SplitOnz-Backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data: ' + err);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const keys = ['onz_groups', 'onz_receipts', 'onz_recent_members', 'onz_rates', 'onz_gemini_key', 'onz_settlements', 'onz_settings'];
        
        // Simple validation
        if (!json.onz_groups && !json.onz_receipts) {
          alert('Invalid backup file. Could not find groups or receipts data.');
          return;
        }

        keys.forEach(key => {
          if (json[key]) {
            localStorage.setItem(key, JSON.stringify(json[key]));
          }
        });

        alert('Backup imported successfully! SplitOnz is reloading...');
        window.location.reload();
      } catch (err) {
        alert('Failed to parse backup file: ' + err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="tab-scroll-container" style={{ padding: '20px', paddingBottom: '60px', position: 'relative' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 className="title-large" style={{ fontSize: '32px' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Personalize your SplitOnz experience</p>
      </header>

      {/* Profile Section */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <User size={14} style={{ color: 'var(--electric-mint)' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Profile</h2>
        </div>
        
        <div className="bento-card bento-card-full" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginLeft: '4px' }}>Your Nickname</label>
            <input 
              type="text" 
              className="input-field"
              value={settings.userName}
              onChange={(e) => updateSetting('userName', e.target.value)}
              placeholder="e.g. Lewis"
              style={{ fontSize: '16px', fontWeight: '600' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '4px' }}>
              Used to highlight your debts and payments automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Accounting Section */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CreditCard size={14} style={{ color: 'var(--accent-blue)' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill Logic</h2>
        </div>
        
        <div className="bento-card bento-card-full" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Rounding Mode */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--charcoal-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Rounding Mode</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Handle pesky cents</div>
              </div>
            </div>
            <div className="tab-slider-container" style={{ padding: '3px' }}>
              <button 
                onClick={() => updateSetting('roundingMode', 'mamak')}
                className={`tab-slider-btn ${settings.roundingMode === 'mamak' ? 'tab-slider-btn-active' : ''}`}
                style={{ fontSize: '12px' }}
              >
                Mamak (0.05)
              </button>
              <button 
                onClick={() => updateSetting('roundingMode', 'precise')}
                className={`tab-slider-btn ${settings.roundingMode === 'precise' ? 'tab-slider-btn-active' : ''}`}
                style={{ fontSize: '12px' }}
              >
                Precise (0.01)
              </button>
            </div>
          </div>


          {/* Hide Settled */}
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Hide Settled Groups</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keep the home screen clean</div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.hideSettledGroups} 
                onChange={() => updateSetting('hideSettledGroups', !settings.hideSettledGroups)} 
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sun size={14} style={{ color: 'var(--accent-gold)' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Style & Tone</h2>
        </div>
        
        <div className="bento-card bento-card-full" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Language Tone */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--charcoal-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>App Tone</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chill slang vs Standard</div>
              </div>
            </div>
            <div className="tab-slider-container" style={{ padding: '3px' }}>
              <button 
                onClick={() => updateSetting('languageTone', 'geng')}
                className={`tab-slider-btn ${settings.languageTone === 'geng' ? 'tab-slider-btn-active' : ''}`}
                style={{ fontSize: '12px' }}
              >
                Geng (Chill)
              </button>
              <button 
                onClick={() => updateSetting('languageTone', 'standard')}
                className={`tab-slider-btn ${settings.languageTone === 'standard' ? 'tab-slider-btn-active' : ''}`}
                style={{ fontSize: '12px' }}
              >
                Standard
              </button>
            </div>
          </div>

          {/* Sound Effects Toggle */}
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--charcoal-border)' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Sound Effects</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Satisfying retro arcade chimes</div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.soundEffectsEnabled !== false} 
                onChange={() => updateSetting('soundEffectsEnabled', settings.soundEffectsEnabled === false ? true : false)} 
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Accent Color Picker */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--charcoal-border)' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Accent Color</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Repaint SplitOnz highlight colors</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {[
                { id: 'mint', color: '#00FF99', label: 'Mint' },
                { id: 'pink', color: '#FF007F', label: 'Pink' },
                { id: 'gold', color: '#FFD700', label: 'Gold' },
                { id: 'blue', color: '#00F0FF', label: 'Blue' },
                { id: 'purple', color: '#A855F7', label: 'Purple' }
              ].map((colorPack) => {
                const isSelected = (settings.accentColor || 'mint') === colorPack.id;
                return (
                  <button
                    key={colorPack.id}
                    onClick={() => updateSetting('accentColor', colorPack.id as any)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      background: 'var(--charcoal-deep)',
                      border: isSelected ? `2.5px solid ${colorPack.color}` : '1.5px solid var(--charcoal-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'var(--transition-bounce)',
                      boxShadow: isSelected ? `0 0 10px ${colorPack.color}40` : 'none',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      padding: 0
                    }}
                    title={colorPack.label}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: colorPack.color,
                      boxShadow: `0 0 8px ${colorPack.color}80`
                    }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Toggle */}
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Theme</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dark mode is premium</div>
            </div>
            <div className="tab-slider-container" style={{ padding: '3px', width: '120px' }}>
              {[
                { id: 'light', icon: Sun },
                { id: 'dark', icon: Moon }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSetting('theme', t.id as any)}
                  className={`tab-slider-btn ${settings.theme === t.id ? 'tab-slider-btn-active' : ''}`}
                  style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <t.icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Backup & Restore */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Download size={14} style={{ color: 'var(--electric-mint)' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Backup & Restore</h2>
        </div>
        
        <div className="bento-card bento-card-full" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Keep your travel data safe offline. Download backups of all travel groups, OCR receipt audits, and debt settlements.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleExportData}
              className="btn-secondary"
              style={{ flex: 1, height: '42px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700' }}
            >
              <Download size={14} /> Export Backup
            </button>
            <label 
              className="btn-secondary"
              style={{ flex: 1, height: '42px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer', textAlign: 'center', border: '1px solid var(--charcoal-border)' }}
            >
              <Upload size={14} /> Import Backup
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportData}
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>
      </section>

      {/* Safety Zone */}
      <section style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldCheck size={14} style={{ color: 'var(--danger)' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Safety</h2>
        </div>
        
        <button 
          onClick={() => setShowClearConfirm(true)}
          className="btn-secondary"
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--danger)',
            borderColor: 'var(--danger)',
            borderStyle: 'dashed',
            background: 'rgba(239, 68, 68, 0.05)',
            fontWeight: '700'
          }}
        >
          <Trash2 size={18} /> Clear All App Data
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
          SplitOnz v1.2.0 • Build with ❤️ for the Geng
        </div>
      </section>

      {/* Wipe All App Data Confirmation Modal */}
      {showClearConfirm && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(2, 6, 23, 0.85)', 
          backdropFilter: 'blur(20px)', 
          zIndex: 9999, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '24px' 
        }}>
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
                Wipe Everything? 💥
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
                This is a nuclear option. It will permanently wipe all groups, scanned receipts, daily budgets, custom exchange rates, and settings from this browser.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--accent-pink)', fontWeight: '700', lineHeight: '1.5' }}>
                No undos! This action cannot be reversed!
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowClearConfirm(false)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', fontWeight: '800' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleClearData}
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
}
