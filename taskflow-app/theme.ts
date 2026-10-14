export const LightColors = {
  tinta: '#0E0E0F',
  vermelho: '#D63B2F',
  papel: '#F5F2EB',
  papel2: '#EDE9E0',
  papel3: '#E4E0D6',
  grafite: '#5A5850',
  cinza: '#9A978E',
  textoClaro: '#F5F2EB',
} as const;

export const DarkColors = {
  tinta: '#111110',
  vermelho: '#D63B2F',
  papel: '#1C1C1E',
  papel2: '#2C2C2E',
  papel3: '#3A3A3C',
  grafite: '#9A978E',
  cinza: '#636366',
  textoClaro: '#F5F2EB',
} as const;

export const ThemeColors = {
  light: LightColors,
  dark: DarkColors,
} as const;

export const Colors = LightColors;

export type ColorTheme = {
  readonly [K in keyof typeof LightColors]: string;
};

export const Spacing = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 20,
  sp6: 24,
  sp8: 32,
  sp10: 40,
  sp12: 48,
} as const;

export const FontSize = {
  display: 64,
  headingXl: 32,
  headingLg: 24,
  headingMd: 18,
  body: 14,
  caption: 12,
  label: 10,
  taskTitle: 16,
  taskId: 9,
} as const;

export const Fonts = {
  barlowBold: 'BarlowCondensed_700Bold',
  barlowSemiBold: 'BarlowCondensed_600SemiBold',
  barlowBlackItalic: 'BarlowCondensed_900Black_Italic',
  mono: 'IBMPlexMono_400Regular',
  dmSans: 'DMSans_400Regular',
} as const;
