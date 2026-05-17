export interface Member {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  status: 'Onz!' | 'Pending...';
  createdAt: string;
  dailyBudget?: number;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Member IDs
}

export interface Receipt {
  id: string;
  groupId: string;
  title: string;
  imageUrl?: string;
  items: ReceiptItem[];
  taxServiceCharge: boolean; // +10%
  taxSst: boolean; // +6%
  flatTax?: number; // Fixed tax amount (e.g. 5.50)
  roundingAdjustment?: number; // Cents adjustment (e.g. 0.01, -0.02)
  currency: string;
  totalEntered: number;
  paidBy: string; // Member ID who paid
  splitType: 'equal' | 'percentage' | 'custom';
  forceGlobalEqual?: boolean;
  customIncludesTax?: boolean;
  customSplits?: Record<string, number>; // memberId -> custom value
  settledId?: string; // Link to a settlement
  createdAt: string;
}

export interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  date: string;
  totalMYR: number;
  receiptIds: string[];
  transactions: any[];
}

const STORAGE_KEYS = {
  GROUPS: 'onz_groups',
  RECEIPTS: 'onz_receipts',
  RECENT_MEMBERS: 'onz_recent_members',
  RATES: 'onz_rates',
  GEMINI_KEY: 'onz_gemini_key',
  SETTLEMENTS: 'onz_settlements',
  SETTINGS: 'onz_settings',
};

export interface AppSettings {
  userName: string;
  roundingMode: 'mamak' | 'precise';
  theme: 'dark' | 'light';
  baseCurrency: string;
  hideSettledGroups: boolean;
  languageTone: 'geng' | 'standard';
  soundEffectsEnabled?: boolean;
  accentColor?: 'mint' | 'pink' | 'gold' | 'blue' | 'purple';
  useStreetRates?: boolean;
  customRatesInput?: Record<string, string>;
}

const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  roundingMode: 'mamak',
  theme: 'dark',
  baseCurrency: 'MYR',
  hideSettledGroups: false,
  languageTone: 'geng',
  soundEffectsEnabled: true,
  accentColor: 'mint',
  useStreetRates: false,
  customRatesInput: {},
};

// Seed mock data for a jaw-dropping out-of-the-box experience
const MOCK_MEMBERS = {
  mamak: [
    { id: 'm1', name: 'Ali' },
    { id: 'm2', name: 'Raju' },
    { id: 'm3', name: 'Chong' },
    { id: 'm4', name: 'Sarah' },
  ],
  genting: [
    { id: 'g1', name: 'Ben' },
    { id: 'g2', name: 'Chloe' },
    { id: 'g3', name: 'Dan' },
    { id: 'g4', name: 'Emma' },
  ],
};

const MOCK_GROUPS: Group[] = [
  {
    id: 'g-mamak',
    name: 'Mamak Crew ☕',
    members: MOCK_MEMBERS.mamak,
    status: 'Pending...',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
  },
  {
    id: 'g-genting',
    name: 'Genting Trip ⛰️',
    members: MOCK_MEMBERS.genting,
    status: 'Onz!',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
  },
];

const MOCK_RECEIPTS: Receipt[] = [];

const MOCK_RECENT_MEMBERS = ['Ali', 'Raju', 'Chong', 'Sarah', 'Ben', 'Chloe', 'Dan', 'Emma', 'Fiza', 'Guan'];

export const initializeStorage = () => {
  const isCleared = localStorage.getItem('onz_cleared') === 'true';

  if (!localStorage.getItem(STORAGE_KEYS.GROUPS)) {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(isCleared ? [] : MOCK_GROUPS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECEIPTS)) {
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(isCleared ? [] : MOCK_RECEIPTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECENT_MEMBERS)) {
    localStorage.setItem(STORAGE_KEYS.RECENT_MEMBERS, JSON.stringify(isCleared ? [] : MOCK_RECENT_MEMBERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RATES)) {
    const defaultRates = {
      MYR: 1.0,
      SGD: 0.31,
      THB: 7.75, // 1 MYR = 7.75 THB (1 THB = 0.13 MYR)
      USD: 0.21,
      EUR: 0.20,
      JPY: 33.20,
      IDR: 3350.00,
      VND: 5380.00,
      PHP: 12.10,
      CNY: 1.54,
      KRW: 288.00,
      GBP: 0.17
    };
    localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify({ rates: defaultRates, timestamp: Date.now() }));
  }
};

export const getGroups = (): Group[] => {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
  return data ? JSON.parse(data) : [];
};

export const saveGroups = (groups: Group[]) => {
  localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  
  // Track unique member names to feed the recent members cache
  const allNames = new Set<string>();
  groups.forEach(g => g.members.forEach(m => allNames.add(m.name)));
  const existingRecent = getRecentMembers();
  const merged = Array.from(new Set([...Array.from(allNames), ...existingRecent])).slice(0, 20);
  saveRecentMembers(merged);
};

export const getReceipts = (): Receipt[] => {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
  return data ? JSON.parse(data) : [];
};

export const saveReceipts = (receipts: Receipt[]) => {
  localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
};

export const getSettlements = (): Settlement[] => {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);
  return data ? JSON.parse(data) : [];
};

export const saveSettlements = (settlements: Settlement[]) => {
  localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
};

export const getRecentMembers = (): string[] => {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.RECENT_MEMBERS);
  return data ? JSON.parse(data) : [];
};

export const saveRecentMembers = (members: string[]) => {
  localStorage.setItem(STORAGE_KEYS.RECENT_MEMBERS, JSON.stringify(members));
};

export const getCachedRates = (): CachedRates | null => {
  const data = localStorage.getItem(STORAGE_KEYS.RATES);
  if (!data) return null;
  const parsed = JSON.parse(data) as CachedRates;

  // Merge street rates if enabled
  const settings = getSettings();
  if (settings.useStreetRates && settings.customRatesInput) {
    const mergedRates = { ...parsed.rates };
    const customRates = settings.customRatesInput;
    Object.keys(customRates).forEach(curr => {
      const val = parseFloat(customRates[curr]);
      if (!isNaN(val) && val > 0) {
        mergedRates[curr] = val;
      }
    });
    return {
      rates: mergedRates,
      timestamp: parsed.timestamp
    };
  }

  // Return stale cached rates as a safe offline fallback instead of returning null and breaking conversions.
  return parsed;
};

export const saveCachedRates = (rates: CachedRates['rates']): void => {
  localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify({ rates, timestamp: Date.now() }));
};

export const getGeminiKey = (): string => {
  const key = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  // Support local development .env or Vercel production environment variables
  return key || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
};

export const saveGeminiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, key);
};

export const getSettings = (): AppSettings => {
  initializeStorage();
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const clearAllData = () => {
  localStorage.clear();
  localStorage.setItem('onz_cleared', 'true');
  initializeStorage();
};
