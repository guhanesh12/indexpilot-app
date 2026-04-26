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
 * IMPORTANT: Real push delivery only works in EAS Dev/Preview/Production builds
 * (or detached Expo build). In Expo Go preview, registration silently no-ops.
 *
 * Backend hook: POST /push/subscribe { token, platform }
 *   (per IndexPilotAI_ReactNative_Complete_API_Guide.md §4.14)
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

// Foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }) as any,
});

let registered = false;

export async function registerForPushNotifications(): Promise<string | null> {
  if (registered) return null;

  // Skip on web (no native push)
  if (Platform.OS === 'web') return null;

  // Only physical devices can receive push
  if (!Device.isDevice) {
    console.log('[Push] Skipped — emulator/simulator not supported by FCM/APNs');
    return null;
  }

  // Skip in Expo Go (limited support after SDK 53)
  const inExpoGo = Constants.appOwnership === 'expo';
  if (inExpoGo) {
    console.log('[Push] Skipped — Expo Go detected. Build with EAS for real push.');
    return null;
  }

  try {
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

    // Android channel (required for Android 8+)
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

    // FCM device token (Android) or APNs (iOS)
    let token: string | null = null;
    try {
      const dev = await Notifications.getDevicePushTokenAsync();
      token = dev?.data || null;
    } catch (e) {
      console.log('[Push] getDevicePushTokenAsync failed:', e);
    }

    if (!token) return null;

    // Send to backend
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

/** Listener for foreground notifications. Returns cleanup. */
export function attachForegroundListener(onReceive: (n: any) => void): () => void {
  const sub = Notifications.addNotificationReceivedListener(onReceive);
  return () => sub.remove();
}

/** Listener for notification taps. */
export function attachResponseListener(onTap: (r: any) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(onTap);
  return () => sub.remove();
}

/** Local notification (for testing / fallback when push unavailable). */
export async function showLocalNotification(title: string, body: string, channel = 'default') {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, badge: 1 },
      trigger: Platform.OS === 'android' ? ({ channelId: channel } as any) : null,
    });
  } catch {}
}
