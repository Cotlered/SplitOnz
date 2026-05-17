# ⚡ SplitOnz — Bagi Settle, Hati Onz! ✈️

**SplitOnz** is a premium, state-of-the-art client-side web application designed to take the friction out of group travel finance. Powered by React, Vite, and Google Gemini AI, it combines high-end glassmorphic aesthetics with a hilarious, localized Malaysian traveler vibe. 

No more awkward spreadsheet calculations or manual inputting after midnight Mamak sessions. Settle up fast, keep your friendship 1:1, and plan your next trip!

---

## 🌟 Key Features

### 🤖 1. Multimodal Gemini AI OCR Scanner
*   **Snap & Parse:** Upload any receipt image and let **Gemini 2.5 Flash** (with automatic fallbacks) extract items, taxes, surcharges, and subtotal rounding.
*   **AI Foreign Translation:** Automatically translates foreign language items (e.g. Thai, Japanese, Chinese Kanji) to clear English/Malay so your Geng knows exactly what they are splitting.
*   **Foreign Currency Conversion:** Detects foreign currencies (`THB`, `JPY`, `USD`, etc.) and calculates real-time MYR equivalents.

### ⚖️ 2. "Onz!" Greedy Debt-Minimization Engine
*   **Simplified Settlements:** Aggregates group receipts and runs a greedy minimization algorithm. It simplifies multi-lateral debts into the **absolute minimum number of bank transfers** ($N-1$ direct transfers)!
*   **Mamak Rounding:** Toggle Mamak cash-rounding (nearest 5 cents) for physical cash settlements!
*   **4 Split Modes:** Equal Split, Percentage Split, Custom Split, and full Itemized Checklist Split.

### 🔊 3. Native Web Audio Synth Sound FX
*   Features a custom oscillator-based synthesizer built entirely on the native browser **Web Audio API** (zero heavy audio assets to download!).
*   Arcade-style chimes for successful AI scans, roulette ticks, settlement confirmations, and winning announcements.

### 🎨 4. Bento-Style Accent Color Packs
*   Instantly repaint the entire neon dark-mode style sheets in real time! Choose from **Mint (Default)**, **Pink**, **Gold**, **Blue**, or **Purple** accent color packs.
*   Toggle between **Geng Tone** (Malaysian slangs) and **Standard Tone** to rewrite the interface instantly.

### 📊 5. Geng HQ (Trip Command Center)
*   **Daily Budget Tracker:** Set daily allowances and monitor expenses via a glowing visual progress bar that turns warning-red if you exceed budget limit.
*   **HD Infographic Share Card:** Sanitizes buttons and exports a sleek HD PNG report directly to WhatsApp, Telegram, or Instagram!

### 🎰 6. Payer Roulette Wheel
*   Can't decide who pays? Open the interactive spinning roulette wheel to pick a random member with nostalgic arcade sound ticks!

---

## 🛠️ Technology Stack

*   **Core:** React 19 (TypeScript) + Vite
*   **Styling:** Vanilla HSL CSS variables + Glassmorphism architecture
*   **Animations:** Framer Motion
*   **Audio Synthesis:** Web Audio API (native Oscillator nodes)
*   **Database:** `localStorage` (100% offline-ready, 0% hosting costs!)
*   **Screenshot Engine:** Modern-screenshot API

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm

### Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## 🛡️ License
Distributed under the MIT License.

---

## ☕ Support the Geng
Settle your dues, scan your receipts, and have an amazing trip! *Bagi settle, hati ONZ!* 🚀
