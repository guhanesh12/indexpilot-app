import { Storage } from './storage';

// Supabase project (from the website's .env)
export const SUPABASE_PROJECT_ID = 'oklgqelcaujxntgjyuis';
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

// Custom edge-function domain (mobile-network safe)
export const BASE_URL = 'https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T = any>(method: Method, path: string, body?: any): Promise<T> {
  const token = await Storage.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Edge function expects Bearer auth — user token if logged in, else anon key
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

// Supabase native auth — login/refresh go directly to supabase.co
async function supabaseAuth(pathWithQuery: string, body: any) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathWithQuery}`, {
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
  // ─── AUTH ──────────────────────────────────────────
  loginWithPassword: async (email: string, password: string) => {
    const res = await supabaseAuth('/token?grant_type=password', { email, password });
    return res; // { access_token, refresh_token, user }
  },
  refreshSession: async (refresh_token: string) => {
    return supabaseAuth('/token?grant_type=refresh_token', { refresh_token });
  },
  forgotPassword: (email: string) => request('POST', '/auth/forgot-password', { email }),
  resetPassword: (email: string, newPassword: string) =>
    request('POST', '/auth/reset-password', { email, newPassword }),
  checkEmail: (email: string) => request('POST', '/auth/check-email', { email }),
  sendOtp: (phone: string) => request('POST', '/send-otp', { phone }),
  verifyOtp: (p: {
    phone: string;
    otp: string;
    email: string;
    password: string;
    name: string;
    state?: string;
    city?: string;
  }) => request('POST', '/verify-otp', p),

  // ─── SYMBOLS ───────────────────────────────────────
  getSymbols: () => request('POST', '/symbols/get', {}),
  saveSymbol: (symbol: any) => request('POST', '/symbols/save', symbol),
  searchInstruments: (query: string, segment: string = 'NSE_FNO') =>
    request('POST', '/search-option', { query, segment }),

  // ─── ORDERS & TRADING ──────────────────────────────
  executeOrder: (p: any) => request('POST', '/execute-dhan-order', p),
  placeOrder: (p: any) => request('POST', '/place-order', p),
  executeTrade: (p: any) => request('POST', '/execute-trade', p),
  exitPosition: (p: any) => request('POST', '/exit-position', p),
  syncManualTrades: () => request('POST', '/sync-manual-trades', {}),

  // ─── POSITIONS ─────────────────────────────────────
  getLivePositions: () => request('POST', '/live-positions', {}),
  getPositions: () => request('POST', '/positions', {}),

  // ─── JOURNAL ───────────────────────────────────────
  getJournal: (p?: { startDate?: string; endDate?: string; limit?: number }) =>
    request('POST', '/get-journal-entries', p || { limit: 100 }),
  addJournal: (p: any) => request('POST', '/add-journal-entry', p),
  clearJournal: () => request('POST', '/clear-journal-data', {}),

  // ─── STRATEGY / AI ─────────────────────────────────
  getAISignal: (p: { index: string; interval: string; accountBalance?: number }) =>
    request('POST', '/advanced-ai-signal', p),
  monitorPosition: (p: any) => request('POST', '/monitor-position', p),
  aiAnalysis: (p: any) => request('POST', '/ai-analysis', p),
  getUserStrategies: () => request('POST', '/user/custom-strategies', {}),

  // ─── SUPPORT ───────────────────────────────────────
  createTicket: (p: {
    subject: string;
    message: string;
    category?: string;
    priority?: string;
  }) => request('POST', '/support/create', p),
  getTickets: () => request('POST', '/support/tickets', {}),

  // ─── LOGS ──────────────────────────────────────────
  getLogs: () => request('POST', '/logs', { action: 'list' }),
  addLog: (p: any) => request('POST', '/logs', { action: 'add', ...p }),
  clearLogs: () => request('POST', '/logs', { action: 'clear' }),

  // ─── BROKER ────────────────────────────────────────
  getApiCredentials: () => request('POST', '/api-credentials', { action: 'get' }),
  saveApiCredentials: (dhanClientId: string, dhanAccessToken: string) =>
    request('POST', '/api-credentials', {
      action: 'save',
      dhanClientId,
      dhanAccessToken,
    }),
  testConnection: () => request('POST', '/check-vps-connectivity', {}),
  getFundLimits: () => request('POST', '/fund-limits', {}),

  // ─── WALLET ────────────────────────────────────────
  getWalletBalance: () => request('POST', '/wallet/balance', {}),
  getWalletTransactions: () => request('POST', '/wallet/transactions', {}),
  getWalletDailyStats: () => request('POST', '/wallet/daily-stats', {}),
  initWallet: () => request('POST', '/wallet/initialize', {}),
  createRecharge: (amount: number) => request('POST', '/wallet/create-recharge-order', { amount }),
  verifyRecharge: (p: any) => request('POST', '/wallet/verify-payment', p),

  // ─── STATIC IP POOL ────────────────────────────────
  getMyIP: () => request('POST', '/ip-pool/my-ip', {}),
  createIPOrder: () => request('POST', '/ip-pool/create-payment-order', {}),
  cancelIP: () => request('POST', '/ip-pool/cancel', {}),
  getIPStatus: () => request('POST', '/ip-pool/provisioning-status', {}),

  // ─── ENGINE ────────────────────────────────────────
  startEngine: () => request('POST', '/engine/start', {}),
  stopEngine: () => request('POST', '/engine/stop', {}),
  getEngineState: () => request('POST', '/engine/state', {}),
  getEngineDbStatus: () => request('POST', '/engine/db-status', {}),

  // ─── MARKET ────────────────────────────────────────
  getMarketQuote: (p: any) => request('POST', '/market-quote', p),
  getOhlc: (p: any) => request('POST', '/ohlc-data', p),

  // ─── HEALTH ────────────────────────────────────────
  health: () => request('POST', '/health', {}),
};
