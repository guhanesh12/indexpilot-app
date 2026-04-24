import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Heading, Body, Button, Input, Chip } from '../../src/components/Primitives';
import { colors, spacing, radius, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const CATS = ['general', 'billing', 'broker_request', 'technical'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;

export default function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api.getTickets();
      setTickets(res?.tickets || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Heading variant="h3">Support</Heading>
        <TouchableOpacity testID="new-ticket-button" onPress={() => setModal(true)} style={styles.newBtn}>
          <Ionicons name="add" size={18} color="#050505" />
          <Text style={{ color: '#050505', fontWeight: '700', fontSize: 13 }}>New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />
        }
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Body style={{ textAlign: 'center' }}>No tickets yet</Body>
            </Card>
          )
        }
        renderItem={({ item }) => <TicketRow ticket={item} />}
      />

      <NewTicketModal visible={modal} onClose={() => setModal(false)} onCreated={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function TicketRow({ ticket }: { ticket: any }) {
  const statusColor = ticket.status === 'open' ? colors.trading.profit : colors.text.secondary;
  return (
    <Card style={{ marginBottom: spacing.sm }} testID="support-ticket-row">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text.primary, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {ticket.subject}
        </Text>
        <View style={{ backgroundColor: colors.bg.tertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{String(ticket.status).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
        {ticket.message}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        <Text style={styles.meta}>{ticket.category}</Text>
        <Text style={styles.meta}>· {ticket.priority}</Text>
        <Text style={[styles.meta, { marginLeft: 'auto' }]}>
          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}
        </Text>
      </View>
    </Card>
  );
}

function NewTicketModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [cat, setCat] = useState<string>('general');
  const [prio, setPrio] = useState<string>('medium');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!subject || !message) return Alert.alert('Missing', 'Enter subject and message');
    setLoading(true);
    try {
      await api.createTicket({ subject, message, category: cat, priority: prio });
      onCreated();
      setSubject('');
      setMessage('');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalBody}>
          <View style={styles.handle} />
          <Heading variant="h3" style={{ marginBottom: spacing.base }}>New Ticket</Heading>
          <ScrollView>
            <Input label="Subject" value={subject} onChangeText={setSubject} testID="ticket-subject-input" />
            <Input
              label="Message"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              testID="ticket-message-input"
            />
            <Text style={styles.label}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm, marginTop: 6 }}>
              {CATS.map((c) => (
                <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </View>
            <Text style={styles.label}>PRIORITY</Text>
            <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: spacing.base }}>
              {PRIORITIES.map((p) => (
                <Chip key={p} label={p} active={prio === p} onPress={() => setPrio(p)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
              <Button title="Submit" onPress={submit} loading={loading} style={{ flex: 1 }} testID="submit-ticket-button" />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base },
  newBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: { color: colors.text.disabled, fontSize: 11 },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBody: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handle: { width: 48, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.base },
});
