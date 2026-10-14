import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

export interface LoadingStateProps {
  label?: string; // ex: "CARREGANDO..."
  rows?: number; // default 3
}

const SKELETON_HEIGHTS = [16, 48, 24];

export function LoadingState({ label, rows = 3 }: LoadingStateProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.skeletonList, { opacity }]}>
        {Array.from({ length: rows }).map((_, index) => {
          const height = SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length];
          return (
            <View
              key={index}
              style={[styles.skeletonBar, { height }]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: {
      width: '100%',
      paddingHorizontal: Spacing.sp5,
      paddingVertical: Spacing.sp4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    label: {
      fontFamily: Fonts.mono,
      fontSize: FontSize.label,
      color: colors.cinza,
      letterSpacing: 0.5,
      marginBottom: Spacing.sp4,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    skeletonList: {
      width: '100%',
    },
    skeletonBar: {
      width: '100%',
      backgroundColor: colors.papel3,
      borderRadius: 0,
      marginBottom: Spacing.sp3,
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

export default LoadingState;
