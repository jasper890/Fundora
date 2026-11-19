import { Platform, useColorScheme } from 'react-native';

import type { Tone } from '@/lib/format/status';

// Light values mirror web/app/tokens.css; dark values keep the same evergreen/coral identity at AA contrast.
export const Colors = {
  light: {
    background: '#F1EFE7',
    surface: '#FFFDF8',
    text: '#18372F',
    textSecondary: '#5E6D63',
    line: '#DCE1D8',
    accent: '#1D5142',
    onAccent: '#FFFFFF',
    accentSoft: '#E8EEE6',
    coral: '#B4471C',
    coralSoft: '#FFF0E7',
    danger: '#A3261B',
    dangerSoft: '#FCE9E6',
    warningSoft: '#FFF6DC',
    warning: '#7A5300',
  },
  dark: {
    background: '#10231E',
    surface: '#17302A',
    text: '#EEF2EA',
    textSecondary: '#A9B8AD',
    line: '#2B4840',
    accent: '#8FD1B5',
    onAccent: '#0C1F1A',
    accentSoft: '#1F3B33',
    coral: '#F7A07A',
    coralSoft: '#3A2A22',
    danger: '#FF9C90',
    dangerSoft: '#3D1F1B',
    warningSoft: '#3A3018',
    warning: '#F2CE72',
  },
} as const;

export type Palette = (typeof Colors)['light' | 'dark'];

export function useTheme(): Palette {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function toneColors(theme: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
    case 'progress':
      return { fg: theme.accent, bg: theme.accentSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'warning':
      return { fg: theme.warning, bg: theme.warningSoft };
    default:
      return { fg: theme.textSecondary, bg: theme.line };
  }
}

export const Spacing = { one: 4, two: 8, three: 12, four: 16, five: 24, six: 32 } as const;
export const Radius = { small: 9, card: 14 } as const;

export const Fonts = Platform.select({
  ios: { serif: 'ui-serif', mono: 'ui-monospace' },
  default: { serif: 'serif', mono: 'monospace' },
});
