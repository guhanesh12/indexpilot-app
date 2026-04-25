import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SecureStore is native-only. On web we fall back to AsyncStorage (which uses
// localStorage under the hood). Tokens are less sensitive in the web preview.
const isWeb = Platform.OS === 'web';

const secureGet = (k: string) => (isWeb ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k));
const secureSet = (k: string, v: string) =>
  isWeb ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v);
const secureDel = (k: string) =>
  isWeb ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k);

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PIN: 'user_pin',
  INSTRUMENTS_PREFIX: 'instruments:',
};

export const Storage = {
  async saveTokens(access: string, refresh: string) {
    await secureSet(KEYS.ACCESS_TOKEN, access);
    await secureSet(KEYS.REFRESH_TOKEN, refresh);
  },
  async getAccessToken() {
    return secureGet(KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken() {
    return secureGet(KEYS.REFRESH_TOKEN);
  },
  async clearTokens() {
    await secureDel(KEYS.ACCESS_TOKEN);
    await secureDel(KEYS.REFRESH_TOKEN);
    await secureDel(KEYS.USER);
  },
  async saveUser(u: any) {
    await secureSet(KEYS.USER, JSON.stringify(u));
  },
  async getUser() {
    const raw = await secureGet(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },
  async savePin(pin: string) {
    await secureSet(KEYS.PIN, pin);
  },
  async getPin() {
    return secureGet(KEYS.PIN);
  },
  async clearPin() {
    await secureDel(KEYS.PIN);
  },
  async saveInstruments(key: string, data: any) {
    await AsyncStorage.setItem(
      KEYS.INSTRUMENTS_PREFIX + key,
      JSON.stringify({ ts: Date.now(), data })
    );
  },
  async getInstruments(key: string) {
    const raw = await AsyncStorage.getItem(KEYS.INSTRUMENTS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  },
  async clearInstruments() {
    const keys = await AsyncStorage.getAllKeys();
    const instKeys = keys.filter((k) => k.startsWith(KEYS.INSTRUMENTS_PREFIX));
    if (instKeys.length) await AsyncStorage.multiRemove(instKeys);
  },
  // Engine local intent flag (set by user actions). Helps UI show RUNNING
  // between cron candle ticks where /engine/status returns isRunning:false.
  async setEngineIntent(running: boolean, interval?: string) {
    const v = JSON.stringify({ running, interval: interval || '15', ts: Date.now() });
    await AsyncStorage.setItem('engine_intent', v);
  },
  async getEngineIntent(): Promise<{ running: boolean; interval: string; ts: number } | null> {
    const raw = await AsyncStorage.getItem('engine_intent');
    return raw ? JSON.parse(raw) : null;
  },
};
