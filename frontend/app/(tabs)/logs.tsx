import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Heading, Body, Chip } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const TYPES = ['ALL', 'SIGNAL', 'ORDER', 'INFO', 'ERROR'];

const typeColor = (t: string) => {
  switch ((t || '').toUpperCase()) {
    case 'ERROR':
      return colors.trading.loss;
    case 'ORDER':
      return colors.trading.warning;
    case 'SIGNAL':
      return colors.trading.profit;
    default:
      return colors.text.secondary;
  }
};

export default function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const res: any = await api.getLogs();
      setLogs(res?.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = () => {
    Alert.alert('Clear all logs', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.clearLogs();
            setLogs([]);
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  const filtered = filter === 'ALL' ? logs : logs.filter((l) => (l.type || '').toUpperCase() === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Heading variant="h3">Logs</Heading>
        <TouchableOpacity testID="logs-clear-button" onPress={clearAll}>
          <Ionicons name="trash-outline" size={20} color={colors.trading.loss} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.base }}>
        {TYPES.map((t) => (
          <Chip key={t} label={t} active={filter === t} onPress={() => setFilter(t)} testID={`log-filter-${t.toLowerCase()}`} />
        ))}
      </ScrollView>

      <FlatList
        testID="logs-terminal-view"
        data={filtered}
        keyExtractor={(i, idx) => i.id || String(idx)}
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="terminal-outline" size={40} color={colors.text.disabled} />
            <Body style={{ textAlign: 'center', marginTop: spacing.base }}>No logs yet. Signals and orders will appear here.</Body>
          </View>
        }
        renderItem={({ item }) => <LogRow item={item} />}
      />
    </SafeAreaView>
  );
}

function LogRow({ item }: { item: any }) {
  const col = typeColor(item.type);
  const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString('en-GB') : '';
  return (
    <View style={styles.logRow} testID="log-entry">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.typeBadge, { borderColor: col }]}>
          <Text style={{ color: col, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{(item.type || 'INFO').toUpperCase()}</Text>
        </View>
        <Text style={styles.time}>{time}</Text>
      </View>
      <Text style={styles.msg}>{item.message}</Text>
      {item.details ? (
        <Text style={styles.details}>{JSON.stringify(item.details)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base },
  logRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border.default,
    paddingLeft: spacing.base,
    paddingVertical: 8,
    marginBottom: 6,
  },
  typeBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  time: { color: colors.text.disabled, fontSize: 10, fontVariant: ['tabular-nums'] },
  msg: { color: colors.text.primary, fontSize: 12, marginTop: 6, lineHeight: 16 },
  details: { color: colors.text.secondary, fontSize: 10, marginTop: 4, fontFamily: 'monospace' },
  empty: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
});
