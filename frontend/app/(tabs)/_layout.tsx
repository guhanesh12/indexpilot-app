import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00FFE0',
        tabBarInactiveTintColor: colors.text.disabled,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border.default,
          borderTopWidth: 1,
          height: 70,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="symbols" options={{ title: 'Symbols', tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="broker" options={{ title: 'Broker', tabBarIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="support" options={{ title: 'Support', tabBarIcon: ({ color, size }) => <Ionicons name="help-circle-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="logs" options={{ title: 'Logs', tabBarIcon: ({ color, size }) => <Ionicons name="terminal-outline" size={size - 2} color={color} /> }} />
      <Tabs.Screen name="strategies" options={{ href: null }} />
    </Tabs>
  );
}
