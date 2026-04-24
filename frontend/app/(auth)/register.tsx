import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  const update = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Missing fields', 'Name, email and password are required');
      return;
    }
    setLoading(true);
    try {
      await api.signup({
        name: form.name,
        email: form.email.trim(),
        phone: form.phone,
        password: form.password,
      });
      router.push({ pathname: '/(auth)/verify-otp', params: { email: form.email.trim() } });
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={{ color: colors.text.secondary, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <Heading variant="h1" style={{ marginBottom: spacing.sm }}>
            Create{'\n'}account.
          </Heading>
          <Body style={{ marginBottom: spacing.xl }}>
            Start trading with AI precision.
          </Body>

          <Input
            testID="register-name-input"
            label="Full Name"
            value={form.name}
            onChangeText={update('name')}
            placeholder="Jane Doe"
          />
          <Input
            testID="register-email-input"
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={form.email}
            onChangeText={update('email')}
            placeholder="you@example.com"
          />
          <Input
            testID="register-phone-input"
            label="Phone (optional)"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={update('phone')}
            placeholder="+91 9876543210"
          />
          <Input
            testID="register-password-input"
            label="Password"
            secureTextEntry
            value={form.password}
            onChangeText={update('password')}
            placeholder="Strong password"
          />

          <Button
            testID="register-submit-button"
            title="Send OTP"
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.base }}
          />

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: spacing.lg, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.secondary }}>
              Already have an account? <Text style={{ color: colors.text.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  back: { marginBottom: spacing.lg },
});
