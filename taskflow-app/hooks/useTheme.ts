import { useColorScheme } from 'react-native';
import { ColorTheme, DarkColors, LightColors } from '@/theme';

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors: ColorTheme = isDark ? DarkColors : LightColors;

  return {
    ...colors,
    colors,
    colorScheme: (isDark ? 'dark' : 'light') as 'dark' | 'light',
    isDark,
  };
}

export default useTheme;
