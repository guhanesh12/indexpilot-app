import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, spacing, radius } from '../lib/theme';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'] as const;
type IndexName = typeof INDICES[number];

type Signal = {
  index: IndexName;
  signal: string; // BUY_CALL | BUY_PUT | WAIT
  confidence: number; // 0..100
  interval: string;
  timestamp: string;
  reason?: string;
  marketState?: string;
  confirmations?: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral';
  loading?: boolean;
  error?: string;
};

function parseSignalResponse(idx: IndexName, raw: any): Signal {
  // Backend response shape varies; normalize.
  const data = raw?.data || raw?.signal || raw;
  const sig = String(
    data?.signal || data?.action || data?.recommendation ||
    raw?.signal || raw?.action || ''
  ).toUpperCase().replace(/\s+/g, '_');
  let signal = 'WAIT';
  if (sig.includes('CALL') || sig.includes('BUY_CE') || sig === 'BUY') signal = 'BUY_CALL';
  else if (sig.includes('PUT') || sig.includes('BUY_PE') || sig === 'SELL') signal = 'BUY_PUT';
  else if (sig.includes('WAIT') || sig.includes('HOLD') || sig.includes('NO')) signal = 'WAIT';

  let confidence = Number(data?.confidence ?? raw?.confidence ?? 0);
  if (confidence > 0 && confidence <= 1) confidence = confidence * 100;

  const reason = String(data?.reason || data?.analysis || data?.message || raw?.reason || '');
  const marketState = String(data?.marketState || data?.market || data?.trend || raw?.marketState || '').toUpperCase();
  const confirmations = String(data?.confirmations || data?.confirmCount || raw?.confirmations || '');

  let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (signal === 'BUY_CALL') sentiment = 'Bullish';
  else if (signal === 'BUY_PUT') sentiment = 'Bearish';

  return {
    index: idx,
    signal,
    confidence,
    interval: String(data?.interval || raw?.interval || '15M'),
    timestamp: String(data?.timestamp || data?.time || raw?.timestamp || new Date().toISOString()),
    reason,
    marketState,
    confirmations,
    sentiment,
  };
}

export default function LiveSignalsCard() {
  const [interval, setIntervalSel] = useState<'5' | '15' | '30'>('15');
  const [signals, setSignals] = useState<Record<IndexName, Signal | null>>({
    NIFTY: null, BANKNIFTY: null, SENSEX: null,
  });
  const [loading, setLoading] = useState<Record<IndexName, boolean>>({ NIFTY: true, BANKNIFTY: true, SENSEX: true });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadOne = useCallback(async (idx: IndexName, ivl: string) => {
    setLoading((p) => ({ ...p, [idx]: true }));
    try {
      const r: any = await api.getAISignal({ index: idx, interval: ivl });
      if (r && !r.error) {
        const s = parseSignalResponse(idx, r);
        setSignals((p) => ({ ...p, [idx]: s }));
      } else {
        setSignals((p) => ({
          ...p,
          [idx]: {
            index: idx, signal: 'WAIT', confidence: 0, interval: ivl + 'M',
            timestamp: new Date().toISOString(),
            error: r?.error || 'No data',
            sentiment: 'Neutral',
          },
        }));
      }
    } catch (e: any) {
      setSignals((p) => ({
        ...p,
        [idx]: {
          index: idx, signal: 'WAIT', confidence: 0, interval: ivl + 'M',
          timestamp: new Date().toISOString(),
          error: e.message || 'Network error',
          sentiment: 'Neutral',
        },
      }));
    } finally {
      setLoading((p) => ({ ...p, [idx]: false }));
    }
  }, []);

  const loadAll = useCallback(async (ivl: string) => {
    await Promise.all(INDICES.map((i) => loadOne(i, ivl)));
    setUpdatedAt(new Date());
  }, [loadOne]);

  useEffect(() => {
    loadAll(interval);
    const t = setInterval(() => loadAll(interval), 30000);
    return () => clearInterval(t);
  }, [interval, loadAll]);

  return (
    <LinearGradient colors={['#0F0A2E', '#0A0820']} style={styles.card}>
      {/* Header */}
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="trending-up" size={16} color="#7C5CFF" />
          <Text style={styles.title}>Multi-Symbol AI Signals</Text>
        </View>
        {/* Timeframe pills */}
        <View style={styles.ivlRow}>
          {(['5', '15', '30'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => setIntervalSel(v)}
              style={[styles.ivlBtn, interval === v && styles.ivlBtnActive]}
            >
              <Text style={{ color: interval === v ? '#fff' : colors.text.secondary, fontSize: 11, fontWeight: '800' }}>
                {v}M
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3-card row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {INDICES.map((idx) => (
          <SignalIndexCard
            key={idx}
            idx={idx}
            sig={signals[idx]}
            loading={loading[idx]}
            interval={interval}
          />
        ))}
      </ScrollView>

      {updatedAt ? (
        <Text style={{ color: colors.text.disabled, fontSize: 10, textAlign: 'center', marginTop: 10 }}>
          ↻ Last update: {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refresh 30s
        </Text>
      ) : null}

      <View style={styles.howItWorks}>
        <Text style={{ color: '#7C5CFF', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>
          ⚡ HOW IT WORKS
        </Text>
        <Text style={styles.bullet}>• System analyzes all 3 indices independently</Text>
        <Text style={styles.bullet}>• Each index gets its own AI signal (BUY_CALL, BUY_PUT, or WAIT)</Text>
        <Text style={styles.bullet}>• ⚡ ONLY ONE order placed per candle (highest confidence)</Text>
      </View>
    </LinearGradient>
  );
}

function SignalIndexCard({ idx, sig, loading, interval }: { idx: IndexName; sig: Signal | null; loading: boolean; interval: string }) {
  const isCall = sig?.signal === 'BUY_CALL';
  const isPut = sig?.signal === 'BUY_PUT';
  const isWait = !sig || sig.signal === 'WAIT';
  const accent = isCall ? '#00FF66' : isPut ? '#FF3344' : '#FFB800';
  const bgGrad: [string, string] = isCall
    ? ['#053D2C', '#001F12']
    : isPut
    ? ['#3D0511', '#1F0008']
    : ['#1F1A0A', '#0F0A05'];
  const sentLabel = isCall ? 'Bullish' : isPut ? 'Bearish' : 'Neutral';

  const ts = sig?.timestamp ? new Date(sig.timestamp) : null;
  const tsStr = ts ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <LinearGradient
      colors={bgGrad}
      style={[styles.idxCard, { borderColor: accent + '88' }]}
    >
      <Text style={styles.idxName}>{idx}</Text>

      {loading && !sig ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator color={accent} />
          <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 6 }}>Analyzing…</Text>
        </View>
      ) : sig?.error ? (
        <>
          <Text style={[styles.signalBig, { color: '#FFB800' }]}>WAIT</Text>
          <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 8 }}>
            {String(sig.error).slice(0, 60)}
          </Text>
          <Text style={{ color: colors.text.disabled, fontSize: 9, marginTop: 4 }}>
            {interval}M · {tsStr}
          </Text>
        </>
      ) : sig ? (
        <>
          <Text style={[styles.signalBig, { color: accent }]}>{sig.signal}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>
            Confidence: <Text style={{ color: '#fff', fontWeight: '900' }}>{Math.round(sig.confidence)}%</Text>
          </Text>
          {/* Confidence bar */}
          <View style={styles.confBarBg}>
            <View style={[styles.confBarFill, { width: `${Math.min(100, Math.max(0, sig.confidence))}%`, backgroundColor: accent }]} />
          </View>

          <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 8 }}>
            {sig.interval} • {tsStr}
          </Text>

          {sig.reason ? (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 8, lineHeight: 15 }} numberOfLines={3}>
              {sig.reason.length > 90 ? sig.reason.slice(0, 90) + '…' : sig.reason}
            </Text>
          ) : null}

          {sig.marketState ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 6 }}>
              Market: <Text style={{ color: '#fff' }}>{sig.marketState}</Text>
            </Text>
          ) : null}

          <View style={[styles.sentBadge, { backgroundColor: accent + '33', borderColor: accent }]}>
            <Text style={{ color: accent, fontSize: 11, fontWeight: '900' }}>{sentLabel}</Text>
          </View>
        </>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.base,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ivlRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2 },
  ivlBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  ivlBtnActive: { backgroundColor: '#7C5CFF' },
  idxCard: {
    width: 220,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 220,
  },
  idxName: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  signalBig: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  confBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6, overflow: 'hidden',
  },
  confBarFill: { height: 4, borderRadius: 2 },
  sentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1, marginTop: 10,
  },
  howItWorks: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bullet: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginVertical: 1 },
});
