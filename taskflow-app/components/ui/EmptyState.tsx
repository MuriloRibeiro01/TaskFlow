import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

export interface EmptyStateProps {
  icon?: string; // default '☰'
  title: string;
  description?: string;
}

export function EmptyState({ icon = '☰', title, description }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: Spacing.sp12,
      paddingBottom: Spacing.sp8,
    },
    iconBox: {
      width: 48,
      height: 48,
      marginBottom: Spacing.sp4,
      borderWidth: 1,
      borderColor: colors.grafite,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
    },
    iconText: {
      fontFamily: Fonts.mono,
      fontSize: 22,
      color: colors.grafite,
    },
    title: {
      fontFamily: Fonts.barlowBold,
      fontSize: FontSize.caption,
      color: colors.tinta,
      letterSpacing: 0.5,
    },
    description: {
      marginTop: Spacing.sp2,
      fontFamily: Fonts.mono,
      fontSize: FontSize.label,
      color: colors.cinza,
      textAlign: 'center',
      lineHeight: 18,
      letterSpacing: 0.4,
    },
  });
}

let cachedStyles: ReturnType<typeof createStyles> | null = null;
let cachedTheme: ColorTheme | null = null;

function getStyles(colors: ColorTheme) {
  if (cachedStyles && cachedTheme === colors) return cachedStyles;
  cachedTheme = colors;
  cachedStyles = createStyles(colors);
  return cachedStyles;
}

export default EmptyState;
