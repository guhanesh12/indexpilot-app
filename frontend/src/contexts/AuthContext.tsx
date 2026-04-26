import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Storage } from '../lib/storage';
import { registerForPushNotifications } from '../lib/push';

type User = { id: string; email: string; name?: string } | null;

type AuthState = {
  ready: boolean;
  user: User;
  hasPin: boolean;
  pinUnlocked: boolean;
  signIn: (user: any, access: string, refresh: string) => Promise<void>;
  signOut: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  unlockPin: (pin: string) => Promise<boolean>;
  lockPin: () => void;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(false);

  const refresh = useCallback(async () => {
    const token = await Storage.getAccessToken();
    const u = await Storage.getUser();
    const pin = await Storage.getPin();
    setUser(token && u ? u : null);
    setHasPin(Boolean(pin));
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (u: any, access: string, refreshToken: string) => {
    await Storage.saveTokens(access, refreshToken);
    await Storage.saveUser(u);
    setUser(u);
    const pin = await Storage.getPin();
    setHasPin(Boolean(pin));
    setPinUnlocked(false);
    // Register for push notifications (no-op on web/Expo Go, fully works on EAS build)
    registerForPushNotifications().catch(() => {});
  };

  const signOut = async () => {
    await Storage.clearTokens();
    await Storage.clearPin();
    setUser(null);
    setHasPin(false);
    setPinUnlocked(false);
  };

  const setPin = async (pin: string) => {
    await Storage.savePin(pin);
    setHasPin(true);
    setPinUnlocked(true);
  };

  const unlockPin = async (pin: string) => {
    const saved = await Storage.getPin();
    if (saved && saved === pin) {
      setPinUnlocked(true);
      return true;
    }
    return false;
  };

  const lockPin = () => setPinUnlocked(false);

  return (
    <AuthCtx.Provider
      value={{ ready, user, hasPin, pinUnlocked, signIn, signOut, setPin, unlockPin, lockPin, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
