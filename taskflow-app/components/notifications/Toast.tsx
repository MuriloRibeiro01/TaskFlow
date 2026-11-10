import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const currentAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (currentAnimation.current) {
      currentAnimation.current.stop();
    }

    const nextToast: ToastData = {
      id: Date.now(),
      message,
      type,
    };
    setToast(nextToast);
    opacity.setValue(0);

    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(2800),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    currentAnimation.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastContainer,
            toast.type === 'error'
              ? styles.toastError
              : toast.type === 'info'
              ? styles.toastInfo
              : styles.toastSuccess,
            { opacity },
          ]}
        >
          <View style={styles.toastContent}>
            <Text style={styles.toastIcon}>
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '·'}
            </Text>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    toastContainer: {
      position: 'absolute',
      bottom: 88,
      left: Spacing.sp4,
      right: Spacing.sp4,
      padding: Spacing.sp4,
      zIndex: 9999,
      borderRadius: 0,
    },
    toastSuccess: {
      borderLeftWidth: 3,
      borderLeftColor: colors.vermelho,
      backgroundColor: colors.tinta,
    },
    toastError: {
      borderLeftWidth: 3,
      borderLeftColor: colors.vermelho,
      backgroundColor: '#1a0a09',
    },
    toastInfo: {
      borderLeftWidth: 3,
      borderLeftColor: colors.cinza,
      backgroundColor: colors.tinta,
    },
    toastContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sp2,
    },
    toastIcon: {
      fontFamily: Fonts.mono,
      fontSize: FontSize.label,
      color: colors.cinza,
    },
    toastText: {
      flex: 1,
      fontFamily: Fonts.mono,
      fontSize: FontSize.caption,
      color: colors.textoClaro,
      letterSpacing: 0.3,
    },
  });
}

let cachedStyles: ReturnType<typeof createStyles> | null = null;
let cachedTheme: ColorTheme | null = null;

function getStyles(colors: ColorTheme) {
  if (cachedStyles && cachedTheme === colors) {
    return cachedStyles;
  }
  cachedTheme = colors;
  cachedStyles = createStyles(colors);
  return cachedStyles;
}
