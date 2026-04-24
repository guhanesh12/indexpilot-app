export const colors = {
  bg: { primary: '#050505', secondary: '#0F0F13', tertiary: '#16161A' },
  text: { primary: '#FFFFFF', secondary: '#8A8A93', disabled: '#45454B' },
  brand: { primary: '#FFFFFF', accent: '#F5E15C' },
  trading: { profit: '#00FF66', loss: '#FF3344', warning: '#FFB800' },
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(255, 255, 255, 0.3)',
    profit: 'rgba(0, 255, 102, 0.2)',
    loss: 'rgba(255, 51, 68, 0.2)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  huge: 48,
};

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 100 };

export const typography = {
  h1: { fontSize: 40, lineHeight: 48, letterSpacing: -1, fontWeight: '800' as const },
  h2: { fontSize: 28, lineHeight: 36, letterSpacing: -0.5, fontWeight: '700' as const },
  h3: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3, fontWeight: '600' as const },
  h4: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums' as const],
  },
  mono: { fontVariant: ['tabular-nums' as const] },
};
