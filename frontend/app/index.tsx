import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, typography, spacing } from '../src/lib/theme';

const { width, height } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function SplashScreen() {
  const router = useRouter();
  const { ready, user, hasPin } = useAuth();
  const navigatedRef = useRef(false);

  const ringOuter = useSharedValue(0);
  const ringMid = useSharedValue(0);
  const ringInner = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const titleY = useSharedValue(40);
  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const dashOffset = useSharedValue(280);
  const orbitRotate = useSharedValue(0);

  useEffect(() => {
    // Staggered ring expansion
    ringOuter.value = withDelay(0, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    ringMid.value = withDelay(150, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    ringInner.value = withDelay(300, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));

    // Logo pop + rotate
    logoScale.value = withDelay(450, withSequence(
      withTiming(1.18, { duration: 380, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(1, { duration: 200 })
    ));
    logoRotate.value = withDelay(450, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Title and tagline
    titleY.value = withDelay(700, withTiming(0, { duration: 700, easing: Easing.out(Easing.exp) }));
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 700 }));
    taglineOpacity.value = withDelay(1100, withTiming(1, { duration: 600 }));

    // Animated SVG dash and orbit
    dashOffset.value = withDelay(0, withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) }));
    orbitRotate.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
  }, []);

  useEffect(() => {
    if (!ready || navigatedRef.current) return;
    const t = setTimeout(() => {
      navigatedRef.current = true;
      if (!user) router.replace('/(auth)/login');
      else if (!hasPin) router.replace('/(auth)/pin-setup');
      else router.replace('/(auth)/pin-lock');
    }, 2400);
    return () => clearTimeout(t);
  }, [ready, user, hasPin]);

  const ringOuterStyle = useAnimatedStyle(() => ({
    opacity: ringOuter.value * 0.35,
    transform: [{ scale: 0.6 + ringOuter.value * 0.6 }],
  }));
  const ringMidStyle = useAnimatedStyle(() => ({
    opacity: ringMid.value * 0.55,
    transform: [{ scale: 0.6 + ringMid.value * 0.55 }],
  }));
  const ringInnerStyle = useAnimatedStyle(() => ({
    opacity: ringInner.value * 0.85,
    transform: [{ scale: 0.6 + ringInner.value * 0.5 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value * 360}deg` },
    ],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const dashProps = useAnimatedStyle(() => ({}));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotate.value * 360}deg` }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020010', '#06051F', '#080425', '#040012']}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        {/* Concentric rings */}
        <Animated.View style={[styles.ring, styles.ringOuter, ringOuterStyle]} />
        <Animated.View style={[styles.ring, styles.ringMid, ringMidStyle]} />
        <Animated.View style={[styles.ring, styles.ringInner, ringInnerStyle]} />

        {/* SVG progress arc */}
        <View style={styles.svgWrap} pointerEvents="none">
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Defs>
              <SvgGrad id="g1" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#00FFE0" />
                <Stop offset="0.5" stopColor="#7C5CFF" />
                <Stop offset="1" stopColor="#FF4DD2" />
              </SvgGrad>
            </Defs>
            <Circle cx="110" cy="110" r="92" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none" />
            <Circle
              cx="110"
              cy="110"
              r="92"
              stroke="url(#g1)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={580}
              strokeDashoffset={120}
              transform="rotate(-90 110 110)"
            />
          </Svg>
        </View>

        {/* Orbiting dots */}
        <Animated.View style={[styles.orbit, orbitStyle]}>
          <View style={[styles.orbitDot, { backgroundColor: '#00FFE0', top: -4 }]} />
          <View style={[styles.orbitDot, { backgroundColor: '#FF4DD2', bottom: -4, alignSelf: 'flex-end' }]} />
        </Animated.View>

        {/* Animated logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <LinearGradient
            colors={['#00FFE0', '#7C5CFF', '#FF4DD2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Svg width={50} height={50} viewBox="0 0 50 50">
              <Defs>
                <SvgGrad id="up" x1="0" y1="1" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" />
                  <Stop offset="1" stopColor="#FFFFFF" />
                </SvgGrad>
              </Defs>
              {/* Bull-like up arrow */}
              <Circle cx="25" cy="25" r="24" stroke="#fff" strokeWidth="0" fill="rgba(255,255,255,0.0)" />
              <Animated.View />
            </Svg>
            <Text style={styles.logoText}>IP</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text style={styles.title}>IndexPilot AI</Text>
        </Animated.View>

        <Animated.View style={taglineStyle}>
          <View style={styles.taglineRow}>
            <View style={[styles.dot, { backgroundColor: '#00FFE0' }]} />
            <Text style={[styles.tagline, { color: '#00FFE0' }]}>AI POWERED</Text>
            <View style={[styles.dot, { backgroundColor: '#7C5CFF' }]} />
            <Text style={[styles.tagline, { color: '#7C5CFF' }]}>OPTIONS TRADING</Text>
            <View style={[styles.dot, { backgroundColor: '#FF4DD2' }]} />
            <Text style={[styles.tagline, { color: '#FF4DD2' }]}>NSE · BSE</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, taglineStyle]}>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <PulseDot key={i} delay={i * 200} />
          ))}
        </View>
        <Text style={styles.bottomText}>Initializing AI engine</Text>
      </Animated.View>
    </View>
  );
}

function PulseDot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.5);
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.5, { duration: 500 })
        ),
        -1,
        false
      )
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.dotSm, style]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020010' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ringOuter: {
    width: 320,
    height: 320,
    borderColor: '#00FFE0',
  },
  ringMid: {
    width: 240,
    height: 240,
    borderColor: '#7C5CFF',
  },
  ringInner: {
    width: 170,
    height: 170,
    borderColor: '#FF4DD2',
  },
  svgWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbit: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logoWrap: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { position: 'absolute', fontSize: 38, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  title: {
    ...(typography.h1 as any),
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 36,
    letterSpacing: -1,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.base,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  bottom: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingDots: { flexDirection: 'row', gap: 6 },
  dotSm: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C5CFF' },
  bottomText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
});
