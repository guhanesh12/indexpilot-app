import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const { signIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Invalid OTP', 'Enter the code sent to your email');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.verifyOtp(params.email, otp);
      if (res?.accessToken) {
        await signIn(res.user || { email: params.email }, res.accessToken, res.refreshToken);
        router.replace('/(auth)/pin-setup');
      } else {
        throw new Error(res?.message || 'Verification failed');
      }
    } catch (e: any) {
      Alert.alert('Verify failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.sendOtp(params.email as string);
      Alert.alert('OTP sent', 'Check your email');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: spacing.lg }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text.secondary }}>← Back</Text>
        </TouchableOpacity>

        <Heading variant="h1" style={{ marginBottom: spacing.sm }}>Verify email.</Heading>
        <Body style={{ marginBottom: spacing.xl }}>
          Enter the 6-digit code sent to {params.email}
        </Body>

        <Input
          testID="otp-input"
          label="OTP Code"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
          placeholder="• • • • • •"
          style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
        />

        <Button testID="otp-verify-button" title="Verify" onPress={verify} loading={loading} />

        <TouchableOpacity onPress={resend} disabled={resending} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.text.secondary }}>
            {resending ? 'Sending...' : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
});
