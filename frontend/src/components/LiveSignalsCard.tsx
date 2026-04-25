import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, spacing, radius } from '../lib/theme';

type Signal = {
  id?: string;
  symbol?: string;
  index?: string;
  signalType?: string;
  side?: string;
  action?: string;
  price?: number;
  ltp?: number;
  reason?: string;
  confidence?: number;
  timestamp?: string;
  createdAt?: string;
  created_at?: string;
  type?: string;
  message?: string;
};

function parseLogs(raw: any): Signal[] {
  const list = raw?.logs || raw?.data || raw?.entries || raw?.items || (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((l: any) => {
      const t = String(l.type || l.category || l.level || '').toLowerCase();
      const m = String(l.message || l.text || '').toLowerCase();
      return (
        t.includes('signal') ||
        t.includes('trade') ||
        t.includes('order') ||
        t.includes('buy') ||
        t.includes('sell') ||
        m.includes('signal') ||
        m.includes('buy') ||
        m.includes('sell') ||
        m.includes('ce') ||
        m.includes('pe')
      );
    })
    .slice(0, 20);
}

export default function LiveSignalsCard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r: any = await api.getLogs();
      const filtered = parseLogs(r);
      setSignals(filtered);
      setUpdatedAt(new Date());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(t);
  }, [load]);

  const visible = expanded ? signals : signals.slice(0, 3);

  return (
    <LinearGradient colors={['#0F0A2E', '#0A0820']} style={styles.card}>
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={styles.pulse} />
          <Text style={styles.title}>📡 LIVE SIGNALS</Text>
          {signals.length ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{signals.length}</Text>
            </View>
          ) : null}
        </View>
        {updatedAt ? (
          <Text style={{ color: colors.text.disabled, fontSize: 10 }}>
            ↻ {Math.floor((Date.now() - updatedAt.getTime()) / 1000)}s
          </Text>
        ) : null}
      </View>

      {loading && !signals.length ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#7C5CFF" />
          <Text style={{ color: colors.text.disabled, marginTop: 8, fontSize: 11 }}>Listening to engine…</Text>
        </View>
      ) : signals.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="radio-outline" size={32} color={colors.text.disabled} />
          <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            Waiting for next candle close...
          </Text>
          <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 4, textAlign: 'center' }}>
            Engine pushes signals every 5/15-min interval
          </Text>
        </View>
      ) : (
        <>
          {visible.map((s, i) => <SignalRow key={s.id || i} sig={s} />)}
          {signals.length > 3 ? (
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
              <Text style={{ color: '#7C5CFF', fontSize: 12, fontWeight: '700' }}>
                {expanded ? 'Show less' : `Show all ${signals.length} signals`}
              </Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#7C5CFF" />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </LinearGradient>
  );
}

function SignalRow({ sig }: { sig: Signal }) {
  const text = String(sig.message || sig.reason || '').toLowerCase();
  const isBuy = (sig.side || sig.action || sig.signalType || '').toLowerCase().includes('buy') || text.includes('buy') || text.includes(' ce ');
  const isSell = (sig.side || sig.action || sig.signalType || '').toLowerCase().includes('sell') || text.includes('sell') || text.includes(' pe ');
  const color = isBuy ? '#00FF66' : isSell ? '#FF3344' : '#FFB800';
  const ts = sig.timestamp || sig.createdAt || sig.created_at;
  const timeStr = ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
  const symbol = sig.symbol || sig.index || (sig.message ? String(sig.message).split(' ')[0] : '—');
  const message = String(sig.message || sig.reason || `${sig.action || sig.side || 'Signal'} ${sig.symbol || ''}`);

  return (
    <View style={[styles.row, { borderLeftColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
            {symbol}
          </Text>
          <View style={{ backgroundColor: color + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
            <Text style={{ color, fontSize: 9, fontWeight: '900' }}>
              {isBuy ? 'BUY' : isSell ? 'SELL' : 'INFO'}
            </Text>
          </View>
          {timeStr ? <Text style={{ color: colors.text.disabled, fontSize: 10, marginLeft: 'auto' }}>{timeStr}</Text> : null}
        </View>
        <Text numberOfLines={2} style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
          {message.length > 100 ? message.slice(0, 100) + '…' : message}
        </Text>
        {sig.price || sig.ltp ? (
          <Text style={{ color: '#7C5CFF', fontSize: 10, marginTop: 3, fontWeight: '700' }}>
            @ ₹{sig.price || sig.ltp}{sig.confidence ? ` · ${Math.round((sig.confidence || 0) * 100)}% conf` : ''}
          </Text>
        ) : null}
      </View>
    </View>
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
  title: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3344' },
  countPill: {
    backgroundColor: 'rgba(255,77,210,0.2)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,77,210,0.4)',
  },
  countText: { color: '#FF4DD2', fontSize: 10, fontWeight: '900' },
  empty: { paddingVertical: 28, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  expandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, gap: 4, marginTop: 4,
  },
});
