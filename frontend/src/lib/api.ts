import { Storage } from './storage';

export const BASE_URL = 'https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T = any>(
  method: Method,
  path: string,
  body?: any,
  auth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await Storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
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
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  // Auth
  signup: (p: { email: string; password: string; name: string; phone?: string }) =>
    request('POST', '/auth/signup', p, false),
  sendOtp: (email: string) => request('POST', '/auth/send-otp', { email }, false),
  verifyOtp: (email: string, otp: string) =>
    request('POST', '/auth/verify-otp', { email, otp }, false),
  login: (email: string, password: string) =>
    request('POST', '/auth/login', { email, password }, false),
  forgotPassword: (email: string) =>
    request('POST', '/auth/forgot-password', { email }, false),

  // Symbols
  getSymbols: () => request('GET', '/symbols'),
  addSymbol: (p: any) => request('POST', '/symbols', p),
  deleteSymbol: (id: string) => request('DELETE', `/symbols/${id}`),
  searchInstruments: (query: string, segment = 'NSE_FNO') =>
    request('POST', '/search-dhan-instruments', { query, segment }),

  // Orders
  executeOrder: (p: any) => request('POST', '/execute-dhan-order', p),
  getOrderHistory: () => request('GET', '/order-history'),

  // Journal
  getJournal: (p?: { startDate?: string; endDate?: string; limit?: number }) =>
    request('POST', '/get-journal-entries', p || { limit: 100 }),
  addJournal: (p: any) => request('POST', '/add-journal-entry', p),

  // Strategy
  getAISignal: (p: { index: string; interval: string; accountBalance?: number }) =>
    request('POST', '/advanced-ai-signal', p),
  monitorPosition: (p: any) => request('POST', '/monitor-position', p),

  // Support
  createTicket: (p: { subject: string; message: string; category: string; priority: string }) =>
    request('POST', '/support/create-ticket', p),
  getTickets: () => request('GET', '/support/tickets'),
  replyTicket: (ticketId: string, message: string) =>
    request('POST', '/support/reply', { ticketId, message }),

  // Logs
  getLogs: () => request('GET', '/logs'),
  addLog: (p: any) => request('POST', '/logs', p),
  clearLogs: () => request('DELETE', '/logs'),

  // Broker
  getApiCredentials: () => request('GET', '/api-credentials'),
  saveApiCredentials: (dhanClientId: string, dhanAccessToken: string) =>
    request('POST', '/api-credentials', { dhanClientId, dhanAccessToken }),
  testConnection: () => request('POST', '/test-api-connection'),
  getFundLimits: () => request('GET', '/fund-limits'),

  // Wallet
  getWalletBalance: () => request('GET', '/wallet/balance'),
  getWalletTransactions: () => request('GET', '/wallet/transactions'),

  // Static IP
  getStaticIP: () => request('GET', '/static-ip'),
  createStaticIPOrder: () => request('POST', '/static-ip/create-order'),

  // Positions
  getLivePositions: () => request('GET', '/live-positions'),
  getPositions: () => request('GET', '/positions'),

  // Market
  getMarketQuote: (index: string) => request('POST', '/market-quote', { index }),
};
