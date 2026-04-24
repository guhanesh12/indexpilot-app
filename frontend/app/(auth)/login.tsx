import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!email.trim() || !password) {
      setErr('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.loginWithPassword(email.trim(), password);
      if (res?.access_token) {
        await signIn(
          res.user || { email: email.trim() },
          res.access_token,
          res.refresh_token || res.access_token
        );
        router.replace('/(auth)/pin-setup');
      } else {
        setErr('Invalid response from server');
      }
    } catch (e: any) {
      setErr(e.message || 'Invalid email or password');
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
          <View style={styles.brand}>
            <View style={styles.logoDot} />
            <Text style={styles.brandText}>INDEXPILOT AI</Text>
          </View>

          <Heading variant="h1" style={{ marginBottom: spacing.sm }}>
            Welcome{'\n'}back.
          </Heading>
          <Body style={{ marginBottom: spacing.xl }}>Sign in to continue your trading.</Body>

          <Input
            testID="auth-email-input"
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setErr('');
              setEmail(v);
            }}
            placeholder="you@example.com"
          />
          <Input
            testID="auth-password-input"
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={(v) => {
              setErr('');
              setPassword(v);
            }}
            placeholder="••••••••"
          />

          {err ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <Button
            testID="auth-submit-button"
            title="Sign In"
            onPress={submit}
            loading={loading}
          />

          <TouchableOpacity
            testID="auth-navigate-register"
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkWrap}
          >
            <Text style={styles.link}>
              New here?{' '}
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.huge, gap: 10 },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.trading.profit },
  brandText: { ...(typography.caption as any), color: colors.text.primary },
  linkWrap: { marginTop: spacing.lg, alignItems: 'center' },
  link: { color: colors.text.secondary, fontSize: 14 },
  errBox: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
    borderRadius: 4,
    padding: 12,
    marginBottom: spacing.base,
  },
  errText: { color: colors.trading.loss, fontSize: 13 },
});
