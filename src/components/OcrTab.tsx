import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, ArrowLeft, Camera, RefreshCw, Users, Dices } from 'lucide-react';
import type { Group, ReceiptItem } from '../utils/storage';
import { saveReceipts, saveGroups, getGeminiKey, getGroups, getReceipts, getCachedRates, getSettings } from '../utils/storage';
import { CurrencySelect } from './CurrencySelect';
import { toast } from '../utils/toast';
import { playSound } from '../utils/sounds';


interface OcrTabProps {
  selectedGroup: Group | null;
  onReceiptAdded?: () => void;
  onNavigate?: (tab: 'groups' | 'split' | 'settle' | 'currency') => void;
}

export const OcrTab: React.FC<OcrTabProps> = ({
  selectedGroup,
  onReceiptAdded,
  onNavigate,
}) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1); // 1: Capture, 2: Review, 3: Assign/Split

  const [billTitle, setBillTitle] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [rates, setRates] = useState<Record<string, number>>({ MYR: 1.0 });
  const [receiptTotal, setReceiptTotal] = useState<number | ''>('');
  const [taxServiceCharge, setTaxServiceCharge] = useState(false);
  const [taxSst, setTaxSst] = useState(false);
  const [flatTax, setFlatTax] = useState<number | ''>('');
  const [roundingAdjustment, setRoundingAdjustment] = useState<number>(0);
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'custom'>('equal');
  const [forceGlobalEqual, setForceGlobalEqual] = useState(false);
  const [customIncludesTax, setCustomIncludesTax] = useState(true);
  const [isRouletting, setIsRouletting] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState<string | null>(null);
  const [showAiWarning, setShowAiWarning] = useState(false);

  const [items, setItems] = useState<ReceiptItem[]>([
    { id: 'item-1', name: '', price: 0, assignedTo: [] }
  ]);

  const [customSplits, setCustomSplits] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load rates
    const cached = getCachedRates();
    if (cached) setRates(cached.rates);

    if (selectedGroup && selectedGroup.members.length > 0) {
      const settings = getSettings();
      const activeUser = settings.userName || '';
      const meUser = selectedGroup.members.find(m => m.name.toLowerCase() === activeUser.toLowerCase());
      const isMemberOfCurrentGroup = selectedGroup.members.some(m => m.id === paidByMemberId);
      
      if (!paidByMemberId || !isMemberOfCurrentGroup) {
        setPaidByMemberId(meUser ? meUser.id : selectedGroup.members[0].id);
      }
      
      const initialSplits: Record<string, number> = { ...customSplits };
      selectedGroup.members.forEach(m => {
        if (initialSplits[m.id] === undefined) initialSplits[m.id] = 0;
      });
      setCustomSplits(initialSplits);

      setItems(prev => prev.map(it => ({
        ...it,
        assignedTo: (it.assignedTo.length === 0 && it.price > 0) ? selectedGroup.members.map(m => m.id) : it.assignedTo
      })));
    }
  }, [selectedGroup]);

  const handleAddItem = (name = '', price = 0) => {
    setItems([...items, { 
      id: `item-${Date.now()}-${Math.random()}`, 
      name, 
      price, 
      assignedTo: (selectedGroup && price > 0) ? selectedGroup.members.map(m => m.id) : [] 
    }]);
  };

  const handleDeleteItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemFieldChange = (id: string, field: 'name' | 'price', value: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: field === 'price' ? (value === '' ? 0 : parseFloat(value) || 0) : value } : it));
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
      setTimeout(() => document.getElementById(`name-input-${idx + 1}`)?.focus(), 50);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use a Canvas to compress/resize if image is too large
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height *= maxDim / width;
            width = maxDim;
          } else {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Export as JPEG with 0.8 quality to keep file size small but legible
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setUploadedImage(compressedBase64);
        scanReceiptWithGemini(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const scanReceiptWithGemini = async (base64Image: string) => {
    setIsScanning(true);
    try {
      const apiKey = getGeminiKey();
      if (!apiKey) { 
        toast('Go to Rates -> Settings to set Gemini Key!', 'error'); 
        setIsScanning(false); 
        return; 
      }

      const mimeType = base64Image.match(/data:([^;]+);/)?.[1] || "image/jpeg";
      const requestBody = JSON.stringify({ 
        contents: [{ 
          parts: [{ 
              text: `You are an expert receipt analyzer for a bill-splitting app. Your goal is to extract a final, reconciled list of items and prices.

CRITICAL CURRENCY RULES:
1. ACTIVE CURRENCY DETECTION: Inspect the receipt text, store name/logo, address details, and currency symbols (e.g. "฿", "Baht", "THB", "RM", "MYR", "S$", "SGD", "$", "USD", "€", "EUR"). 
2. SET THE RIGHT ISO CODE: You MUST output the correct 3-letter ISO currency code (e.g., "THB" if the receipt contains "฿", "Baht", "Bangkok", or "Phuket"; "MYR" for Malaysia Ringgit; "SGD" for Singapore; "USD" for US, etc.). Never default to MYR unless the receipt is actually Malaysian.

CRITICAL TRANSLATION RULE:
1. FOREIGN LANGUAGE TRANSLATION: If the receipt has item names in a foreign language (e.g. Japanese, Thai, Chinese, Korean, Spanish, French, Italian, etc.), you MUST translate all item names into clear English or Malay (e.g., "ผัดไทย" -> "Pad Thai", "ラーメン" -> "Ramen", "小籠包" -> "Xiao Long Bao", "Tom Yum Goong" etc.). This is vital so travel members can read what they are splitting!

CRITICAL DISCOUNT RULES:
1. IDENTIFY DEDUCTIONS: Look for words like "LESS", "DISCOUNT", "DISC", "PROMO", "REBATE", "VOUCHER" or negative signs "-". These are SUBTRACTIONS.
2. ITEM-SPECIFIC DISCOUNTS: If a discount appears immediately below an item (e.g., "Burger 10.00" followed by "Disc -2.00"), you MUST merge them. Return a single item: { "name": "Burger [Disc applied]", "price": 8.00 }. 
3. UNLINKED DISCOUNTS: If a discount is general (e.g., a subtotal voucher), return it as a SEPARATE line item with a NEGATIVE price (e.g., { "name": "Voucher", "price": -5.00 }).
4. NO POSITIVE DISCOUNTS: Never return a discount as a positive number. If it adds to the bill, it is not a discount.

STRICT TAX RULES:
1. EMERGENCY RULE: If you see "Service Tax 6%" on the paper, you MUST set "taxSst": true AND "flatTax": 0. If you see "Service Charge 10%", you MUST set "taxServiceCharge": true AND "flatTax": 0.
2. NO DOUBLE CHARGING: Never provide a dollar amount in flatTax if you have toggled a boolean flag for that same tax.

DATA ACCURACY:
- Ensure (Sum of all item prices) + Tax/Service Charge + Rounding = Final Total.
- The 'flatTax' field should ONLY contain amounts not covered by the 6% or 10% toggles.

Format: { "title": "Store Name", "currency": "ISO Code", "taxSst": false, "taxServiceCharge": false, "flatTax": 0.00, "items": [{ "name": "Item Name", "price": 0.00 }], "total": 0.00, "roundingAdjustment": 0.00 }. 
Return ONLY raw JSON.` 
          }, { 
            inlineData: { mimeType, data: base64Image.split(',')[1] } 
          }] 
        }] 
      });

      let response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      // Automatic multi-level fallback if 2.5 Flash is overloaded or rate limited
      if (!response.ok && (response.status === 503 || response.status === 429 || response.status >= 500)) {
         console.warn('Gemini 2.5 Flash busy/limit. Retrying with Gemini 2.0 Flash in 1s...');
         await new Promise(resolve => setTimeout(resolve, 1000));
         
         response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: requestBody
         });

         // Final fallback to Flash-Lite if even 2.0 is busy
         if (!response.ok && (response.status === 503 || response.status === 429 || response.status >= 500)) {
           console.warn('Gemini 2.0 Flash busy. Retrying with Gemini 2.5 Flash-Lite in 1s...');
           await new Promise(resolve => setTimeout(resolve, 1000));

           response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: requestBody
           });
         }
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('FULL Gemini Error Response:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error?.message || 'API Request Failed');
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Gemini Raw Response:', rawText);

      // Robust JSON extraction
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No valid receipt data found in image');

      const result = JSON.parse(jsonMatch[0]);
      
      if (result.title) setBillTitle(result.title);
      if (result.currency && typeof result.currency === 'string') {
        const cleanCurrency = result.currency.trim().toUpperCase();
        setCurrency(cleanCurrency);
      }
      if (result.taxSst !== undefined) setTaxSst(!!result.taxSst);
      if (result.taxServiceCharge !== undefined) setTaxServiceCharge(!!result.taxServiceCharge);
      if (result.flatTax !== undefined) setFlatTax(result.flatTax);
      if (result.total !== undefined) setReceiptTotal(result.total);
      if (result.roundingAdjustment !== undefined) setRoundingAdjustment(result.roundingAdjustment);
      if (result.items) {
        setItems(result.items.map((it: any, idx: number) => ({ 
          id: `it-${Date.now()}-${idx}`, 
          name: it.name, 
          price: it.price, 
          assignedTo: (selectedGroup && it.price > 0) ? selectedGroup.members.map(m => m.id) : [] 
        })));
      }
      
      setFlowStep(2);
      setShowAiWarning(true);
      toast('Scan successful!', 'success');
      playSound('success');
    } catch (err: any) { 
      console.error('Scan process failed:', err);
      toast(err.message || 'Scan failed! Try again.', 'error'); 
    } finally { 
      setIsScanning(false); 
    }
  };

  const runRoulette = () => {
    if (!selectedGroup) return;
    setIsRouletting(true);
    setRouletteWinner(null);
    
    let iterations = 0;
    const maxIterations = 25;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * selectedGroup.members.length);
      setRouletteWinner(selectedGroup.members[randomIndex].name);
      playSound('tick');
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalWinner = selectedGroup.members[randomIndex];
        setPaidByMemberId(finalWinner.id);
        playSound('winner');
        setTimeout(() => setIsRouletting(false), 1500);
      }
    }, 80);
  };

  const itemsSubtotal = items.reduce((sum, it) => sum + it.price, 0);
  const computedTotal = parseFloat((itemsSubtotal * (1 + (taxServiceCharge ? 0.1 : 0) + (taxSst ? 0.06 : 0)) + (Number(flatTax) || 0) + roundingAdjustment).toFixed(2));
  const isMatch = receiptTotal !== '' && Math.abs(computedTotal - Number(receiptTotal)) < 0.01;

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !billTitle.trim()) {
      toast('Please enter a bill title!', 'error');
      return;
    }

    const finalTotal = Number(receiptTotal) || computedTotal;

    // Validations
    if (splitType === 'percentage') {
       const sum = Object.values(customSplits).reduce((a, b) => a + (b || 0), 0);
       if (Math.abs(sum - 100) > 0.01) {
           toast(`Percentages must equal 100%. Current: ${sum.toFixed(2)}%`, 'error');
           return;
       }
    } else if (splitType === 'custom') {
       const taxMultiplier = 1 + (taxServiceCharge ? 0.1 : 0) + (taxSst ? 0.06 : 0);
       const rawSum = Object.values(customSplits).reduce((a, b) => a + (b || 0), 0);
       const extraCharges = (Number(flatTax) || 0) + roundingAdjustment;
       const totalAssigned = customIncludesTax ? rawSum : (rawSum * taxMultiplier + extraCharges);
       if (Math.abs(totalAssigned - finalTotal) > 0.05) {
           toast(`Custom amounts must equal total (${finalTotal.toFixed(2)}). Current: ${totalAssigned.toFixed(2)}`, 'error');
           return;
       }
    }

      saveReceipts([{ 
      id: `r-${Date.now()}`, 
      groupId: selectedGroup.id, 
      title: billTitle.trim(), 
      imageUrl: uploadedImage || undefined,
      items, 
      taxServiceCharge, 
      taxSst, 
      flatTax: Number(flatTax) || 0,
      roundingAdjustment,
      currency, 
      totalEntered: finalTotal, 
      paidBy: paidByMemberId, 
      splitType, 
      forceGlobalEqual: splitType === 'equal' ? forceGlobalEqual : false,
      customIncludesTax: splitType === 'custom' ? customIncludesTax : true,
      customSplits: splitType === 'equal' ? undefined : customSplits, 
      createdAt: new Date().toISOString() 
    }, ...getReceipts()]);
    
    saveGroups(getGroups().map(g => g.id === selectedGroup.id ? { ...g, status: 'Pending...' } : g));
    toast('Bill Saved! Onz!', 'success');
    if (onReceiptAdded) onReceiptAdded();
  };

  return (
    <div className="ocr-split-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--charcoal-black)' }}>
      
      {/* --- STEP PROGRESS INDICATOR --- */}
      <div style={{ padding: '16px 24px 8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--charcoal-deep)', borderBottom: '1px solid var(--charcoal-border)' }}>
        <button type="button" className="btn-icon" style={{ width: '32px', height: '32px' }} onClick={() => { 
          if (flowStep > 1) setFlowStep((flowStep - 1) as any);
          else if (onNavigate) onNavigate('groups');
        }}>
          <ArrowLeft size={16} />
        </button>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[1, 2, 3].map(step => (
            <div key={step} style={{ 
              width: '24px', height: '4px', borderRadius: '2px', 
              background: flowStep >= step ? 'var(--electric-mint)' : 'var(--charcoal-border)',
              transition: 'var(--transition-smooth)'
            }} />
          ))}
        </div>

        <div style={{ width: '32px' }} /> {/* Spacer */}
      </div>

      <form onSubmit={handleSaveBill} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* --- STEP 1: CAPTURE --- */}
        {flowStep === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '28px' }}>
            <div className="ocr-top-preview bento-card" style={{ 
              width: '100%', 
              height: '58vh', 
              borderRadius: '32px', 
              border: '2px dashed var(--charcoal-border)', 
              background: 'var(--charcoal-deep)',
              overflowY: 'auto',
              overflowX: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.1)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {!uploadedImage ? (
                <label style={{ 
                  cursor: 'pointer', 
                  height: '100%', 
                  width: '100%', 
                  display: 'flex',
                  flexDirection: 'column', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '20px',
                  padding: '20px'
                }}>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '28px', 
                    background: 'rgba(0, 255, 153, 0.05)', 
                    border: '1px solid rgba(0, 255, 153, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(0, 255, 153, 0.1)',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', inset: -2, borderRadius: '30px', background: 'var(--electric-mint)', opacity: 0.1, filter: 'blur(8px)' }} />
                    <Camera size={36} color="var(--electric-mint)" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Upload Receipt</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px', display: 'block', opacity: 0.8 }}>Snap a photo to begin Onz! flow</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ position: 'relative', width: '100%', minHeight: '100%', display: 'flex', alignItems: 'flex-start' }}>
                  <img src={uploadedImage} style={{ width: '100%', height: 'auto', display: 'block' }} alt="Receipt" />
                  
                  {isScanning && (
                    <>
                      <div className="scanner-laser" style={{ height: '4px', zIndex: 10, background: 'linear-gradient(to right, transparent, var(--electric-mint), transparent)', boxShadow: '0 0 15px var(--electric-mint)' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 255, 153, 0.08)', backdropFilter: 'grayscale(0.5)' }} />
                    </>
                  )}
                  
                  {!isScanning && (
                    <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
                      <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap', backdropFilter: 'blur(12px)', background: 'var(--charcoal-deep)', border: '1px solid var(--charcoal-border)', padding: '10px 20px', borderRadius: '100px', fontWeight: 700, fontSize: '12px' }} onClick={() => setUploadedImage(null)}>
                        <RefreshCw size={14} style={{ marginRight: '8px' }} /> Retake Photo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isScanning && (
              <div style={{ textAlign: 'center', color: 'var(--electric-mint)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <RefreshCw className="spin" size={32} />
                  <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid var(--electric-mint)', opacity: 0.2, animation: 'pulse 2s infinite' }} />
                </div>
                <span style={{ fontWeight: 800, letterSpacing: '2px', fontSize: '11px', textTransform: 'uppercase' }}>AI Analyzing...</span>
              </div>
            )}

            {!isScanning && uploadedImage && (
              <button type="button" className="btn-primary" style={{ width: '100%', height: '60px', borderRadius: '20px', fontSize: '16px', boxShadow: '0 10px 25px -5px rgba(0, 255, 153, 0.3)' }} onClick={() => setFlowStep(2)}>
                Next: Review Items <ArrowLeft size={20} style={{ marginLeft: '10px', transform: 'rotate(180deg)' }} />
              </button>
            )}

            <div className="bento-card" style={{ 
              padding: '18px 20px', 
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--electric-mint-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--electric-mint)' }}>
                    <Users size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {getSettings().languageTone === 'geng' ? 'Current Geng' : 'ACTIVE GROUP'}
                    </h4>
                    <span style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-primary)' }}>{selectedGroup?.name || 'No Group Selected'}</span>
                  </div>
               </div>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--electric-mint)', boxShadow: '0 0 10px var(--electric-mint)' }} />
            </div>
          </div>
        )}

        {/* --- STEP 2: REVIEW --- */}
        {flowStep === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 className="title-medium">Review Bill Items</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bill Title</label>
                    <input type="text" className="input-field" value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder="e.g. Dinner with Geng" required />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase' }}>Flat Tax</label>
                      <input type="number" step="0.01" className="input-field" style={{ borderColor: 'rgba(255, 193, 7, 0.4)' }} value={flatTax || ''} onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        setFlatTax(e.target.value === '' || isNaN(parsed) ? '' : parsed);
                      }} placeholder="0.00" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rounding</label>
                      <input type="number" step="0.01" className="input-field" value={roundingAdjustment || ''} onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        setRoundingAdjustment(e.target.value === '' || isNaN(parsed) ? 0 : parsed);
                      }} placeholder="0.00" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</label>
                      <input type="number" step="0.01" className="input-field" value={receiptTotal} onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        setReceiptTotal(e.target.value === '' || isNaN(parsed) ? '' : parsed);
                      }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>CURRENCY</label>
                  <CurrencySelect 
                    value={currency} 
                    onChange={(val) => setCurrency(val)} 
                    options={Object.keys(rates)} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currency !== 'MYR' && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    padding: '12px 16px', 
                    background: 'linear-gradient(135deg, rgba(0, 255, 153, 0.08), rgba(0, 240, 255, 0.05))', 
                    border: '1.5px solid var(--electric-mint-glow)', 
                    borderRadius: '16px',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px 0 rgba(0, 255, 153, 0.04)',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontSize: '20px' }}>🏮</div>
                    <div style={{ fontSize: '12px', lineHeight: '1.4', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--electric-mint)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>
                        AI Foreign Ledger translation
                      </span>
                      Detected foreign currency <strong style={{ color: 'var(--accent-gold)' }}>{currency}</strong>. Translated item names to clear English/Malay and auto-synchronized rates (≈ MYR conversion shown below).
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--electric-mint)' }}>ITEMIZED LIST</span>
                </div>
                {items.filter(it => it.price >= 0).map((it, idx) => (
                  <div key={it.id} className="bento-outline" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--charcoal-deep)' }}>
                    <input className="input-field" style={{ flex: 1, height: '38px', background: 'transparent', border: 'none' }} placeholder="Item Name" value={it.name} onChange={(e) => handleItemFieldChange(it.id, 'name', e.target.value)} />
                    <input type="number" step="0.01" className="input-field" style={{ width: '80px', height: '38px', textAlign: 'right', background: 'transparent', border: 'none' }} value={it.price || ''} onChange={(e) => handleItemFieldChange(it.id, 'price', e.target.value)} onKeyDown={(e) => handlePriceKeyDown(e, idx)} />
                    <button type="button" className="btn-icon" style={{ width: '38px', height: '38px' }} onClick={() => handleDeleteItem(it.id)}><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                ))}

                {items.some(it => it.price < 0) && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)' }}>GLOBAL DISCOUNTS & REBATES</span>
                    </div>
                    {items.filter(it => it.price < 0).map((it) => (
                      <div key={it.id} style={{ display: 'flex', gap: '8px', background: 'var(--charcoal-light)', padding: '8px', borderRadius: '12px', border: '1px solid var(--danger)', opacity: 0.9 }}>
                        <input className="input-field" style={{ flex: 1, height: '38px', background: 'transparent', border: 'none', color: 'var(--danger)', fontWeight: 700 }} placeholder="Discount Name" value={it.name} onChange={(e) => handleItemFieldChange(it.id, 'name', e.target.value)} />
                        <input type="number" step="0.01" className="input-field" style={{ width: '80px', height: '38px', textAlign: 'right', background: 'transparent', border: 'none', color: 'var(--danger)', fontWeight: 700 }} value={it.price || ''} onChange={(e) => handleItemFieldChange(it.id, 'price', e.target.value)} />
                        <button type="button" className="btn-icon" style={{ width: '38px', height: '38px' }} onClick={() => handleDeleteItem(it.id)}><Trash2 size={14} color="var(--danger)" /></button>
                      </div>
                    ))}
                  </>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1, borderStyle: 'dashed', height: '42px' }} onClick={() => handleAddItem()}><Plus size={16} /> Add Item</button>
                  <button type="button" className="btn-secondary" style={{ flex: 1, borderStyle: 'dashed', height: '42px', color: 'var(--danger)', borderColor: 'rgba(255, 69, 58, 0.3)' }} onClick={() => {
                    setItems([...items, { id: `it-disc-${Date.now()}`, name: 'Manual Discount', price: -1.00, assignedTo: [] }]);
                  }}><Plus size={16} /> Add Discount</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                 <label className="toggle-switch bento-outline" style={{ flex: 1, padding: '10px', justifyContent: 'center', background: 'var(--charcoal-deep)' }}>
                    <input type="checkbox" checked={taxServiceCharge} onChange={e => setTaxServiceCharge(e.target.checked)} />
                    <span className="toggle-slider" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>10% SC</span>
                 </label>
                 <label className="toggle-switch bento-outline" style={{ flex: 1, padding: '10px', justifyContent: 'center', background: 'var(--charcoal-deep)' }}>
                    <input type="checkbox" checked={taxSst} onChange={e => setTaxSst(e.target.checked)} />
                    <span className="toggle-slider" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>6% SST</span>
                 </label>
              </div>

              {/* Calculation Integrity Check */}
              {receiptTotal !== '' && Math.abs(computedTotal - Number(receiptTotal)) > 0.01 && (
                <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '12px' }}>
                   <span style={{ fontSize: '18px' }}>⚠️</span>
                   <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 700 }}>
                      <strong>Validation Warning:</strong> Calculated total ({currency} {computedTotal.toFixed(2)}) does not match the entered total ({currency} {Number(receiptTotal).toFixed(2)}).
                   </div>
                </div>
              )}

              <div style={{ padding: '16px', background: isMatch ? 'var(--electric-mint-dim)' : 'var(--charcoal-deep)', borderRadius: '16px', border: `1px solid ${isMatch ? 'var(--electric-mint)' : 'var(--charcoal-border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isMatch ? <Check size={16} color="var(--electric-mint)" /> : <AlertCircle size={16} color="var(--text-secondary)" />}
                  <span style={{ fontSize: '13px', fontWeight: 700, color: isMatch ? 'var(--electric-mint)' : 'var(--text-primary)' }}>Calculated Subtotal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>{currency} {computedTotal.toFixed(2)}</span>
                  {currency !== 'MYR' && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                        ≈ MYR {(computedTotal / (rates[currency] || 1)).toFixed(2)}
                      </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', background: 'var(--charcoal-deep)', borderTop: '1px solid var(--charcoal-border)' }}>
              <button type="button" className="btn-primary" disabled={computedTotal < 0} style={{ width: '100%', height: '56px', opacity: computedTotal < 0 ? 0.5 : 1 }} onClick={() => setFlowStep(3)}>
                {computedTotal < 0 ? 'Total Cannot Be Negative' : <>Assign to Members <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} /></>}
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: ASSIGN & SPLIT --- */}
        {flowStep === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                 <h3 className="title-medium">Finalize Split</h3>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Choose how to divvy up the bill</p>
              </div>

              {/* Unassigned Item Warning */}
              {!forceGlobalEqual && items.some(it => it.price > 0 && it.assignedTo.length === 0) && (
                <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '12px' }}>
                   <span style={{ fontSize: '18px' }}>ℹ️</span>
                   <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 700 }}>
                      <strong>Unassigned Items:</strong> Some items have no members selected. They will be shared equally among all participating members.
                   </div>
                </div>
              )}

              <div className="tab-slider-container">
                {['equal', 'percentage', 'custom'].map(t => (
                  <button key={t} type="button" className={`tab-slider-btn ${splitType === t ? 'tab-slider-btn-active' : ''}`} onClick={() => setSplitType(t as any)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {splitType === 'equal' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--charcoal-deep)', borderRadius: '14px', border: '1px solid var(--charcoal-border)' }}>
                     <div>
                       <span style={{ display: 'block', fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>Split Bill Equally?</span>
                       <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ignores assignments & shares total among all</span>
                     </div>
                     <label className="toggle-switch">
                        <input type="checkbox" checked={forceGlobalEqual} onChange={e => setForceGlobalEqual(e.target.checked)} />
                        <span className="toggle-slider" />
                     </label>
                  </div>

                  {!forceGlobalEqual ? (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--electric-mint)' }}>QUICK ASSIGNMENT</span>
                      {items.filter(it => it.price >= 0).map(it => (
                        <div key={it.id} className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{it.name || 'Untitled Item'}</span>
                            <span style={{ fontWeight: 800, color: 'var(--electric-mint)' }}>{it.price.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedGroup?.members.map(m => {
                              const active = it.assignedTo.includes(m.id);
                              return (
                                <button key={m.id} type="button" onClick={() => { setItems(items.map(i => i.id === it.id ? { ...i, assignedTo: active ? i.assignedTo.filter(id => id !== m.id) : [...i.assignedTo, m.id] } : i)); }} style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '100px', background: active ? 'var(--electric-mint-dim)' : 'transparent', border: `1.5px solid ${active ? 'var(--electric-mint)' : 'var(--charcoal-border)'}`, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, transition: 'all 0.2s' }}>{m.name}</button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {items.some(it => it.price < 0) && (
                        <>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)', marginTop: '8px' }}>DISCOUNT TRAY</span>
                          {items.filter(it => it.price < 0).map(it => {
                            const isIndividual = it.assignedTo.length > 0;
                            return (
                              <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255, 69, 58, 0.05)', borderRadius: '14px', border: '1px solid rgba(255, 69, 58, 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--danger)' }}>{it.name || 'Discount'}</span>
                                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--danger)' }}>{it.price.toFixed(2)}</span>
                                  </div>
                                  <button type="button" onClick={() => { setItems(items.map(i => i.id === it.id ? { ...i, assignedTo: isIndividual ? [] : selectedGroup?.members.map(m => m.id) || [] } : i)); }} style={{ padding: '6px 12px', fontSize: '10px', borderRadius: '8px', background: isIndividual ? 'var(--charcoal-deep)' : 'rgba(255, 69, 58, 0.2)', color: isIndividual ? 'var(--text-secondary)' : 'var(--danger)', border: 'none', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {isIndividual ? 'Assign Private 👤' : 'Shared by Geng 👥'}
                                  </button>
                                </div>
                                
                                {isIndividual && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 69, 58, 0.1)' }}>
                                    {selectedGroup?.members.map(m => {
                                      const active = it.assignedTo.includes(m.id);
                                      return (
                                        <button key={m.id} type="button" onClick={() => { setItems(items.map(i => i.id === it.id ? { ...i, assignedTo: active ? i.assignedTo.filter(id => id !== m.id) : [...i.assignedTo, m.id] } : i)); }} style={{ padding: '4px 10px', fontSize: '10px', borderRadius: '100px', background: active ? 'rgba(255, 69, 58, 0.2)' : 'transparent', border: `1px solid ${active ? 'var(--danger)' : 'rgba(255, 69, 58, 0.2)'}`, color: active ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: active ? 700 : 500 }}>{m.name}</button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', background: 'var(--charcoal-deep)', borderRadius: '20px', border: '1px solid var(--charcoal-border)', opacity: 0.8 }}>
                       <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚖️</div>
                       <span style={{ display: 'block', fontWeight: 800, fontSize: '15px' }}>Everyone pays {currency} {(computedTotal / (selectedGroup?.members.length || 1)).toFixed(2)}</span>
                       <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total: {currency} {computedTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : splitType === 'custom' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Tracker & Tax Toggle */}
                  {(() => {
                    const taxMultiplier = 1 + (taxServiceCharge ? 0.1 : 0) + (taxSst ? 0.06 : 0);
                    const rawSum = Object.values(customSplits).reduce((a, b) => a + b, 0);
                    const totalAssigned = customIncludesTax ? rawSum : (rawSum * taxMultiplier);
                    const remaining = computedTotal - totalAssigned;
                    const isMatch = Math.abs(remaining) < 0.01;

                    return (
                      <>
                        <div style={{ background: 'var(--charcoal-deep)', padding: '16px', borderRadius: '16px', border: '1px solid var(--charcoal-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700 }}>Total Assigned</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: isMatch ? 'var(--electric-mint)' : 'var(--danger)' }}>
                                {currency} {totalAssigned.toFixed(2)}
                              </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Prices include Tax/SC?</span>
                              <label className="toggle-switch">
                                <input type="checkbox" checked={customIncludesTax} onChange={e => setCustomIncludesTax(e.target.checked)} />
                                <span className="toggle-slider" />
                              </label>
                          </div>
                        </div>

                        {Math.abs(remaining) > 0.01 && (
                          <div style={{ textAlign: 'center', padding: '8px', background: remaining > 0 ? 'var(--electric-mint-dim)' : 'rgba(255, 69, 58, 0.1)', borderRadius: '100px', fontSize: '12px', fontWeight: 700, color: remaining > 0 ? 'var(--electric-mint)' : 'var(--danger)' }}>
                            {remaining > 0 ? `${currency} ${remaining.toFixed(2)} left to assign` : `Over by ${currency} ${Math.abs(remaining).toFixed(2)}!`}
                          </div>
                        )}

                        {selectedGroup?.members.map(m => {
                          const val = customSplits[m.id] || 0;
                          return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--charcoal-deep)', borderRadius: '14px', border: '1px solid var(--charcoal-border)' }}>
                              <span style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{m.name}</span>
                              <div style={{ position: 'relative', width: '100px' }}>
                                <input type="number" step="0.01" className="input-field" style={{ height: '36px', textAlign: 'right', paddingRight: '12px' }} value={customSplits[m.id] === 0 ? '' : (customSplits[m.id] ?? '')} onChange={(e) => setCustomSplits({ ...customSplits, [m.id]: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                              </div>
                              {remaining > 0 && val === 0 && (
                                <button type="button" onClick={() => {
                                  const fillValue = customIncludesTax ? remaining : (remaining / taxMultiplier);
                                  setCustomSplits({ ...customSplits, [m.id]: Number(fillValue.toFixed(2)) });
                                }} style={{ padding: '8px', borderRadius: '8px', background: 'var(--electric-mint-dim)', color: 'var(--electric-mint)', border: 'none', fontSize: '10px', fontWeight: 800 }}>Fill</button>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   {selectedGroup?.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--charcoal-deep)', borderRadius: '14px' }}>
                      <span style={{ fontWeight: '700' }}>{m.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="number" className="input-field" style={{ width: '80px', height: '36px', textAlign: 'right' }} value={customSplits[m.id] === 0 ? '' : (customSplits[m.id] ?? '')} onChange={(e) => setCustomSplits({ ...customSplits, [m.id]: parseFloat(e.target.value) || 0 })} />
                        <span style={{ fontSize: '12px', fontWeight: 800 }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>PAID BY</span>
                  <button 
                    type="button"
                    onClick={runRoulette}
                    style={{ 
                      background: 'var(--accent-pink-dim)', 
                      color: 'var(--accent-pink)', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '4px 8px', 
                      fontSize: '10px', 
                      fontWeight: 800, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px' 
                    }}
                  >
                    <Dices size={12} /> ROULETTE
                  </button>
                </div>
                <select className="input-field" value={paidByMemberId} onChange={(e) => setPaidByMemberId(e.target.value)}>
                   {selectedGroup?.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ padding: '20px 20px 40px 20px', background: 'var(--charcoal-deep)', borderTop: '1px solid var(--charcoal-border)' }}>
              {(() => {
                const taxMultiplier = 1 + (taxServiceCharge ? 0.1 : 0) + (taxSst ? 0.06 : 0);
                const rawSum = Object.values(customSplits).reduce((a, b) => a + b, 0);
                const totalAssigned = splitType === 'custom' ? (customIncludesTax ? rawSum : (rawSum * taxMultiplier)) : 0;
                const totalPct = splitType === 'percentage' ? Object.values(customSplits).reduce((a, b) => a + b, 0) : 0;
                
                const isPctValid = splitType === 'percentage' ? Math.abs(totalPct - 100) < 0.1 : true;
                const isCustomValid = splitType === 'custom' ? Math.abs(totalAssigned - computedTotal) < 0.05 : true;
                const isValid = isPctValid && isCustomValid;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!isValid && (
                      <div className="bento-outline" style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertCircle size={18} color="var(--danger)" />
                        <span style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 700 }}>
                          {splitType === 'percentage' 
                            ? `Split must equal 100% (Current: ${totalPct.toFixed(1)}%)`
                            : `Total must match ${currency} ${computedTotal.toFixed(2)} (Current: ${totalAssigned.toFixed(2)})`}
                        </span>
                      </div>
                    )}
                    
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={!isValid}
                      style={{ 
                        width: '100%', 
                        height: '60px', 
                        borderRadius: '20px', 
                        fontSize: '18px',
                        opacity: isValid ? 1 : 0.6
                      }}
                    >
                      <Check size={24} style={{ marginRight: '8px' }} /> 
                      Confirm & Settle Up!
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </form>
      {/* Wheel of Unfortunate Modal */}
      {isRouletting && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎡</div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '4px' }}>WHEEL OF UNFORTUNATE</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '40px' }}>The gods are deciding your fate...</p>
              
              <div style={{ 
                height: '100px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0 40px',
                minWidth: '280px',
                boxShadow: rouletteWinner ? '0 0 40px rgba(0, 255, 153, 0.2)' : 'none'
              }}>
                 <div style={{ 
                   fontSize: '32px', 
                   fontWeight: '900', 
                   color: rouletteWinner === selectedGroup?.members.find(m => m.id === paidByMemberId)?.name ? 'var(--electric-mint)' : 'white',
                   transition: 'all 0.1s ease',
                   transform: 'scale(1.1)'
                 }}>
                    {rouletteWinner || '...'}
                 </div>
              </div>

              {!rouletteWinner && <div style={{ marginTop: '20px', color: 'var(--accent-pink)', fontWeight: 800 }}>SPINNING...</div>}
           </div>
        </div>
      )}

      {/* AI Warning Modal */}
      {showAiWarning && (
        <div style={{ 
          position: 'absolute', 
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
            border: '2px solid var(--charcoal-border)',
            borderRadius: '28px',
            padding: '28px 24px', 
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 30px var(--electric-mint-glow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              background: 'rgba(245, 158, 11, 0.1)', 
              border: '1px solid var(--warning)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto',
              color: 'var(--warning)',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
            }}>
              <AlertCircle size={32} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Double-Check AI Work! 🧾
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
                AI can make mistakes parsing receipts, especially with small fonts, blurred text, or custom discounts. 
              </p>
              <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: '700', lineHeight: '1.5' }}>
                Please review the items, tax rates, and totals carefully before proceeding to assign them!
              </p>
            </div>

            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => setShowAiWarning(false)}
              style={{ 
                height: '50px', 
                borderRadius: '14px', 
                fontWeight: '800', 
                fontSize: '15px',
                marginTop: '8px',
                boxShadow: '0 8px 20px rgba(0, 255, 153, 0.2)'
              }}
            >
              Jom, Review! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );

};

export default OcrTab;
