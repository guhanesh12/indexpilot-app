import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, typography, spacing } from '../src/lib/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { ready, user, hasPin } = useAuth();
  const navigatedRef = useRef(false);

  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleY = useSharedValue(30);
  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.exp) });
    logoScale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.exp) });
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    titleY.value = withDelay(400, withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) }));
    taglineOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (!ready || navigatedRef.current) return;
    const t = setTimeout(() => {
      navigatedRef.current = true;
      if (!user) router.replace('/(auth)/login');
      else if (!hasPin) router.replace('/(auth)/pin-setup');
      else router.replace('/(auth)/pin-lock');
    }, 2200);
    return () => clearTimeout(t);
  }, [ready, user, hasPin]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: glowScale.value }] }));

  return (
    <View style={styles.container} testID="splash-screen-container">
      <Image
        source={{
          uri: 'https://images.unsplash.com/photo-1762279389002-7b6abd7bd6c6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMHN0b2NrJTIwbWFya2V0JTIwZGF0YSUyMGdyYXBofGVufDB8fHx8MTc3NzAzODMwMnww&ixlib=rb-4.1.0&q=85',
        }}
        style={styles.bgImage}
        blurRadius={6}
      />
      <LinearGradient
        colors={['rgba(5,5,5,0.3)', 'rgba(5,5,5,0.75)', '#050505']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <Animated.View style={[styles.glowRing, glowStyle]} />
        <Animated.View style={[styles.logoWrap, logoStyle]} testID="splash-logo">
          <LinearGradient
            colors={['#00FF66', '#F5E15C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Text style={styles.logoText}>IP</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text style={styles.title}>IndexPilot AI</Text>
        </Animated.View>

        <Animated.View style={taglineStyle}>
          <Text style={styles.tagline}>AI-POWERED OPTIONS TRADING</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, taglineStyle]}>
        <View style={styles.dot} />
        <Text style={styles.bottomText}>Initializing engine…</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  bgImage: {
    position: 'absolute',
    width,
    height,
    opacity: 0.45,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0, 255, 102, 0.08)',
    top: height / 2 - 200,
  },
  logoWrap: {
    marginBottom: spacing.lg,
    shadowColor: '#00FF66',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 40, fontWeight: '900', color: '#050505', letterSpacing: -1 },
  title: {
    ...(typography.h1 as any),
    color: colors.text.primary,
    textAlign: 'center',
  },
  tagline: {
    ...(typography.caption as any),
    color: colors.trading.profit,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.trading.profit,
  },
  bottomText: { color: colors.text.secondary, fontSize: 12, letterSpacing: 1 },
});
