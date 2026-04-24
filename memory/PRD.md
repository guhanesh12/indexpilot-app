# IndexPilot AI — Mobile App (React Native + Expo)

## Overview
Premium React Native Expo mobile port of the user's React website (index-zen-flow) — an AI-powered options trading platform for Indian indices (NIFTY, BANKNIFTY, SENSEX).

## Stack
- **Frontend:** Expo SDK 54, expo-router (file-based), TypeScript, react-native-reanimated, expo-linear-gradient, expo-secure-store (web-fallback to AsyncStorage), @expo/vector-icons, expo-haptics.
- **Backend:** User's Supabase edge functions at `https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7` (no local FastAPI changes).
- **Storage:** SecureStore (tokens, PIN) on native; AsyncStorage on web; AsyncStorage for cached NIFTY/BANKNIFTY/SENSEX instruments.

## Screens (file structure)
```
app/
  _layout.tsx         # Root stack + AuthProvider + SafeAreaProvider + GestureHandler
  index.tsx           # Animated SPLASH (auto-redirects based on auth + PIN state)
  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
    verify-otp.tsx
    pin-setup.tsx     # 4-digit PIN create + confirm
    pin-lock.tsx      # 4-digit PIN unlock
  (tabs)/
    _layout.tsx       # 7-tab bottom navigation
    home.tsx          # Wallet, P&L metrics, market status pulse, candle interval + countdown, positions
    symbols.tsx       # Download NIFTY/BANKNIFTY/SENSEX F&O, cache local, search, filter chips, add/delete
    broker.tsx        # 3 sub-tabs: Connection (Dhan), Static IP, Request-new-broker
    journal.tsx       # Win rate, total P&L, trade entries, empty state
    strategies.tsx    # AI signal generator (index + interval), AI monitor
    support.tsx       # Ticket create + list + status badges
    logs.tsx          # Filter by type, terminal-style rows, clear all
src/
  lib/theme.ts        # Dark "Elite Trading" tokens (obsidian + neon green/red)
  lib/storage.ts      # Platform-aware (native SecureStore / web AsyncStorage)
  lib/api.ts          # Fetch wrapper with Bearer token, all 25+ endpoints
  contexts/AuthContext.tsx
  components/Primitives.tsx   # Button, Input, Card, Chip, Heading, Body
  components/PinKeypad.tsx    # Animated keypad with haptics
```

## Key Features
1. Animated Splash (logo scale-in, radial glow pulse, staggered title reveal)
2. Email + OTP Registration → PIN setup
3. 4-digit PIN lock on every launch (haptic feedback)
4. Live market status pulse (OPEN/CLOSED based on IST hours + weekday)
5. Candle interval selector with live next-candle countdown
6. Cached offline instrument list (NIFTY/BANKNIFTY/SENSEX)
7. Symbol config modal (qty, target, SL, auto-trade switch)
8. Dhan broker API credentials + test connection + fund limits
9. Static IP purchase card (₹499/mo)
10. Request-new-broker → auto-creates support ticket
11. AI Signal generator with confidence %, entry/target/SL, reasoning, indicators
12. Journal stats (win rate, total P&L, avg P&L), empty-state image
13. Support tickets with category/priority chips, status badges
14. Filterable logs terminal (SIGNAL/ORDER/INFO/ERROR)

## Integrations
- **Backend API:** User's Supabase edge functions (external, not modified)
- **No LLM/Stripe/etc. integrations** — the Supabase backend already handles AI & Razorpay

## Known Limitations
- The user's Supabase backend endpoints may return 404/500 for some routes that the docs describe (wallet, static-ip, positions). The UI gracefully degrades — shows ₹0 / empty states when API fails.
- PIN is client-only (no server verification) — industry-standard pattern for app-lock.
- Some older mobile-specific routes (live websocket, Razorpay native SDK) are not integrated in this MVP — card UIs + create-order call are present.

## Next Iterations
- Razorpay native SDK for in-app wallet recharge + static IP payment
- WebSocket live ticker + real-time P&L updates
- Biometric (FaceID/TouchID) in addition to PIN
- CSV export for Journal (share sheet)
- Push notifications for signals
- In-app chart (react-native-skia candles)
