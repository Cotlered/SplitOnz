import { getSettings } from './storage';

export const GENG_QUOTES = [
  "RM10 is also money, okay? Don't leave your balance behind! 💸",
  "Roulette spinner does not lie. It is the ultimate law of the Geng! 🎰",
  "Jom Mamak! Who pays first is the boss! ☕",
  "A real geng member always settles their dues before the flight lands! ✈️",
  "Duit is temporary, but travel memories with the Geng are forever! ❤️",
  "Settle up now, next trip we ONZ again! 🚀",
  "Don't let RM0.50 ruin a 10-year friendship. Settle up! 🤝",
  "Exchange rates deviate, but our friendship remains fixed at 1:1! 📈",
  "Scan receipt properly, don't let the scanner trigger warnings! 🤖",
  "Wallet empty? Time to spin the roulette and pray! 🙏",
  "Split equally, eat peacefully. That is the way. 🍲",
  "No money? Do bank transfer / DuitNow instantly! 📱",
  "Trip HQ says you owe money. Don't pretend to sleep! 😴",
  "Travel packing list: Passport, cash, and SplitOnz loaded! 🧳",
];

export const STANDARD_QUOTES = [
  "Precision in debt settlement builds lasting travel relationships.",
  "Count the memories, not just the cents.",
  "A budget is telling your money where to go instead of wondering where it went.",
  "Travel is the only thing you buy that makes you richer.",
  "Fair splitting ensures smooth future journeys.",
  "Financial transparency is the cornerstone of every great trip.",
  "Collect moments, settle ledger balances properly.",
  "Good friends split the bills, best friends settle them on time.",
  "Plan your travel daily budget to keep financial stresses away.",
  "Clear accounts, long friendships.",
  "A penny saved is a penny earned—even while abroad.",
  "Adventure awaits, but do not forget to settle your debts first.",
];

export const getRandomQuote = (): string => {
  const isGeng = getSettings().languageTone === 'geng';
  const list = isGeng ? GENG_QUOTES : STANDARD_QUOTES;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
};
