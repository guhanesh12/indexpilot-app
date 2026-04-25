import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Heading, Body, Button, Input } from '../../src/components/Primitives';
import { colors, spacing, radius, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const SUBS = ['Connection', 'Static IP', 'Request'] as const;

export default function BrokerTab() {
  const [sub, setSub] = useState<typeof SUBS[number]>('Connection');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base }}>
        <Heading variant="h3" style={{ marginBottom: spacing.base }}>Broker</Heading>
        <View style={styles.tabs}>
          {SUBS.map((s) => (
            <TouchableOpacity
              key={s}
              testID={`broker-tab-${s.toLowerCase().replace(' ', '-')}`}
              onPress={() => setSub(s)}
              style={[styles.tab, sub === s && styles.tabActive]}
            >
              <Text style={{ color: sub === s ? '#050505' : colors.text.primary, fontWeight: '700', fontSize: 13 }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingTop: 0, paddingBottom: 80 }}>
        {sub === 'Connection' && <ConnectionTab />}
        {sub === 'Static IP' && <StaticIPTab />}
        {sub === 'Request' && <RequestTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectionTab() {
  const [clientId, setClientId] = useState('');
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fund, setFund] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const loadStatus = async () => {
    try {
      const res: any = await api.getApiCredentials();
      const creds = res?.credentials || res?.data || res;
      const cid = creds?.dhanClientId || res?.dhanClientId;
      const tok = creds?.dhanAccessToken || res?.dhanAccessToken;
      const isConfig = res?.isConfigured || res?.status?.dhanConfigured || creds?.dhanClientId;
      if (cid) setClientId(String(cid));
      if (tok && tok !== '••••••') setToken(String(tok));
      if (isConfig) {
        setConnected(true);
        setStatusMsg('Credentials saved');
        try {
          const fl: any = await api.getFundLimits();
          const funds = fl?.funds || fl?.data || fl;
          if (funds && (funds.availableBalance !== undefined || funds.utilizationAmount !== undefined)) {
            setFund(funds);
          }
        } catch {}
      }
    } catch {}
  };

  useEffect(() => { loadStatus(); }, []);

  const save = async () => {
    if (!clientId || !token) return Alert.alert('Missing', 'Enter both Client ID and Access Token');
    setLoading(true);
    try {
      const sav: any = await api.saveApiCredentials(clientId, token);
      if (sav?.success === false) {
        Alert.alert('Save failed', sav?.message || 'Could not save credentials');
        return;
      }
      // Test connection
      setTesting(true);
      const test: any = await api.testApiConnection();
      const dhanOk = test?.status?.dhan === true || test?.connected === true;
      const detail = test?.status?.details?.dhan || test?.message || '';
      // Even if test fails, fund-limits may still work
      let fundData: any = null;
      try {
        const fl: any = await api.getFundLimits();
        fundData = fl?.funds || fl?.data || fl;
        if (fundData) setFund(fundData);
      } catch {}

      if (dhanOk) {
        setConnected(true);
        setStatusMsg('✓ Connected to Dhan');
        Alert.alert('🎉 Connected', 'Broker API verified successfully' + (fundData?.availableBalance !== undefined ? `\n\nAvailable Funds: ₹${fundData.availableBalance}` : ''));
      } else if (fundData && (fundData.availableBalance !== undefined || fundData.sodLimit !== undefined)) {
        setConnected(true);
        setStatusMsg('✓ Saved & funds reachable');
        Alert.alert('Saved', 'Credentials saved. Fund data reachable.\n\n' + (detail ? `Note: ${detail}` : 'Live order tests may take 1-2 minutes after token refresh.'));
      } else {
        setConnected(true); // saved at least
        setStatusMsg('⚠ Saved but test failed');
        Alert.alert('Saved with warning', `Credentials saved, but test failed: ${detail || 'Unknown error'}\n\nThis can happen if:\n• Access token expired (regenerate from Dhan console)\n• Network issue\n• Dhan API rate limited`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.base }}>
          <View style={[styles.brandBox, { backgroundColor: connected ? 'rgba(0,255,102,0.1)' : colors.bg.tertiary }]}>
            <Ionicons name="flash" size={20} color={connected ? colors.trading.profit : colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}>Dhan</Text>
            <Text style={{ color: connected ? colors.trading.profit : colors.text.secondary, fontSize: 12, marginTop: 2 }}>
              {connected ? (statusMsg || 'Connected') : 'Not connected'}
            </Text>
          </View>
          {connected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,255,102,0.12)', borderRadius: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF66' }} />
              <Text style={{ color: '#00FF66', fontSize: 10, fontWeight: '800' }}>LIVE</Text>
            </View>
          ) : null}
        </View>
        <Input
          label="Dhan Client ID"
          value={clientId}
          onChangeText={setClientId}
          placeholder="1234567890"
          testID="broker-client-id-input"
        />
        <Input
          label="Access Token"
          value={token}
          onChangeText={setToken}
          placeholder="eyJhbGc..."
          testID="broker-access-token-input"
          secureTextEntry={!!token && token.length > 20}
        />
        <Button title={testing ? 'Testing connection…' : (connected ? 'Update & Test' : 'Connect Broker')} onPress={save} loading={loading} testID="broker-connect-button" />
      </Card>

      {fund && (
        <Card style={{ marginTop: spacing.base }}>
          <Text style={styles.label}>📊 BROKER FUND LIMITS (LIVE)</Text>
          <View style={{ marginTop: spacing.sm }}>
            <Row label="Available Balance" value={`₹${Number(fund.availableBalance || 0).toLocaleString('en-IN')}`} />
            <Row label="SOD Limit" value={`₹${Number(fund.sodLimit || 0).toLocaleString('en-IN')}`} />
            <Row label="Utilization" value={`₹${Number(fund.utilizationAmount || fund.utilizedAmount || 0).toLocaleString('en-IN')}`} />
            <Row label="Collateral" value={`₹${Number(fund.collateralAmount || 0).toLocaleString('en-IN')}`} />
            <Row label="Blocked Pay-In" value={`₹${Number(fund.blockedPayinAmount || 0).toLocaleString('en-IN')}`} />
          </View>
        </Card>
      )}
    </View>
  );
}

function StaticIPTab() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setFetching(true);
    try {
      const res: any = await api.getMyIP();
      setInfo(res?.data || res);
    } catch {
      setInfo(null);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const hasActiveIP = Boolean(
    info?.address || info?.ipAddress || info?.ip ||
    info?.status === 'active' || info?.status === 'assigned' || info?.active
  );
  const daysLeft = info?.daysRemaining ?? info?.days_remaining;
  const addr = info?.address || info?.ipAddress || info?.ip || '';

  const copy = async () => {
    if (!addr) return;
    try {
      const Clipboard = await import('@react-native-clipboard/clipboard');
      Clipboard.default.setString(addr);
    } catch {
      try {
        // web fallback
        // @ts-ignore
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          // @ts-ignore
          await navigator.clipboard.writeText(addr);
        }
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const purchase = () => {
    Alert.alert(
      'Purchase Static IP',
      'You will be redirected to indexpilotai.com to complete the ₹599 purchase securely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            Linking.openURL('https://indexpilotai.com/login').catch(() => {
              Alert.alert('Failed', 'Could not open browser');
            });
          },
        },
      ]
    );
  };

  return (
    <View>
      <Card testID="static-ip-card">
        <Text style={styles.label}>YOUR DEDICATED IP</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Text style={{ ...(typography.metric as any), fontSize: 22, color: colors.text.primary, flex: 1 }}>
            {fetching ? '…' : addr || 'Not assigned'}
          </Text>
          {hasActiveIP && addr ? (
            <TouchableOpacity onPress={copy} testID="copy-ip-button" style={ipStyles.copyBtn}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.trading.profit : colors.text.primary} />
              <Text style={{ color: copied ? colors.trading.profit : colors.text.primary, fontSize: 12, fontWeight: '700' }}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {hasActiveIP ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.trading.profit }} />
            <Text style={{ color: colors.trading.profit, fontSize: 13, fontWeight: '700' }}>
              ACTIVE{daysLeft ? ` • ${daysLeft} days remaining` : ''}
            </Text>
          </View>
        ) : null}
      </Card>

      {!hasActiveIP && (
        <Card style={{ marginTop: spacing.base }}>
          <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }}>Premium Static IP</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 13, marginTop: 6 }}>
            Whitelist a dedicated IP with your broker for fast, reliable order execution.
          </Text>
          <Text style={{ color: colors.text.primary, marginTop: spacing.base, fontSize: 28, fontWeight: '800' }}>
            ₹599<Text style={{ fontSize: 14, color: colors.text.secondary, fontWeight: '400' }}> / month</Text>
          </Text>
          <Button
            title="Purchase Static IP →"
            onPress={purchase}
            loading={loading}
            style={{ marginTop: spacing.base }}
            testID="purchase-static-ip-button"
          />
          <Text style={{ color: colors.text.disabled, fontSize: 11, textAlign: 'center', marginTop: spacing.sm }}>
            Secure payment via indexpilotai.com
          </Text>
        </Card>
      )}
    </View>
  );
}

const ipStyles = StyleSheet.create({
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

function RequestTab() {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name) return Alert.alert('Missing', 'Enter a broker name');
    setLoading(true);
    try {
      await api.createTicket({
        subject: `Broker Request: ${name}`,
        message: note || `Please add support for ${name}`,
        category: 'broker_request',
        priority: 'medium',
      });
      Alert.alert('Request sent', 'Our team will review your request shortly');
      setName('');
      setNote('');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Heading variant="h4">Request new broker</Heading>
      <Body style={{ marginTop: 6, marginBottom: spacing.base }}>We'll add it within 5-7 business days.</Body>
      <Input label="Broker Name" value={name} onChangeText={setName} placeholder="Zerodha, Angel One, etc." testID="broker-request-name" />
      <Input label="Why do you need this? (optional)" value={note} onChangeText={setNote} multiline testID="broker-request-note" />
      <Button title="Send Request" onPress={submit} loading={loading} testID="broker-request-submit" />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 13 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm - 2 },
  tabActive: { backgroundColor: colors.brand.primary },
  brandBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
});
