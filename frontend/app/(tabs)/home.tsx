import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
const WEBSITE_URL = 'https://indexpilotai.com';

function marketOpen() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const ist = (now.getUTCHours() + 5) * 60 + (now.getUTCMinutes() + 30);
  return ist >= 9 * 60 + 15 && ist <= 15 * 60 + 30;
}

function timeToNextCandle(intervalMin: number) {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const next = Math.ceil((minutes + 1) / intervalMin) * intervalMin;
  const diff = (next - minutes) * 60 - seconds;
  const mm = Math.floor(diff / 60).toString().padStart(2, '0');
  const ss = (diff % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function HomeTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<number>(0);
  const [todayPnl, setTodayPnl] = useState<number>(0);
  const [totalPnl, setTotalPnl] = useState<number>(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [engineState, setEngineState] = useState<any>(null);
  const [marketQuotes, setMarketQuotes] = useState<Record<string, any>>({});
  const [countdown, setCountdown] = useState(timeToNextCandle(15));
  const isOpen = marketOpen();

  const engineRunning = Boolean(
    engineState?.running ||
    engineState?.isRunning ||
    engineState?.state === 'running' ||
    engineState?.data?.running ||
    engineState?.engineRunning
  );
  const engineInterval = engineState?.interval || engineState?.candleInterval || engineState?.data?.interval || '15';

  // Countdown ticker
  useEffect(() => {
    const t = setInterval(
      () => setCountdown(timeToNextCandle(parseInt(engineInterval, 10) || 15)),
      1000
    );
    return () => clearInterval(t);
  }, [engineInterval]);

  const loadAll = useCallback(async () => {
    const [w, p, s, e] = await Promise.allSettled([
      api.getWalletBalance(),
      api.getLivePositions(),
      api.getWalletDailyStats(),
      api.getEngineState(),
    ]);
    if (w.status === 'fulfilled') {
      const v: any = w.value;
      const b = v?.balance ?? v?.data?.balance ?? v?.wallet?.balance ?? 0;
      setWallet(Number(b) || 0);
    }
    if (p.status === 'fulfilled') {
      const v: any = p.value;
      const list = v?.positions ?? v?.data ?? v?.livePositions ?? [];
      const arr = Array.isArray(list) ? list : [];
      setPositions(arr);
      const t = arr.reduce((sum: number, x: any) => sum + (Number(x.pnl || x.profitLoss || 0) || 0), 0);
      setTodayPnl(t);
    }
    if (s.status === 'fulfilled') {
      const v: any = s.value;
      setTotalPnl(Number(v?.totalProfit ?? v?.data?.totalProfit ?? v?.totalPnL ?? v?.totalRealizedPnL ?? 0));
    }
    if (e.status === 'fulfilled') setEngineState(e.value);
  }, []);

  const loadQuotes = useCallback(async () => {
    const quotes: Record<string, any> = {};
    await Promise.all(
      INDICES.map(async (idx) => {
        try {
          const r: any = await api.getMarketQuote({ index: idx });
          quotes[idx] = r?.quote || r?.data || r;
        } catch {
          /* ignore */
        }
      })
    );
    if (Object.keys(quotes).length) setMarketQuotes(quotes);
  }, []);

  useEffect(() => {
    loadAll();
    loadQuotes();
    const allTimer = setInterval(loadAll, 5000);
    const quoteTimer = setInterval(loadQuotes, 5000);
    return () => {
      clearInterval(allTimer);
      clearInterval(quoteTimer);
    };
  }, [loadAll, loadQuotes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), loadQuotes()]);
    setRefreshing(false);
  };

  const openWebsite = (path: string = '') => {
    Linking.openURL(`${WEBSITE_URL}${path}`).catch(() => {
      Alert.alert('Open in browser', 'Could not open link');
    });
  };

  const stopEngine = async () => {
    Alert.alert('Stop Engine', 'Auto-trading will pause. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.stopEngine();
            await loadAll();
            Alert.alert('Engine stopped', 'Auto-trading paused');
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const displayName = user?.name || (user?.email ? String(user.email).split('@')[0] : 'Trader');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 32 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>WELCOME BACK</Text>
            <Heading variant="h3" numberOfLines={1}>{displayName}</Heading>
          </View>
          <TouchableOpacity
            testID="logout-button"
            onPress={() =>
              Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
              ])
            }
            style={styles.iconBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Wallet hero */}
        <LinearGradient
          colors={['#00B4FF', '#7C5CFF', '#FF4DD2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletInner}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.walletLabel}>WALLET BALANCE</Text>
              <View style={styles.marketInd}>
                <Animated.View style={[styles.marketDot, pulseStyle, { backgroundColor: isOpen ? '#00FF66' : '#FF3344' }]} testID="market-status-indicator" />
                <Text style={{ color: isOpen ? '#00FF66' : '#FF3344', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                  {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                </Text>
              </View>
            </View>
            <Text style={styles.walletAmount} testID="dashboard-wallet-balance">
              ₹{wallet.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.base }}>
              <TouchableOpacity
                testID="add-funds-button"
                onPress={() => openWebsite('/wallet')}
                style={styles.walletBtn}
              >
                <Ionicons name="add-circle" size={16} color="#050505" />
                <Text style={{ color: '#050505', fontWeight: '800', fontSize: 13 }}>Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openWebsite('/wallet')} style={styles.walletBtnGhost}>
                <Ionicons name="receipt-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* PnL row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          <PnlCard label="TODAY'S P&L" value={todayPnl} testID="dashboard-today-pnl" gradient={['#00FF66', '#00B4A0']} />
          <PnlCard label="TOTAL P&L" value={totalPnl} testID="dashboard-total-pnl" gradient={['#7C5CFF', '#5238B6']} />
        </View>

        {/* Engine card */}
        <LinearGradient
          colors={engineRunning ? ['#053D2C', '#001F12'] : ['#1A1A22', '#0F0F13']}
          style={[styles.engineCard, engineRunning && styles.engineCardRunning]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.engineLabel}>⚡ AI TRADING ENGINE</Text>
              <Text
                style={{ color: engineRunning ? '#00FF66' : '#888', fontSize: 18, fontWeight: '800', marginTop: 4 }}
                testID="engine-status-text"
              >
                {engineRunning ? `● RUNNING · ${engineInterval}M` : '○ STOPPED'}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 4 }}>
                {engineRunning
                  ? 'Auto-trading every candle close'
                  : 'Start engine on website to enable auto-trading'}
              </Text>
            </View>
            {engineRunning ? (
              <TouchableOpacity onPress={stopEngine} style={styles.stopBtn} testID="engine-stop-button">
                <Ionicons name="stop" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => openWebsite('/dashboard')}
                style={styles.startBtn}
                testID="engine-start-redirect-button"
              >
                <Ionicons name="open-outline" size={20} color="#050505" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.engineMeta}>
            <View style={styles.engineMetaItem}>
              <Text style={styles.metaLabel}>NEXT CANDLE</Text>
              <Text style={styles.metaValue} testID="next-candle-countdown">{countdown}</Text>
            </View>
            <View style={[styles.engineMetaItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.metaLabel}>POSITIONS</Text>
              <Text style={styles.metaValue}>{positions.length}</Text>
            </View>
            <View style={[styles.engineMetaItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.metaLabel}>STATUS</Text>
              <Text style={[styles.metaValue, { color: isOpen ? '#00FF66' : '#FF3344', fontSize: 13 }]}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Live indices */}
        <View style={styles.indexRow}>
          {INDICES.map((idx, i) => {
            const q = marketQuotes[idx] || {};
            const ltp = Number(q.ltp || q.lastPrice || q.price || 0);
            const change = Number(q.change || q.netChange || q.dayChange || 0);
            const pct = Number(q.changePercent || q.percentChange || 0);
            const positive = change >= 0;
            const grads: [string, string][] = [
              ['#00B4FF20', '#0050FF20'],
              ['#FF4DD220', '#FF008820'],
              ['#FFB80020', '#FF730020'],
            ];
            return (
              <LinearGradient key={idx} colors={grads[i] as any} style={styles.indexCard}>
                <Text style={styles.indexLabel}>{idx}</Text>
                <Text style={styles.indexLtp}>
                  {ltp ? ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '---'}
                </Text>
                {ltp ? (
                  <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                    {positive ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(pct).toFixed(2)}%)
                  </Text>
                ) : (
                  <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 2 }}>Loading…</Text>
                )}
              </LinearGradient>
            );
          })}
        </View>

        {/* Positions */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={styles.sectionTitle}>ACTIVE POSITIONS</Text>
            <Text style={{ color: colors.text.disabled, fontSize: 10 }}>↻ auto 5s</Text>
          </View>
          <View testID="active-positions-list">
            {positions.length === 0 ? (
              <Card>
                <Body style={{ textAlign: 'center' }}>No active positions</Body>
              </Card>
            ) : (
              positions.map((p, idx) => <PositionRow key={p.positionId || p.id || idx} p={p} />)
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PnlCard({
  label,
  value,
  testID,
  gradient,
}: {
  label: string;
  value: number;
  testID?: string;
  gradient: string[];
}) {
  const positive = value >= 0;
  return (
    <View style={styles.pnlWrap}>
      <LinearGradient
        colors={[gradient[0] + '22', gradient[1] + '22']}
        style={[styles.pnlCard, { borderColor: positive ? '#00FF6655' : '#FF334455' }]}
      >
        <Text style={styles.pnlLabel}>{label}</Text>
        <Text
          testID={testID}
          style={{
            ...(typography.metric as any),
            fontSize: 20,
            lineHeight: 26,
            color: positive ? '#00FF66' : '#FF3344',
            marginTop: 4,
          }}
        >
          {positive ? '+' : ''}₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
      </LinearGradient>
    </View>
  );
}

function PositionRow({ p }: { p: any }) {
  const pnl = Number(p.pnl || p.profitLoss || 0);
  const positive = pnl >= 0;
  return (
    <View style={[styles.posRow, { borderLeftColor: positive ? '#00FF66' : '#FF3344' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            {p.symbol || p.tradingSymbol || p.name || 'Position'}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
            Qty {p.quantity || 0} • Entry ₹{p.entryPrice || p.avgPrice || 0}{p.ltp ? ` • LTP ₹${p.ltp}` : ''}
          </Text>
        </View>
        <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontWeight: '800', fontSize: 16 }}>
          {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base },
  welcome: { color: '#7C5CFF', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  walletCard: {
    borderRadius: radius.lg,
    padding: 1,
  },
  walletInner: {
    backgroundColor: '#08051F',
    borderRadius: radius.lg - 1,
    padding: spacing.lg,
  },
  walletLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  walletAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  walletBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  marketInd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  pnlWrap: { flex: 1 },
  pnlCard: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pnlLabel: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  engineCard: {
    marginTop: spacing.base,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  engineCardRunning: { borderColor: '#00FF66', borderWidth: 1.5 },
  engineLabel: { color: colors.text.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  startBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#00FF66',
    alignItems: 'center', justifyContent: 'center',
  },
  stopBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FF3344',
    alignItems: 'center', justifyContent: 'center',
  },
  engineMeta: {
    flexDirection: 'row',
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  engineMetaItem: { flex: 1, paddingHorizontal: spacing.sm },
  metaLabel: { color: colors.text.disabled, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  metaValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  indexRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base },
  indexCard: {
    flex: 1,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  indexLabel: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  indexLtp: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  sectionTitle: { color: colors.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  posRow: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
