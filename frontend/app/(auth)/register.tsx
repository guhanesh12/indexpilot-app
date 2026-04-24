import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    state: '',
    city: '',
    password: '',
  });
  const [agree, setAgree] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const update = (k: string) => (v: string) => {
    setErr('');
    setForm((s) => ({ ...s, [k]: v }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return 'Please enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email';
    if (!/^\d{10}$/.test(form.mobile)) return 'Enter a valid 10-digit mobile';
    if (!form.state) return 'Please select your state';
    if (!form.city.trim()) return 'Please enter your city';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!agree) return 'Please agree to the Terms & Privacy Policy';
    return '';
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setLoading(true);
    try {
      // 1) Check email exists
      try {
        const check: any = await api.checkEmail(form.email.trim());
        if (check?.exists) {
          setErr('An account with this email already exists. Please sign in.');
          setLoading(false);
          return;
        }
      } catch {
        /* if endpoint fails, continue — server will catch duplicates later */
      }

      // 2) Send OTP to mobile
      await api.sendOtp(form.mobile);

      // Navigate to OTP screen with all form data
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: form.mobile,
          email: form.email.trim(),
          password: form.password,
          name: form.fullName,
          state: form.state,
          city: form.city,
        },
      });
    } catch (e: any) {
      setErr(e.message || 'Failed to send OTP. Please try again.');
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
            Create Your{'\n'}Account
          </Heading>
          <Body style={{ marginBottom: spacing.xl }}>
            Join IndexPilot AI and start your trading journey
          </Body>

          <FieldLabel icon="person-outline" text="Full Name" />
          <Input
            testID="register-name-input"
            value={form.fullName}
            onChangeText={update('fullName')}
            placeholder="Enter your full name"
          />

          <FieldLabel icon="mail-outline" text="Email Address" />
          <Input
            testID="register-email-input"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={form.email}
            onChangeText={update('email')}
            placeholder="your.email@example.com"
          />

          <FieldLabel icon="call-outline" text="Mobile Number" />
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Input
                testID="register-mobile-input"
                keyboardType="number-pad"
                maxLength={10}
                value={form.mobile}
                onChangeText={(v) => update('mobile')(v.replace(/\D/g, ''))}
                placeholder="9876543210"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FieldLabel icon="business-outline" text="State" />
              <TouchableOpacity
                testID="register-state-select"
                onPress={() => setStateOpen(true)}
                style={styles.selectBox}
              >
                <Text style={{ color: form.state ? colors.text.primary : colors.text.disabled, fontSize: 15 }}>
                  {form.state || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FieldLabel icon="location-outline" text="City" />
              <Input
                testID="register-city-input"
                value={form.city}
                onChangeText={update('city')}
                placeholder="Your city"
              />
            </View>
          </View>

          <FieldLabel icon="lock-closed-outline" text="Password" />
          <View style={{ position: 'relative' }}>
            <Input
              testID="register-password-input"
              secureTextEntry={!showPwd}
              value={form.password}
              onChangeText={update('password')}
              placeholder="Min. 8 characters"
              style={{ paddingRight: 44 }}
            />
            <TouchableOpacity
              onPress={() => setShowPwd((s) => !s)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="register-agree-checkbox"
            onPress={() => setAgree((a) => !a)}
            style={styles.tcRow}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agree && styles.checkboxOn]}>
              {agree ? <Ionicons name="checkmark" size={14} color="#050505" /> : null}
            </View>
            <Text style={styles.tcText}>
              I agree to the{' '}
              <Text style={{ color: colors.trading.profit, fontWeight: '600' }}>Terms & Conditions</Text>
              {' '}and{' '}
              <Text style={{ color: colors.trading.profit, fontWeight: '600' }}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {err ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <Button
            testID="register-submit-button"
            title="Continue to OTP Verification"
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.base }}
          />

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: spacing.lg, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.secondary }}>
              Already have an account?{' '}
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <StateModal
        visible={stateOpen}
        onClose={() => setStateOpen(false)}
        onPick={(s) => {
          update('state')(s);
          setStateOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={fl.row}>
      <Ionicons name={icon} size={14} color={colors.text.secondary} />
      <Text style={fl.text}>{text}</Text>
    </View>
  );
}

function StateModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sm.bg}>
        <View style={sm.body}>
          <View style={sm.handle} />
          <View style={sm.header}>
            <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>
              Select State
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={INDIAN_STATES}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onPick(item)} style={sm.item}>
                <Text style={{ color: colors.text.primary, fontSize: 15 }}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const fl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  text: { color: colors.text.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
});

const sm = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  body: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  back: { marginBottom: spacing.lg },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  prefix: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 4,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { color: colors.text.primary, fontWeight: '700', fontSize: 15 },
  row2: { flexDirection: 'row' },
  selectBox: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 4,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 4,
  },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.trading.profit,
    borderColor: colors.trading.profit,
  },
  tcText: { color: colors.text.secondary, fontSize: 13, flex: 1, lineHeight: 18 },
  errBox: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
    borderRadius: 4,
    padding: 12,
    marginTop: spacing.sm,
  },
  errText: { color: colors.trading.loss, fontSize: 13 },
});
