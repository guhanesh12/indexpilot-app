import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Heading, Body, Button, Input } from '../../src/components/Primitives';
import { colors, spacing, radius, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { Storage } from '../../src/lib/storage';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];

type Instrument = {
  securityId: string;
  tradingSymbol: string;
  name?: string;
  expiry?: string;
  strike?: number;
  optionType?: string;
  exchange?: string;
};

type UserSymbol = {
  id: string;
  name: string;
  index: string;
  securityId: string;
  exchangeSegment: string;
  autoTrade?: boolean;
  quantity?: number;
  targetAmount?: number;
  stopLossAmount?: number;
  isActive?: boolean;
};

export default function SymbolsTab() {
  const [activeIndex, setActiveIndex] = useState('NIFTY');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [instruments, setInstruments] = useState<Record<string, Instrument[]>>({});
  const [userSymbols, setUserSymbols] = useState<UserSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configFor, setConfigFor] = useState<Instrument | null>(null);

  const loadUserSymbols = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.getSymbols();
      setUserSymbols(res?.symbols || []);
    } catch {
      setUserSymbols([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCached = useCallback(async () => {
    const cache: Record<string, Instrument[]> = {};
    for (const idx of INDICES) {
      const c = await Storage.getInstruments(idx);
      if (c?.data) cache[idx] = c.data;
    }
    setInstruments(cache);
  }, []);

  useEffect(() => {
    loadUserSymbols();
    loadCached();
  }, [loadUserSymbols, loadCached]);

  const downloadInstruments = async () => {
    setDownloading(true);
    try {
      const updated: Record<string, Instrument[]> = { ...instruments };
      for (const idx of INDICES) {
        try {
          const res: any = await api.searchInstruments(idx, 'NSE_FNO');
          const list = res?.instruments || [];
          updated[idx] = list;
          await Storage.saveInstruments(idx, list);
        } catch {
          // skip
        }
      }
      setInstruments(updated);
      Alert.alert('Downloaded', 'Instruments cached locally for offline use');
    } catch (e: any) {
      Alert.alert('Download failed', e.message);
    } finally {
      setDownloading(false);
    }
  };

  const activeInstruments = (instruments[activeIndex] || []).filter((i) =>
    search ? (i.tradingSymbol || '').toLowerCase().includes(search.toLowerCase()) : true
  );

  const addSymbolToServer = async (inst: Instrument, cfg: { qty: number; target: number; sl: number; autoTrade: boolean }) => {
    try {
      await api.saveSymbol({
        name: inst.tradingSymbol,
        index: activeIndex,
        securityId: inst.securityId,
        exchangeSegment: inst.exchange || 'NSE_FNO',
        autoTrade: cfg.autoTrade,
        quantity: cfg.qty,
        targetAmount: cfg.target,
        stopLossAmount: cfg.sl,
      });
      Alert.alert('Added', `${inst.tradingSymbol} saved to server`);
      loadUserSymbols();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  const deleteSymbol = async (id: string) => {
    try {
      await api.saveSymbol({ action: 'delete', id });
      loadUserSymbols();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base }}>
          <Heading variant="h3">Symbols</Heading>
          <TouchableOpacity
            testID="download-instruments-button"
            onPress={downloadInstruments}
            disabled={downloading}
            style={styles.downloadBtn}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={16} color="#050505" />
                <Text style={styles.downloadText}>Download</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.text.secondary} />
          <TextInput
            testID="symbols-search-input"
            placeholder="Search instruments..."
            placeholderTextColor={colors.text.disabled}
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          {INDICES.map((i) => (
            <Chip
              key={i}
              label={i}
              active={activeIndex === i}
              onPress={() => setActiveIndex(i)}
              testID={`filter-chip-${i.toLowerCase()}`}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={userSymbols}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>
              YOUR SYMBOLS ({userSymbols.length})
            </Text>
            {loading ? <ActivityIndicator color={colors.text.primary} style={{ margin: spacing.lg }} /> : null}
            {userSymbols.length === 0 && !loading ? (
              <Card style={{ marginBottom: spacing.base }}>
                <Body style={{ textAlign: 'center' }}>No symbols added yet. Tap a cached instrument below to add it.</Body>
              </Card>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }} testID="symbol-list-item">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>{item.name}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 3 }}>
                  {item.index} • Qty {item.quantity || 1} • T ₹{item.targetAmount || 0} • SL ₹{item.stopLossAmount || 0}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  testID="auto-trade-toggle"
                  style={[styles.badge, { backgroundColor: item.autoTrade ? 'rgba(0,255,102,0.1)' : colors.bg.tertiary }]}
                >
                  <Text style={{ color: item.autoTrade ? colors.trading.profit : colors.text.secondary, fontSize: 10, fontWeight: '700' }}>
                    {item.autoTrade ? 'AUTO' : 'MANUAL'}
                  </Text>
                </View>
                <TouchableOpacity testID="delete-symbol" onPress={() => deleteSymbol(item.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.trading.loss} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              CACHED INSTRUMENTS — {activeIndex} ({activeInstruments.length})
            </Text>
            {activeInstruments.length === 0 ? (
              <Card>
                <Body style={{ textAlign: 'center' }}>
                  {instruments[activeIndex] ? 'No matches for your search' : 'Tap Download to cache instruments'}
                </Body>
              </Card>
            ) : (
              activeInstruments.slice(0, 40).map((inst) => (
                <TouchableOpacity
                  key={inst.securityId}
                  onPress={() => setConfigFor(inst)}
                  style={styles.instRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{inst.tradingSymbol}</Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 10, marginTop: 2 }}>
                      {inst.optionType || ''} {inst.strike || ''} • {inst.expiry || ''}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.trading.profit} />
                </TouchableOpacity>
              ))
            )}
          </>
        }
      />

      <AddSymbolModal
        inst={configFor}
        onClose={() => setConfigFor(null)}
        onSave={(cfg) => {
          if (configFor) {
            addSymbolToServer(configFor, cfg);
            setConfigFor(null);
          }
        }}
      />
    </SafeAreaView>
  );
}

function AddSymbolModal({
  inst,
  onClose,
  onSave,
}: {
  inst: Instrument | null;
  onClose: () => void;
  onSave: (cfg: { qty: number; target: number; sl: number; autoTrade: boolean }) => void;
}) {
  const [qty, setQty] = useState('1');
  const [target, setTarget] = useState('500');
  const [sl, setSl] = useState('200');
  const [autoTrade, setAutoTrade] = useState(true);

  return (
    <Modal visible={!!inst} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalBody}>
          <View style={styles.modalHandle} />
          <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
            Add {inst?.tradingSymbol}
          </Heading>
          <Body style={{ marginBottom: spacing.base }}>
            Configure auto-trade parameters
          </Body>
          <Input label="Quantity" keyboardType="number-pad" value={qty} onChangeText={setQty} testID="symbol-qty-input" />
          <Input label="Target Amount (₹)" keyboardType="number-pad" value={target} onChangeText={setTarget} testID="symbol-target-input" />
          <Input label="Stop Loss Amount (₹)" keyboardType="number-pad" value={sl} onChangeText={setSl} testID="symbol-sl-input" />
          <View style={styles.switchRow}>
            <Text style={{ color: colors.text.primary, fontSize: 14 }}>Auto Trade</Text>
            <Switch
              testID="symbol-autotrade-switch"
              value={autoTrade}
              onValueChange={setAutoTrade}
              trackColor={{ true: colors.trading.profit, false: colors.border.default }}
              thumbColor="#fff"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
            <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
            <Button
              testID="confirm-add-symbol"
              title="Add Symbol"
              onPress={() =>
                onSave({ qty: parseInt(qty || '1', 10), target: parseFloat(target || '0'), sl: parseFloat(sl || '0'), autoTrade })
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  downloadBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadText: { color: '#050505', fontWeight: '700', fontSize: 13 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  search: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: 12,
    fontSize: 14,
  },
  sectionTitle: {
    ...(typography.caption as any),
    color: colors.text.secondary,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBody: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    width: 48,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
});
