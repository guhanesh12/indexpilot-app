import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing } from '../../src/lib/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import PinKeypad from '../../src/components/PinKeypad';

export default function PinLockScreen() {
  const router = useRouter();
  const { unlockPin, signOut, user } = useAuth();
  const [pin, setPin] = useState('');

  const onComplete = async (p: string) => {
    const ok = await unlockPin(p);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPin('');
      Alert.alert('Wrong PIN', 'Please try again');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={styles.logoDot} />
        <Heading variant="h2" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
          Enter PIN
        </Heading>
        <Body style={{ textAlign: 'center' }}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </Body>
      </View>

      <PinKeypad value={pin} onChange={setPin} onComplete={onComplete} length={4} />

      <TouchableOpacity
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/login');
        }}
        style={{ alignItems: 'center', paddingVertical: spacing.base }}
      >
        <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
          Sign in with a different account
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg },
  top: { marginTop: spacing.xl, marginBottom: spacing.lg, alignItems: 'center' },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.trading.profit,
    marginBottom: spacing.base,
  },
});
