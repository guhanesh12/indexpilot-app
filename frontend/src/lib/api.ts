import { Storage } from './storage';

export const SUPABASE_PROJECT_ID = 'oklgqelcaujxntgjyuis';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

const PROXY_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
const EDGE = `${PROXY_BASE}/api/edge`;
const SB = `${PROXY_BASE}/api/sb`;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T = any>(method: Method, path: string, body?: any): Promise<T> {
  const token = await Storage.getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${EDGE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

async function sbAuth(pathWithQuery: string, body: any) {
  const res = await fetch(`${SB}/auth/v1${pathWithQuery}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error_description || data?.msg || data?.error || `Auth failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // ─── AUTH ──────────────────────────────────────
  loginWithPassword: (email: string, password: string) =>
    sbAuth('/token?grant_type=password', { email, password }),
  refreshSession: (refresh_token: string) =>
    sbAuth('/token?grant_type=refresh_token', { refresh_token }),
  forgotPassword: (email: string) => request('POST', '/auth/forgot-password', { email }),
  checkEmail: (email: string) => request('POST', '/auth/check-email', { email }),
  sendOtp: (phone: string) => request('POST', '/send-otp', { phone }),
  verifyOtp: (p: any) => request('POST', '/verify-otp', p),

  // ─── SYMBOLS ───────────────────────────────────
  getSymbols: () => request('GET', '/symbols/get'),
  saveSymbols: (symbols: any[]) => request('POST', '/symbols/save', { symbols }),
  saveSymbol: (symbol: any) => request('POST', '/symbols/save', { symbols: [symbol] }),
  deleteSymbol: (id: string) => request('POST', '/symbols/save', { action: 'delete', id }),
  searchInstruments: (query: string, segment: string = 'NSE_FNO') =>
    request('POST', '/search-option', { query, segment }),
  // Mobile-friendly: server-side parsed Dhan CSV
  fetchDhanInstruments: async (force = false) => {
    const url = `${PROXY_BASE}/api/instruments/dhan-options${force ? '?force=true' : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  // ─── ORDERS / TRADING ──────────────────────────
  executeOrder: (p: any) => request('POST', '/execute-dhan-order', p),
  placeOrder: (p: any) => request('POST', '/place-order', p),
  executeTrade: (p: any) => request('POST', '/execute-trade', p),
  exitPosition: (p: any) => request('POST', '/exit-position', p),

  // ─── POSITIONS ─────────────────────────────────
  getLivePositions: () => request('GET', '/live-positions'),
  getPositions: () => request('GET', '/positions'),

  // ─── JOURNAL ───────────────────────────────────
  getJournal: (p?: any) => request('POST', '/get-journal-entries', p || { limit: 100 }),
  addJournal: (p: any) => request('POST', '/add-journal-entry', p),
  clearJournal: () => request('POST', '/clear-journal-data', {}),

  // ─── STRATEGY / AI ─────────────────────────────
  getAISignal: (p: { index: string; interval: string; accountBalance?: number }) =>
    request('POST', '/advanced-ai-signal', p),
  monitorPosition: (p: any) => request('POST', '/monitor-position', p),
  aiAnalysis: (p: any) => request('POST', '/ai-analysis', p),

  // ─── SUPPORT ───────────────────────────────────
  createTicket: (p: any) => request('POST', '/support/create', p),
  getTickets: () => request('GET', '/support/tickets'),

  // ─── LOGS ──────────────────────────────────────
  getLogs: () => request('GET', '/logs'),
  addLog: (p: any) => request('POST', '/logs', p),
  clearLogs: () => request('DELETE', '/logs'),

  // ─── BROKER ────────────────────────────────────
  getApiCredentials: () => request('GET', '/api-credentials'),
  saveApiCredentials: (dhanClientId: string, dhanAccessToken: string) =>
    request('POST', '/api-credentials', { dhanClientId, dhanAccessToken }),
  testApiConnection: () => request('POST', '/test-api-connection', {}),
  testConnection: () => request('POST', '/check-vps-connectivity', {}),
  getFundLimits: () => request('GET', '/fund-limits'),

  // ─── WALLET ────────────────────────────────────
  getWalletBalance: () => request('GET', '/wallet/balance'),
  getWalletTransactions: () => request('GET', '/wallet/transactions'),
  getWalletDailyStats: () => request('GET', '/wallet/daily-stats'),
  initWallet: () => request('POST', '/wallet/initialize', {}),
  createRecharge: (amount: number) => request('POST', '/wallet/create-recharge-order', { amount }),
  verifyRecharge: (p: any) => request('POST', '/wallet/verify-payment', p),

  // ─── STATIC IP ─────────────────────────────────
  getMyIP: () => request('POST', '/ip-pool/my-ip', {}),
  createIPOrder: () => request('POST', '/ip-pool/create-payment-order', {}),
  cancelIP: () => request('POST', '/ip-pool/cancel', {}),
  getIPStatus: () => request('POST', '/ip-pool/provisioning-status', {}),

  // ─── ENGINE ────────────────────────────────────
  startEngine: (interval: string, symbols: any[] = []) =>
    request('POST', '/engine/start', { candleInterval: interval, symbols }),
  stopEngine: () => request('POST', '/engine/stop', {}),
  getEngineState: () => request('POST', '/engine/state', {}),
  getEngineStatus: () => request('GET', '/engine/status'),
  getEngineDbStatus: () => request('GET', '/engine/db-status'),

  // ─── MARKET ────────────────────────────────────
  getMarketQuote: (p: any) => request('POST', '/market-quote', p),
  getOhlc: (p: any) => request('POST', '/ohlc-data', p),
};
