import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Body, Heading } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { Storage } from '../../src/lib/storage';

const INDICES = ['ALL', 'NIFTY', 'BANKNIFTY', 'SENSEX'];
const OPT_TYPES = ['ALL', 'CE', 'PE'];

type Inst = {
  tradingSymbol: string;
  displaySymbol?: string;
  securityId: string;
  strike: number;
  expiry: string;
  optionType: string;
  lot: number;
  exchange: string;
  index: string;
};

export default function SymbolsTab() {
  const [downloading, setDownloading] = useState(false);
  const [bundle, setBundle] = useState<{ NIFTY: Inst[]; BANKNIFTY: Inst[]; SENSEX: Inst[] } | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<any>({});
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState('ALL');
  const [opt, setOpt] = useState('ALL');
  const [active, setActive] = useState<Inst | null>(null);
  const [userSymbols, setUserSymbols] = useState<any[]>([]);

  // Load cached
  useEffect(() => {
    (async () => {
      const c = await Storage.getInstruments('dhan_bundle');
      if (c?.data) {
        setBundle(c.data.instruments);
        setTotal(c.data.total);
        setCounts(c.data.counts);
      }
      // Load user-saved symbols
      try {
        const r: any = await api.getSymbols();
        const arr = r?.symbols || r?.data || [];
        setUserSymbols(Array.isArray(arr) ? arr : []);
      } catch {}
    })();
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const r: any = await api.fetchDhanInstruments(true);
      if (r?.success) {
        setBundle(r.instruments);
        setTotal(r.total);
        setCounts(r.counts);
        await Storage.saveInstruments('dhan_bundle', r);
        Alert.alert(
          'Downloaded',
          `Total: ${r.total.toLocaleString()}\nNIFTY: ${r.counts.NIFTY}\nBANKNIFTY: ${r.counts.BANKNIFTY}\nSENSEX: ${r.counts.SENSEX}`
        );
      } else {
        Alert.alert('Failed', r?.error || 'Download failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!bundle) return [];
    // Only show results when user types in search OR picks specific filter (not ALL/ALL)
    const hasFilter = search.trim().length > 0 || idx !== 'ALL' || opt !== 'ALL';
    if (!hasFilter) return [];
    let list: Inst[] = [];
    if (idx === 'ALL') list = [...bundle.NIFTY, ...bundle.BANKNIFTY, ...bundle.SENSEX];
    else list = (bundle as any)[idx] || [];
    if (opt !== 'ALL') list = list.filter((i) => i.optionType === opt);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) => i.tradingSymbol.toLowerCase().includes(q) || String(i.strike).includes(q)
      );
    }
    return list.slice(0, 80);
  }, [bundle, idx, opt, search]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base, paddingBottom: 0 }}>
        <Heading variant="h3" style={{ marginBottom: spacing.sm }}>Instrument Selector</Heading>

        {bundle ? (
          <LinearGradient colors={['#053D2C', '#001F12']} style={styles.readyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#00FF66" />
              <Text style={{ color: '#00FF66', fontWeight: '800', fontSize: 14 }}>
                Instruments ready for trading
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pill bg="rgba(0,255,102,0.15)" fg="#00FF66" text={`Total: ${total.toLocaleString()}`} />
              <Pill bg="rgba(124,92,255,0.18)" fg="#7C5CFF" text={`Filtered: ${filtered.length}`} />
            </View>
            <Text style={{ color: 'rgba(0,255,102,0.7)', fontSize: 11, marginTop: 8 }}>
              ✓ Stored locally on device
            </Text>
          </LinearGradient>
        ) : (
          <View style={styles.notReadyCard}>
            <Ionicons name="cloud-download-outline" size={32} color="#7C5CFF" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>No instruments loaded</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Download once per week from Dhan (~2MB, NIFTY/BANKNIFTY/SENSEX options)
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={download} disabled={downloading} style={styles.dlBtn} testID="download-instruments-button">
          <LinearGradient colors={['#00FFE0', '#7C5CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dlGrad}>
            {downloading ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <>
                <Ionicons name="cloud-download" size={18} color="#050505" />
                <Text style={{ color: '#050505', fontWeight: '800' }}>
                  {bundle ? 'Refresh Instruments' : 'Download Instruments'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Filters */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          <FilterDropdown label="Index" value={idx} options={INDICES} onChange={setIdx} />
          <FilterDropdown label="Option Type" value={opt} options={OPT_TYPES} onChange={setOpt} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.text.secondary} />
          <TextInput
            placeholder="Search by symbol or strike..."
            placeholderTextColor={colors.text.disabled}
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i, k) => i.securityId + k}
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 100 }}
        ListHeaderComponent={
          userSymbols.length ? (
            <LinearGradient colors={['#053D2C', '#001F12']} style={styles.activeBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={16} color="#00FF66" />
                <Text style={{ color: '#00FF66', fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>
                  ✓ YOUR ACTIVE SYMBOLS ({userSymbols.length})
                </Text>
              </View>
              {userSymbols.map((s, i) => (
                <UserSymRow
                  key={s.id || i}
                  sym={s}
                  onDelete={async () => {
                    Alert.alert('Remove symbol', `Remove ${s.symbol_name || s.name} from auto-trading?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove', style: 'destructive', onPress: async () => {
                          try {
                            const remaining = userSymbols.filter((x: any) => (x.id || x.symbol_id) !== (s.id || s.symbol_id));
                            await api.saveSymbols(remaining);
                            setUserSymbols(remaining);
                          } catch (e: any) { Alert.alert('Failed', e.message); }
                        }
                      }
                    ]);
                  }}
                />
              ))}
              <Text style={{ color: 'rgba(0,255,102,0.6)', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                Auto-trade enabled · Synced with website
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.noActive}>
              <Ionicons name="bookmark-outline" size={20} color={colors.text.disabled} />
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginLeft: 8 }}>
                No active symbols yet — Add from below ↓
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          bundle ? (
            <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 24 }}>
              No matches. Try a different filter or search.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <InstCard
            inst={item}
            onSaved={async () => {
              try {
                const r: any = await api.getSymbols();
                setUserSymbols(r?.symbols || r?.data || []);
              } catch {}
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

function FilterDropdown({ label, value, options, onChange }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </Text>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.dd}>
        <Text style={{ color: '#fff', fontSize: 14 }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.secondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.ddMenu}>
          {options.map((o: string) => (
            <TouchableOpacity
              key={o}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              style={styles.ddItem}
            >
              <Text style={{ color: o === value ? '#00FFE0' : '#fff', fontSize: 13 }}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function Pill({ bg, fg, text }: any) {
  return (
    <View style={{ backgroundColor: bg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

function InstCard({ inst, onSaved }: { inst: Inst; onSaved: () => void }) {
  const isCall = inst.optionType === 'CE';
  const accent = isCall ? '#00FF66' : '#FF3344';
  const [qty, setQty] = useState(inst.lot || 1);
  const [target, setTarget] = useState('3000');
  const [sl, setSl] = useState('2000');
  const [trail, setTrail] = useState(false);
  const [trailActivate, setTrailActivate] = useState('100');
  const [trailTarget, setTrailTarget] = useState('50');
  const [trailSL, setTrailSL] = useState('50');
  const [saving, setSaving] = useState(false);

  const apiSymbol = `${inst.index}-${formatExpiry(inst.expiry)}-${inst.strike}-${inst.optionType}`;

  const lots = Math.max(1, Math.floor(qty / inst.lot));
  const dec = () => setQty(Math.max(inst.lot, qty - inst.lot));
  const inc = () => setQty(qty + inst.lot);

  const save = async () => {
    setSaving(true);
    try {
      // Get existing then append (server's /symbols/save replaces all)
      let existing: any[] = [];
      try {
        const r: any = await api.getSymbols();
        existing = r?.symbols || r?.data || [];
      } catch {}
      const newSym = {
        id: `sym_${Date.now()}`,
        name: apiSymbol,
        index: inst.index,
        securityId: inst.securityId,
        exchangeSegment: inst.exchange,
        tradingSymbol: inst.tradingSymbol,
        optionType: inst.optionType,
        strike: inst.strike,
        expiry: inst.expiry,
        quantity: qty,
        lot: inst.lot,
        targetAmount: parseFloat(target) || 0,
        stopLossAmount: parseFloat(sl) || 0,
        trailingEnabled: trail,
        trailingActivateAt: trail ? parseFloat(trailActivate) || 0 : 0,
        trailingTargetIncrement: trail ? parseFloat(trailTarget) || 0 : 0,
        trailingSLDecrement: trail ? parseFloat(trailSL) || 0 : 0,
        active: true,
        autoTrade: true,
      };
      const merged = [...existing.filter((x: any) => x.name !== apiSymbol), newSym];
      await api.saveSymbols(merged);
      Alert.alert('Added', `${apiSymbol} saved to trading list`);
      onSaved();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.instCard, { borderColor: accent + '55' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, flex: 1 }}>
          {inst.index} {formatExpiry(inst.expiry)} {inst.strike} {isCall ? 'CALL' : 'PUT'}
        </Text>
        <View style={{ backgroundColor: 'rgba(124,92,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
          <Text style={{ color: '#7C5CFF', fontSize: 10, fontWeight: '800' }}>{inst.index}</Text>
        </View>
        <View style={{ backgroundColor: accent + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
          <Text style={{ color: accent, fontSize: 10, fontWeight: '800' }}>{inst.optionType}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.metaText}>Strike: <Text style={{ color: '#fff' }}>{inst.strike}</Text></Text>
          <Text style={styles.metaText}>Expiry: <Text style={{ color: '#fff' }}>{inst.expiry}</Text></Text>
          <Text style={[styles.metaText, { fontFamily: 'monospace' }]}>API: <Text style={{ color: colors.text.disabled }}>{apiSymbol}</Text></Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text.secondary, fontSize: 11 }}>Lot:</Text>
          <Text style={{ color: '#00FF66', fontWeight: '800', fontSize: 16 }}>{inst.lot}</Text>
        </View>
      </View>

      {/* Quantity stepper */}
      <View style={{ marginTop: 10 }}>
        <Text style={styles.fieldLabel}>📦 Quantity</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <TouchableOpacity onPress={dec} style={styles.qtyBtn}><Text style={{ color: '#fff', fontSize: 18 }}>−</Text></TouchableOpacity>
          <View style={styles.qtyBox}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{qty}</Text>
          </View>
          <TouchableOpacity onPress={inc} style={[styles.qtyBtn, { borderColor: '#00FF66' }]}>
            <Text style={{ color: '#00FF66', fontSize: 18 }}>+</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text.secondary, fontSize: 11 }}>({lots} lots)</Text>
        </View>
      </View>

      {/* Target / SL */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: '#00FF66' }]}>🎯 Target (₹)</Text>
          <TextInput keyboardType="number-pad" value={target} onChangeText={setTarget} style={[styles.inputField, { borderColor: '#00FF6655' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: '#FF3344' }]}>🛑 Stop Loss (₹)</Text>
          <TextInput keyboardType="number-pad" value={sl} onChangeText={setSl} style={[styles.inputField, { borderColor: '#FF334455' }]} />
        </View>
      </View>

      {/* Trailing SL */}
      <View style={styles.trailRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="flash" size={14} color="#7C5CFF" />
          <Text style={{ color: '#7C5CFF', fontWeight: '700', fontSize: 13 }}>Trailing Stop Loss</Text>
        </View>
        <Switch value={trail} onValueChange={setTrail} trackColor={{ true: '#7C5CFF', false: '#333' }} thumbColor="#fff" />
      </View>

      {trail && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#FFD700' }]}>💰 Activate @</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailActivate}
              onChangeText={setTrailActivate}
              style={[styles.inputField, { borderColor: '#FFD70066' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#00FF66' }]}>📈 Target +</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailTarget}
              onChangeText={setTrailTarget}
              style={[styles.inputField, { borderColor: '#00FF6655' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#FF7A00' }]}>🔻 SL −</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailSL}
              onChangeText={setTrailSL}
              style={[styles.inputField, { borderColor: '#FF7A0055' }]}
            />
          </View>
        </View>
      )}

      <TouchableOpacity onPress={save} disabled={saving} style={[styles.addBtn, { backgroundColor: accent }]}>
        {saving ? (
          <ActivityIndicator color="#050505" />
        ) : (
          <>
            <Ionicons name="add" size={18} color="#050505" />
            <Text style={{ color: '#050505', fontWeight: '800', fontSize: 14 }}>Add to Trading</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function UserSymRow({ sym, onDelete }: { sym: any; onDelete?: () => void }) {
  // Server returns: { symbol_name, option_type, lot_size, strike_price, expiry, raw_data: {...} }
  const name = sym.symbol_name || sym.name || sym.tradingSymbol || 'Unknown';
  const optType = (sym.option_type || sym.optionType || (sym.raw_data?.optionType) || '').toUpperCase();
  const isCall = optType === 'CE';
  const color = isCall ? '#00FF66' : '#FF3344';
  const qty = sym.quantity || sym.lot_size || (sym.raw_data?.quantity) || 0;
  const target = sym.targetAmount || (sym.raw_data?.targetAmount) || (sym.raw_data?.raw_data?.targetAmount) || 0;
  const sl = sym.stopLossAmount || (sym.raw_data?.stopLossAmount) || (sym.raw_data?.raw_data?.stopLossAmount) || 0;
  const trail = sym.trailingEnabled || (sym.raw_data?.trailingEnabled) || false;

  return (
    <View style={[styles.userRow, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>
          Qty {qty} • T ₹{target} • SL ₹{sl}{trail ? ' • Trail' : ''}
        </Text>
      </View>
      <View style={{ backgroundColor: color + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 6 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '900' }}>{isCall ? 'CALL' : 'PUT'}</Text>
      </View>
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,51,68,0.12)' }}>
          <Ionicons name="trash-outline" size={14} color="#FF3344" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function formatExpiry(d: string) {
  // 2026-04-28 → Apr2026
  if (!d || !d.includes('-')) return d;
  const [y, m] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]}${y}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  readyCard: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#00FF6655',
  },
  notReadyCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  dlBtn: { marginTop: spacing.base, borderRadius: radius.sm, overflow: 'hidden' },
  dlGrad: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dd: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.4)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ddMenu: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
    zIndex: 10,
  },
  ddItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.4)',
    marginTop: spacing.sm,
  },
  search: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 14 },
  section: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  instCard: {
    backgroundColor: '#0A0820',
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
  },
  metaText: { color: colors.text.secondary, fontSize: 11, marginVertical: 1 },
  fieldLabel: { color: colors.text.secondary, fontSize: 11, fontWeight: '700' },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputField: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  trailRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,92,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.25)',
  },
  addBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  userRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  activeBlock: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#00FF6655',
    marginBottom: spacing.lg,
  },
  noActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
  },
});
