import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

export default function JournalTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api.getJournal({ limit: 100 });
      setEntries(res?.entries || []);
      setStats(res?.stats || null);
    } catch {
      setEntries([]);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base, paddingBottom: 0 }}>
        <Heading variant="h3">Journal</Heading>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(i, idx) => i.id || String(idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base }}>
              <StatCard label="WIN RATE" value={`${stats?.winRate ?? 0}%`} color={colors.trading.profit} testID="journal-win-rate" />
              <StatCard
                label="TOTAL P&L"
                value={`₹${stats?.totalPnL?.toLocaleString('en-IN') || 0}`}
                color={(stats?.totalPnL || 0) >= 0 ? colors.trading.profit : colors.trading.loss}
                testID="journal-total-pnl"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <StatCard label="TRADES" value={String(stats?.totalTrades || 0)} color={colors.text.primary} />
              <StatCard label="AVG P&L" value={`₹${stats?.avgPnL || 0}`} color={colors.text.primary} />
            </View>
            <Text style={styles.section}>RECENT ENTRIES</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color="#fff" />
          ) : (
            <Card testID="journal-empty-state">
              <Image
                source={{ uri: 'https://images.pexels.com/photos/8250806/pexels-photo-8250806.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
                style={styles.emptyImg}
              />
              <Body style={{ textAlign: 'center', marginTop: spacing.base }}>
                No journal entries yet. Your completed trades will appear here.
              </Body>
            </Card>
          )
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value, color, testID }: { label: string; value: string; color: string; testID?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.label}>{label}</Text>
      <Text testID={testID} style={{ ...(typography.h3 as any), color, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function EntryCard({ entry }: { entry: any }) {
  const pnl = Number(entry.pnl || 0);
  const positive = pnl >= 0;
  return (
    <Card style={{ marginBottom: spacing.sm }} testID="journal-trade-entry">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{entry.symbol}</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 3 }}>
            Entry ₹{entry.entryPrice} → Exit ₹{entry.exitPrice} • Qty {entry.quantity}
          </Text>
          {entry.notes ? (
            <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
              "{entry.notes}"
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: positive ? colors.trading.profit : colors.trading.loss, fontWeight: '800', fontSize: 15 }}>
            {positive ? '+' : ''}₹{Math.abs(pnl)}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 10, marginTop: 2 }}>{entry.duration || ''}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  section: { ...(typography.caption as any), color: colors.text.secondary, marginBottom: spacing.sm },
  emptyImg: { width: '100%', height: 140, borderRadius: 8, opacity: 0.7 },
});
