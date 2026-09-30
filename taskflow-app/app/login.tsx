import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  Pressable,
} from 'react-native';
import { useAuth } from '@/database/context/auth_context';

const colors = {
  ink: '#0E0E0F',
  red: '#D63B2F',
  paper: '#F5F2EC',
  paperMuted: '#EDE9E0',
  graphite: '#5A5850',
  grey: '#9A978E',
};

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // O redirecionamento após o login é feito pelo Stack.Protected em app/_layout.tsx
  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await signIn();
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Erro ao entrar', 'Não foi possível entrar com o Google. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAppleLogin = () => {
    Alert.alert('Em breve', 'O login com Apple será disponibilizado nesta tela.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <View style={styles.screen}>
        <View style={styles.content}>
          <View>
            <Text accessibilityRole="header" style={styles.brand}>
              <Text style={styles.brandInk}>TASK</Text>
              <Text style={styles.brandRed}>FLOW</Text>
            </Text>
            <View style={styles.rule} />
            <Text style={styles.tagline}>Foco com propósito</Text>
            <Text style={styles.meta}>APP DE PRODUTIVIDADE · IOS & ANDROID · UCB 2026</Text>
          </View>

          <View style={styles.authentication}>
            <Text style={styles.sectionLabel}>ENTRAR NA SUA CONTA</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuar com Google"
              style={({ pressed }) => [styles.googleButton, pressed && !isLoggingIn && styles.buttonPressed]}
              onPress={handleLogin}
              disabled={isLoggingIn || isLoading}
            >
              <Text style={styles.googleButtonText}>
                {isLoggingIn || isLoading ? 'Conectando...' : 'Continuar com Google'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuar com Apple"
              style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
              onPress={handleAppleLogin}
              disabled={isLoggingIn || isLoading}
            >
              <Text style={styles.appleButtonText}>Continuar com Apple</Text>
            </Pressable>
            <View style={styles.secondaryRule} />
          </View>
        </View>

        <Text style={styles.credits}>
          MICAEL · MURILO · PAULO · PEDRO B. · PEDRO T.{"\n"}
          VINÍCIUS O. · VINÍCIUS R.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    borderTopWidth: 2,
    borderTopColor: colors.red,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 72,
  },
  brand: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  brandInk: {
    color: colors.ink,
  },
  brandRed: {
    color: colors.red,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D7D2C8',
    marginTop: 16,
  },
  tagline: {
    marginTop: 20,
    color: colors.ink,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 21,
    lineHeight: 25,
  },
  meta: {
    marginTop: 7,
    color: colors.grey,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    lineHeight: 14,
  },
  authentication: {
    marginTop: 55,
  },
  sectionLabel: {
    color: colors.grey,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    lineHeight: 14,
    marginBottom: 14,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    height: 58,
    justifyContent: 'center',
  },
  appleButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginTop: 14,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  googleButtonText: {
    color: colors.paper,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 19,
    lineHeight: 22,
  },
  appleButtonText: {
    color: colors.ink,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 19,
    lineHeight: 22,
  },
  secondaryRule: {
    backgroundColor: '#D7D2C8',
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  credits: {
    color: colors.grey,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    letterSpacing: 0.3,
    lineHeight: 16,
    paddingBottom: 36,
    paddingHorizontal: 40,
    textAlign: 'center',
  },
});
