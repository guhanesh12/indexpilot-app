/**
 * Firebase Push Notifications setup for IndexPilotAI.
 *
 * Triggers (per user spec):
 *   • Signal detection (engine publishes per candle)
 *   • Order placed
 *   • Position open/close updates
 *   • Engine start / stop
 *   • Wallet credit / debit
 *   • Support ticket reply
 *
 * IMPORTANT:
 *   - Real push delivery only works in EAS Dev/Preview/Production builds.
 *   - In Expo Go (SDK 53+), expo-notifications throws on import → we lazy-load
 *     it ONLY when not in Expo Go to avoid crashing the bundle.
 *   - Backend hook: POST /push/subscribe { token, platform }
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

const inExpoGo = Constants.appOwnership === 'expo';
const canUsePush = Platform.OS !== 'web' && !inExpoGo;

let registered = false;

export async function registerForPushNotifications(): Promise<string | null> {
  if (registered) return null;
  if (!canUsePush) {
    console.log('[Push] Skipped — Expo Go or web (no native FCM/APNs)');
    return null;
  }

  try {
    // Lazy-load the modules inside the function so Expo Go never resolves them
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    // Foreground behavior (set once)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }) as any,
    });

    if (!Device.isDevice) {
      console.log('[Push] Skipped — emulator/simulator not supported');
      return null;
    }

    // Permissions
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    // Android channels (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Trading Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
      });
      await Notifications.setNotificationChannelAsync('signals', {
        name: 'AI Signals',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#00FF66',
      });
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders & Positions',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#00B4FF',
      });
      await Notifications.setNotificationChannelAsync('wallet', {
        name: 'Wallet & Funds',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FFB800',
      });
    }

    // Native FCM (Android) / APNs (iOS) device token
    let token: string | null = null;
    try {
      const dev = await Notifications.getDevicePushTokenAsync();
      token = dev?.data || null;
    } catch (e) {
      console.log('[Push] getDevicePushTokenAsync failed:', e);
    }

    if (!token) return null;

    // Send token to backend so server can target this device
    try {
      await api.subscribePush(token, Platform.OS as 'android' | 'ios');
      console.log('[Push] Token registered with backend');
    } catch (e) {
      console.log('[Push] Backend subscribe failed:', e);
    }

    registered = true;
    return token;
  } catch (err) {
    console.log('[Push] Setup failed:', err);
    return null;
  }
}

/** Listener for foreground notifications. Returns cleanup. No-op in Expo Go/web. */
export function attachForegroundListener(onReceive: (n: any) => void): () => void {
  if (!canUsePush) return () => {};
  let subRef: any = null;
  import('expo-notifications').then((Notifications) => {
    subRef = Notifications.addNotificationReceivedListener(onReceive);
  }).catch(() => {});
  return () => { try { subRef?.remove(); } catch {} };
}

/** Listener for notification taps. No-op in Expo Go/web. */
export function attachResponseListener(onTap: (r: any) => void): () => void {
  if (!canUsePush) return () => {};
  let subRef: any = null;
  import('expo-notifications').then((Notifications) => {
    subRef = Notifications.addNotificationResponseReceivedListener(onTap);
  }).catch(() => {});
  return () => { try { subRef?.remove(); } catch {} };
}

/** Local notification (for testing / fallback). No-op in Expo Go/web. */
export async function showLocalNotification(title: string, body: string, channel = 'default') {
  if (!canUsePush) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, badge: 1 },
      trigger: Platform.OS === 'android' ? ({ channelId: channel } as any) : null,
    });
  } catch {}
}
