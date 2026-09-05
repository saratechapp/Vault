// Curated currency / country / language / timezone metadata used across
// Preferences, the New-transaction modal and formatCurrency()/formatDate().
import { scopedKey } from './userScope.js';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', locale: 'en-PK' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'si-LK' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', locale: 'ne-NP' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', locale: 'he-IL' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', locale: 'ar-EG' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', locale: 'en-GH' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', locale: 'es-AR' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso', locale: 'es-CL' },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso', locale: 'es-CO' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', locale: 'es-PE' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', locale: 'ar-QA' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', locale: 'ar-BH' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', locale: 'ar-OM' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', locale: 'ro-RO' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', locale: 'uk-UA' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', locale: 'zh-TW' },
];

export const COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London' },
  { code: 'IN', name: 'India', currency: 'INR', timezone: 'Asia/Kolkata' },
  { code: 'DE', name: 'Germany', currency: 'EUR', timezone: 'Europe/Berlin' },
  { code: 'FR', name: 'France', currency: 'EUR', timezone: 'Europe/Paris' },
  { code: 'JP', name: 'Japan', currency: 'JPY', timezone: 'Asia/Tokyo' },
  { code: 'CN', name: 'China', currency: 'CNY', timezone: 'Asia/Shanghai' },
  { code: 'AU', name: 'Australia', currency: 'AUD', timezone: 'Australia/Sydney' },
  { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', timezone: 'Europe/Zurich' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', timezone: 'Asia/Singapore' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timezone: 'Asia/Dubai' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', timezone: 'Asia/Riyadh' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', timezone: 'Asia/Hong_Kong' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', timezone: 'Pacific/Auckland' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', timezone: 'Africa/Johannesburg' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', timezone: 'America/Sao_Paulo' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', timezone: 'America/Mexico_City' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', timezone: 'Asia/Seoul' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', timezone: 'Asia/Jakarta' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' },
  { code: 'TH', name: 'Thailand', currency: 'THB', timezone: 'Asia/Bangkok' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', timezone: 'Asia/Manila' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', timezone: 'Asia/Karachi' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', timezone: 'Asia/Dhaka' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', timezone: 'Asia/Colombo' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', timezone: 'Asia/Kathmandu' },
  { code: 'RU', name: 'Russia', currency: 'RUB', timezone: 'Europe/Moscow' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', timezone: 'Europe/Istanbul' },
  { code: 'PL', name: 'Poland', currency: 'PLN', timezone: 'Europe/Warsaw' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', timezone: 'Europe/Stockholm' },
  { code: 'NO', name: 'Norway', currency: 'NOK', timezone: 'Europe/Oslo' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', timezone: 'Europe/Copenhagen' },
  { code: 'IL', name: 'Israel', currency: 'ILS', timezone: 'Asia/Jerusalem' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', timezone: 'Africa/Cairo' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', timezone: 'Africa/Lagos' },
  { code: 'KE', name: 'Kenya', currency: 'KES', timezone: 'Africa/Nairobi' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', timezone: 'Africa/Accra' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
  { code: 'CL', name: 'Chile', currency: 'CLP', timezone: 'America/Santiago' },
  { code: 'CO', name: 'Colombia', currency: 'COP', timezone: 'America/Bogota' },
  { code: 'PE', name: 'Peru', currency: 'PEN', timezone: 'America/Lima' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', timezone: 'Asia/Qatar' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', timezone: 'Asia/Kuwait' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', timezone: 'Asia/Bahrain' },
  { code: 'OM', name: 'Oman', currency: 'OMR', timezone: 'Asia/Muscat' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', timezone: 'Europe/Prague' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', timezone: 'Europe/Budapest' },
  { code: 'RO', name: 'Romania', currency: 'RON', timezone: 'Europe/Bucharest' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', timezone: 'Europe/Kyiv' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', timezone: 'Asia/Taipei' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', timezone: 'Europe/Dublin' },
  { code: 'IT', name: 'Italy', currency: 'EUR', timezone: 'Europe/Rome' },
  { code: 'ES', name: 'Spain', currency: 'EUR', timezone: 'Europe/Madrid' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', timezone: 'Europe/Lisbon' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', timezone: 'Europe/Amsterdam' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', timezone: 'Europe/Brussels' },
  { code: 'AT', name: 'Austria', currency: 'EUR', timezone: 'Europe/Vienna' },
  { code: 'FI', name: 'Finland', currency: 'EUR', timezone: 'Europe/Helsinki' },
  { code: 'GR', name: 'Greece', currency: 'EUR', timezone: 'Europe/Athens' },
];

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
];

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', sample: '05/07/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', sample: '07/05/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', sample: '2026-07-05' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY', sample: '05 Jul 2026' },
];

export const DEFAULT_PREFS = {
  country: 'IN',
  currency: 'INR',
  currencies: [],
  language: 'en',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Asia/Kolkata',
  compactTables: false,
  weeklyDigest: true,
  autoLogoutEnabled: true,
  autoLogoutIdleMinutes: 15,
  showAccountBudgetBreakdown: true,
};

const PREFS_KEY = 'wallet_prefs_v1';

// Region from the browser's own locale tag (e.g. "en-IN" -> "IN") — no
// network call, no permission prompt, works instantly. Intl.Locale handles
// tags that omit the region (e.g. bare "en") by resolving it via maximize();
// a plain regex on the tag is the fallback for engines without Intl.Locale.
function regionFromLocale() {
  try {
    const tag = (navigator.languages && navigator.languages[0]) || navigator.language;
    if (!tag) return null;
    if (typeof Intl.Locale === 'function') {
      const loc = new Intl.Locale(tag);
      const region = loc.region || loc.maximize().region;
      if (region) return region.toUpperCase();
    }
    const match = tag.match(/-([A-Za-z]{2})$/);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

// Best-effort country/currency/timezone guess for a brand-new browser with
// no saved preferences yet. Locale region is tried first (most direct
// signal); IANA timezone is the fallback for a locale tag with no region
// (e.g. bare "en"). Returns null rather than guessing wrong when neither
// signal matches an entry in COUNTRIES.
function detectLocalePrefs() {
  try {
    const region = regionFromLocale();
    let country = region ? COUNTRIES.find((c) => c.code === region) : null;

    if (!country) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      country = COUNTRIES.find((c) => c.timezone === tz) || null;
    }

    if (!country) return null;
    return { country: country.code, currency: country.currency, timezone: country.timezone };
  } catch {
    return null;
  }
}

export function readPrefs() {
  try {
    const raw = localStorage.getItem(scopedKey(PREFS_KEY));
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };

    // First-ever load for this user (browser or account): auto-detect from
    // locale/timezone and persist it immediately so it becomes the user's
    // own explicit, freely-editable preference from here on — Settings >
    // Location & currency already lets them override country/currency/
    // timezone independently at any time, and this detection never runs
    // again once a preferences record exists for this user.
    const detected = detectLocalePrefs();
    const initial = detected ? { ...DEFAULT_PREFS, ...detected } : { ...DEFAULT_PREFS };
    writePrefs(initial);
    return initial;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(next) {
  localStorage.setItem(scopedKey(PREFS_KEY), JSON.stringify(next));
}

export function getCurrencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES.find((c) => c.code === 'USD');
}

// Canonical money formatter — reads the current (auto-detected or
// user-chosen) currency from prefs so every amount in the app, including the
// public marketing pages, renders in the visitor's own currency rather than
// a hardcoded one. Re-exported from api.js for existing call sites.
export function formatCurrency(n, symbol) {
  const prefs = readPrefs();
  const meta = getCurrencyMeta(prefs.currency);
  const sym = symbol || meta.symbol;
  const val = Math.abs(Number(n) || 0);
  return `${n < 0 ? '-' : ''}${sym}${val.toLocaleString(meta.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
