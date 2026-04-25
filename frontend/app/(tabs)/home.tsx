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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Chip, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

const INTERVALS = ['5', '15'];
const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];

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
  const [interval, setIntervalSel] = useState('5');
  const [wallet, setWallet] = useState<number | null>(null);
  const [todayPnl, setTodayPnl] = useState<number>(0);
  const [totalPnl, setTotalPnl] = useState<number>(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [countdown, setCountdown] = useState(timeToNextCandle(5));
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineInterval, setEngineInterval] = useState<string | null>(null);
  const isOpen = marketOpen();

  useEffect(() => {
    const t = setInterval(() => setCountdown(timeToNextCandle(parseInt(interval, 10))), 1000);
    return () => clearInterval(t);
  }, [interval]);

  const load = useCallback(async () => {
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
      const t = arr.reduce((sum: number, x: any) => sum + (Number(x.pnl) || 0), 0);
      setTodayPnl(t);
    }
    if (s.status === 'fulfilled') {
      const v: any = s.value;
      setTotalPnl(Number(v?.totalProfit ?? v?.data?.totalProfit ?? v?.totalPnL ?? 0));
    }
    if (e.status === 'fulfilled') {
      const v: any = e.value;
      const running = Boolean(v?.running ?? v?.isRunning ?? v?.state === 'running' ?? v?.data?.running);
      setEngineRunning(running);
      setEngineInterval(v?.interval ?? v?.candleInterval ?? v?.data?.interval ?? null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleEngine = async () => {
    setEngineLoading(true);
    try {
      if (engineRunning) {
        await api.stopEngine();
        setEngineRunning(false);
        Alert.alert('Engine stopped', 'Auto-trading paused');
      } else {
        await api.startEngine(interval);
        setEngineRunning(true);
        setEngineInterval(interval);
        Alert.alert('Engine started', `AI will send signals every ${interval}m. Auto-orders will fire on BUY_CALL / BUY_PUT.`);
      }
    } catch (err: any) {
      Alert.alert('Engine error', err.message);
    } finally {
      setEngineLoading(false);
    }
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.primary}
            testID="pull-to-refresh-control"
          />
        }
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 32 }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.secondary, fontSize: 12, letterSpacing: 1 }}>WELCOME</Text>
            <Heading variant="h3" numberOfLines={1}>
              {displayName}
            </Heading>
          </View>
          <TouchableOpacity
            testID="logout-button"
            onPress={() =>
              Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                    router.replace('/(auth)/login');
                  },
                },
              ])
            }
            style={styles.iconBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={['#1A1A22', '#0F0F13']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.walletCard]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.label}>WALLET BALANCE</Text>
            <View style={styles.marketInd}>
              <Animated.View
                style={[
                  styles.marketDot,
                  pulseStyle,
                  { backgroundColor: isOpen ? colors.trading.profit : colors.trading.loss },
                ]}
                testID="market-status-indicator"
              />
              <Text
                style={{
                  color: isOpen ? colors.trading.profit : colors.trading.loss,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                }}
              >
                {isOpen ? 'MARKET OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>
          <Text
            style={[typography.metric as any, { color: colors.text.primary, marginTop: 6 }]}
            testID="dashboard-wallet-balance"
          >
            ₹{(wallet ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
          <TouchableOpacity testID="add-funds-button" style={styles.addFundsBtn}>
            <Ionicons name="add" size={16} color="#050505" />
            <Text style={{ color: '#050505', fontWeight: '700', fontSize: 13 }}>Add Funds</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          <PnlCard label="TODAY'S P&L" value={todayPnl} testID="dashboard-today-pnl" />
          <PnlCard label="TOTAL P&L" value={totalPnl} testID="dashboard-total-pnl" />
        </View>

        {/* AUTO-TRADE ENGINE */}
        <Card style={{ marginTop: spacing.base, borderColor: engineRunning ? colors.trading.profit : colors.border.default, borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>AUTO-TRADE ENGINE</Text>
              <Text
                style={{
                  color: engineRunning ? colors.trading.profit : colors.text.secondary,
                  fontSize: 18,
                  fontWeight: '800',
                  marginTop: 4,
                }}
                testID="engine-status-text"
              >
                {engineRunning ? `● RUNNING • ${engineInterval || interval}m` : '○ STOPPED'}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 4 }}>
                {engineRunning
                  ? 'Every candle close → AI signal → auto-order to Dhan'
                  : 'Select timeframe and start to auto-trade'}
              </Text>
            </View>
            <TouchableOpacity
              testID="engine-toggle-button"
              onPress={toggleEngine}
              disabled={engineLoading}
              style={[
                styles.engineBtn,
                { backgroundColor: engineRunning ? colors.trading.loss : colors.trading.profit },
              ]}
            >
              {engineLoading ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <Ionicons name={engineRunning ? 'stop' : 'play'} size={24} color="#050505" />
              )}
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: spacing.base }}>
            <Text style={{ ...(styles.label as any), marginBottom: 6 }}>TIMEFRAME</Text>
            <View style={{ flexDirection: 'row' }}>
              {INTERVALS.map((iv) => (
                <Chip
                  key={iv}
                  label={`${iv}m`}
                  active={interval === iv}
                  onPress={() => !engineRunning && setIntervalSel(iv)}
                  testID={`interval-chip-${iv}`}
                />
              ))}
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ color: colors.trading.profit, fontSize: 13, fontWeight: '700' }} testID="next-candle-countdown">
                  Next: {countdown}
                </Text>
              </View>
            </View>
            {engineRunning ? (
              <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 6 }}>
                Stop engine to change timeframe
              </Text>
            ) : null}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          {INDICES.map((i) => (
            <View key={i} style={styles.indexCard}>
              <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{i}</Text>
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700', marginTop: 4 }}>Live</Text>
              <View style={styles.spark} />
            </View>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>ACTIVE POSITIONS</Text>
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

function PnlCard({ label, value, testID }: { label: string; value: number; testID?: string }) {
  const positive = value >= 0;
  return (
    <View style={[styles.pnlCard, { borderColor: positive ? colors.border.profit : colors.border.loss }]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        testID={testID}
        style={{
          ...(typography.metric as any),
          fontSize: 22,
          lineHeight: 28,
          color: positive ? colors.trading.profit : colors.trading.loss,
          marginTop: 4,
        }}
      >
        {positive ? '+' : ''}₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

function PositionRow({ p }: { p: any }) {
  const pnl = Number(p.pnl || 0);
  const positive = pnl >= 0;
  return (
    <Card style={{ marginBottom: spacing.sm, padding: spacing.base }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
            {p.symbol || p.tradingSymbol || p.name || 'Position'}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
            Qty {p.quantity || 0} • Entry ₹{p.entryPrice || p.avgPrice || 0}
          </Text>
        </View>
        <Text style={{ color: positive ? colors.trading.profit : colors.trading.loss, fontWeight: '800', fontSize: 15 }}>
          {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  addFundsBtn: {
    marginTop: spacing.base,
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  marketInd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  pnlCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  indexCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  spark: { marginTop: 8, height: 3, backgroundColor: colors.trading.profit, borderRadius: 1.5, width: '70%' },
  sectionTitle: { ...(typography.caption as any), color: colors.text.secondary, marginBottom: spacing.sm },
  engineBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
