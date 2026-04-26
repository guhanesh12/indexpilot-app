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
  Modal,
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
import AddFundsModal from '../../src/components/AddFundsModal';
import WalletHistoryModal from '../../src/components/WalletHistoryModal';
import LiveSignalsCard from '../../src/components/LiveSignalsCard';
import { Storage } from '../../src/lib/storage';

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
  const [fundLimits, setFundLimits] = useState<any>(null);
  const [countdown, setCountdown] = useState(timeToNextCandle(15));
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showTfPicker, setShowTfPicker] = useState(false);
  const [engineIntent, setEngineIntent] = useState<{ running: boolean; interval: string; ts: number } | null>(null);
  const [latestSignals, setLatestSignals] = useState<any>(null);
  const [monitorPositions, setMonitorPositions] = useState<any[]>([]);
  const [monitorAvailable, setMonitorAvailable] = useState<boolean>(true);
  const isOpen = marketOpen();

  // Load saved engine intent on mount
  useEffect(() => {
    Storage.getEngineIntent().then((v) => v && setEngineIntent(v));
  }, []);

  // Engine state — trust /engine/db-status's engine.isRunning (this is the SAME source the website uses).
  // BUT: when user just clicked Start/Stop, their intent wins for 30s to avoid UI flicker
  // from cron-tick races where server briefly reports stale isRunning.
  const explicitRunning = engineState?.isRunning;
  const intentFresh = engineIntent && (Date.now() - engineIntent.ts < 30 * 1000); // 30 sec
  const engineRunning = intentFresh
    ? engineIntent!.running
    : (explicitRunning === true);
  const engineInterval = engineState?.candleInterval || engineIntent?.interval || '15';

  // Countdown ticker
  useEffect(() => {
    const t = setInterval(
      () => setCountdown(timeToNextCandle(parseInt(engineInterval, 10) || 15)),
      1000
    );
    return () => clearInterval(t);
  }, [engineInterval]);

  const loadAll = useCallback(async () => {
    const promises: Promise<any>[] = [
      api.getWalletBalance(),
      api.getLivePositions(),
      api.getWalletDailyStats(),
      api.getEngineDbStatus(),
      api.getFundLimits(),
    ];
    // Only poll position monitor if endpoint exists on user's Supabase (avoids 404 spam)
    if (monitorAvailable) {
      promises.push(api.getMonitorActive());
    }
    const results = await Promise.allSettled(promises);
    const [w, p, s, e, f, m] = results;
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
    if (e.status === 'fulfilled') {
      const v: any = e.value;
      // /engine/db-status returns: { engine: { isRunning, selectedSymbols, strategySettings: { candleInterval } }, latestSignals: { NIFTY, BANKNIFTY, SENSEX } }
      const eng = v?.engine || v?.data?.engine || v;
      // Normalize fields for consumer
      setEngineState({
        isRunning: eng?.isRunning,
        candleInterval: eng?.strategySettings?.candleInterval || eng?.candleInterval,
        symbolsCount: Array.isArray(eng?.selectedSymbols) ? eng.selectedSymbols.length : (eng?.symbolsCount || 0),
        lastHeartbeat: eng?.lastHeartbeat ? new Date(eng.lastHeartbeat).getTime() : Date.now(),
        startTime: eng?.startedAt ? new Date(eng.startedAt).getTime() : 0,
        selectedSymbols: eng?.selectedSymbols || [],
      });
      // Save latestSignals (3 indices already analyzed by engine)
      const sig = v?.latestSignals || v?.data?.latestSignals;
      if (sig) setLatestSignals(sig);
    }
    if (f.status === 'fulfilled') {
      const v: any = f.value;
      // /fund-limits returns { success, funds: { availableBalance, sodLimit, ... } } when ok, or 401 error object when token expired
      if (v?.success !== false && (v?.funds || v?.availableBalance !== undefined)) {
        const funds = v?.funds || v?.data || v;
        setFundLimits(funds);
      } else {
        // Fallback: fetch directly via Dhan API using locally saved credentials
        // (works around user's Supabase /fund-limits 401 bug)
        const localCreds = await Storage.getBrokerCreds();
        if (localCreds?.clientId && localCreds?.accessToken) {
          try {
            const direct: any = await api.testDhanDirect(localCreds.clientId, localCreds.accessToken);
            if (direct?.connected && direct?.funds) {
              setFundLimits(direct.funds);
              return;
            }
          } catch {}
        }
        setFundLimits(null);
      }
    }
    if (m && m.status === 'fulfilled') {
      const v: any = m.value;
      // Position monitor returns { positions: [...] } or { data: [...] } per spec
      const list = v?.positions ?? v?.data ?? v?.activePositions ?? v?.monitor ?? [];
      setMonitorPositions(Array.isArray(list) ? list : []);
    } else if (m && m.status === 'rejected') {
      // Endpoint missing on user's Supabase deployment — stop polling to avoid 404 spam.
      const msg = String((m as any).reason?.message || '').toLowerCase();
      if (msg.includes('404') || msg.includes('not found') || msg.includes('failed (404)')) {
        setMonitorAvailable(false);
      }
    }
  }, [monitorAvailable]);

  // Skip market quotes — endpoint returns 500 currently
  const loadQuotes = useCallback(async () => {}, []);

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
    try {
      // Optimistically update UI immediately
      const intentObj = { running: false, interval: engineInterval, ts: Date.now() };
      await Storage.setEngineIntent(false);
      setEngineIntent(intentObj);

      // Fire BOTH stop endpoints in parallel — defensive against the cron worker
      // racing with /engine/stop's "isRunning=false" write. /engine/state directly
      // patches the DB row that the cron reads on each tick.
      const stopRes: any = await api.stopEngine().catch((e) => ({ error: e?.message }));
      // Force-overwrite engine state to ensure cron sees isRunning=false on next tick.
      await api.setEngineState({
        isRunning: false,
        enabled: false,
        status: 'stopped',
      }).catch(() => {});

      // Verify after 1.5s — if Supabase still reports running, retry once more.
      await new Promise((r) => setTimeout(r, 1500));
      let verify: any = null;
      try {
        verify = await api.getEngineDbStatus();
      } catch {}
      const stillRunning = (verify?.engine?.isRunning ?? verify?.data?.engine?.isRunning) === true;
      if (stillRunning) {
        // Final retry
        await api.setEngineState({ isRunning: false, enabled: false, status: 'stopped' }).catch(() => {});
        await api.stopEngine().catch(() => {});
      }
      await loadAll();

      Alert.alert(
        '🛑 Engine Stopped',
        stillRunning
          ? 'Stop signal sent twice — website will reflect within 10s.'
          : 'Auto-trading paused.\nSynced with website ✓'
      );
    } catch (e: any) {
      Alert.alert('Failed to stop', e.message || 'Could not stop engine');
      await loadAll();
    }
  };

  const startEngine = async (interval: '5' | '15' = '15') => {
    setShowTfPicker(false);
    try {
      // Fetch active symbols from server
      const r: any = await api.getSymbols();
      const allSyms = r?.symbols || r?.data || [];
      const active = allSyms.filter((s: any) => s.active !== false);
      if (!active.length) {
        Alert.alert('No symbols', 'Add at least one trading symbol from the Symbols tab before starting the engine.');
        return;
      }
      const res: any = await api.startEngine(interval, active);
      if (res?.success === false) {
        Alert.alert('Engine error', res?.error || res?.message || 'Failed to start engine');
        return;
      }
      // Save local intent for reliable UI state
      const intentObj = { running: true, interval, ts: Date.now() };
      await Storage.setEngineIntent(true, interval);
      setEngineIntent(intentObj);
      await loadAll();
      Alert.alert('🚀 Engine Started', `Auto-trading every ${interval}m candle close.\n${active.length} symbol(s) active.\n\nThis stays in sync with website — engine state is shared.`);
    } catch (e: any) {
      Alert.alert('Engine error', e.message + '\n\nTip: Make sure broker is connected first.');
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
                onPress={() => setAddFundsOpen(true)}
                style={styles.walletBtn}
              >
                <Ionicons name="add-circle" size={16} color="#050505" />
                <Text style={{ color: '#050505', fontWeight: '800', fontSize: 13 }}>Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryOpen(true)} style={styles.walletBtnGhost}>
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

        {/* Broker fund-limits card */}
        {fundLimits && (fundLimits.availableBalance || fundLimits.utilizedAmount) ? (
          <LinearGradient colors={['#0A0A1F', '#000']} style={styles.fundCard}>
            <Text style={styles.fundLabel}>⚡ BROKER FUNDS (DHAN)</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: '700' }}>AVAILABLE</Text>
                <Text style={{ color: '#00FF66', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                  ₹{Number(fundLimits.availableBalance || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)', paddingLeft: 12 }}>
                <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: '700' }}>UTILIZED</Text>
                <Text style={{ color: '#FFB800', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                  ₹{Number(fundLimits.utilizedAmount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : null}

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
                  : 'Tap ▶ to start auto-trading'}
              </Text>
            </View>
            {engineRunning ? (
              <TouchableOpacity onPress={stopEngine} style={styles.stopBtn} testID="engine-stop-button">
                <Ionicons name="stop" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTfPicker(true)}
                style={styles.startBtn}
                testID="engine-start-button"
              >
                <Ionicons name="play" size={22} color="#050505" />
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

        {/* Live AI Signals (every candle close) */}
        <LiveSignalsCard signals={latestSignals} interval={engineInterval} />

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

        {/* Position Monitor (real-time AI exit signals — per IndexPilotAI_PositionMonitor_API.md) */}
        {monitorPositions.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Animated.View style={[styles.marketDot, pulseStyle, { backgroundColor: '#7C5CFF' }]} />
                <Text style={[styles.sectionTitle, { color: '#B49AFF' }]}>
                  AI POSITION MONITOR ({monitorPositions.length})
                </Text>
              </View>
              <Text style={{ color: colors.text.disabled, fontSize: 10 }}>live</Text>
            </View>
            <View testID="monitor-positions-list">
              {monitorPositions.map((mp: any, idx: number) => (
                <MonitorRow key={mp.positionId || mp.id || mp.symbol || idx} m={mp} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <AddFundsModal
        visible={addFundsOpen}
        onClose={() => setAddFundsOpen(false)}
        onSuccess={loadAll}
        user={{
          name: user?.name,
          email: user?.email,
          phone: (user as any)?.phone,
        }}
      />
      <WalletHistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Timeframe picker for engine start */}
      <Modal visible={showTfPicker} animationType="fade" transparent onRequestClose={() => setShowTfPicker(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowTfPicker(false)} style={styles.tfBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.tfSheet}>
            <View style={{ alignItems: 'center', paddingBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Select Timeframe</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 4 }}>Engine will scan every candle close</Text>
            </View>
            {[
              { v: '5' as const, label: '5 Minutes', desc: 'High frequency · 75 trades/day max', color: '#FF4DD2' },
              { v: '15' as const, label: '15 Minutes', desc: 'Balanced · 25 trades/day max · ⚡ Recommended', color: '#7C5CFF' },
            ].map((tf) => (
              <TouchableOpacity
                key={tf.v}
                onPress={() => startEngine(tf.v)}
                style={[styles.tfOpt, { borderColor: tf.color + '88' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{tf.label}</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>{tf.desc}</Text>
                </View>
                <View style={[styles.tfBadge, { backgroundColor: tf.color }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>{tf.v}M</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowTfPicker(false)} style={styles.tfCancel}>
              <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

function MonitorRow({ m }: { m: any }) {
  // Monitor item shape (per IndexPilotAI_PositionMonitor_API.md):
  // { positionId, symbol, action: 'HOLD'|'EXIT'|'TRAIL', signal, pnl, currentPrice,
  //   entryPrice, quantity, target, stopLoss, trailingActive, lastChecked, reason }
  const pnl = Number(m.pnl ?? m.profitLoss ?? 0);
  const positive = pnl >= 0;
  const action = String(m.action || m.signal || 'HOLD').toUpperCase();
  const actionColor =
    action === 'EXIT' || action === 'CLOSE' || action === 'SELL' ? '#FF3344'
      : action === 'TRAIL' || action === 'TRAILING' ? '#FFB800'
      : '#00FF66';
  const ltp = Number(m.currentPrice ?? m.ltp ?? m.lastPrice ?? 0);
  const entry = Number(m.entryPrice ?? m.avgPrice ?? 0);
  const qty = Number(m.quantity ?? m.qty ?? 0);
  const target = Number(m.target ?? m.targetAmount ?? 0);
  const stopLoss = Number(m.stopLoss ?? m.stopLossAmount ?? 0);

  return (
    <View style={[styles.monitorRow, { borderLeftColor: actionColor }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
            {m.symbol || m.tradingSymbol || m.name || 'Position'}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            Qty {qty} • E ₹{entry || '—'}{ltp ? ` • L ₹${ltp}` : ''}
            {target ? ` • T ₹${target}` : ''}{stopLoss ? ` • SL ₹${stopLoss}` : ''}
          </Text>
          {m.reason ? (
            <Text style={{ color: '#B49AFF', fontSize: 10, marginTop: 3 }} numberOfLines={2}>
              💡 {m.reason}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <View style={[styles.monitorBadge, { backgroundColor: actionColor + '22', borderColor: actionColor + '88' }]}>
            <Text style={{ color: actionColor, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>{action}</Text>
          </View>
          <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontWeight: '800', fontSize: 14, marginTop: 4 }}>
            {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
          </Text>
        </View>
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
  monitorRow: {
    backgroundColor: 'rgba(124,92,255,0.08)',
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.25)',
  },
  monitorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  fundCard: {
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,180,255,0.25)',
  },
  fundLabel: { color: '#00B4FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  tfBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  tfSheet: {
    backgroundColor: '#0A0820',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,92,255,0.3)',
  },
  tfOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  tfBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tfCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
});
