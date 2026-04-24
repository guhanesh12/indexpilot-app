import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing } from '../../src/lib/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import PinKeypad from '../../src/components/PinKeypad';

export default function PinSetupScreen() {
  const router = useRouter();
  const { setPin } = useAuth();
  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');

  const onPinComplete = async (pin: string) => {
    if (stage === 'create') {
      setFirstPin(pin);
      setCurrentPin('');
      setStage('confirm');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      if (pin === firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await setPin(pin);
        router.replace('/(tabs)/home');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('PIN mismatch', 'Please re-enter to create your PIN');
        setStage('create');
        setFirstPin('');
        setCurrentPin('');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Heading variant="h2" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
          {stage === 'create' ? 'Create 4-digit PIN' : 'Confirm PIN'}
        </Heading>
        <Body style={{ textAlign: 'center' }}>
          {stage === 'create' ? 'Secure your app with a quick-access PIN' : 'Re-enter the PIN to confirm'}
        </Body>
      </View>
      <PinKeypad
        value={currentPin}
        onChange={setCurrentPin}
        onComplete={onPinComplete}
        length={4}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg },
  top: { marginTop: spacing.xl, marginBottom: spacing.xl },
});
