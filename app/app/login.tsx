import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/database/context/auth_context';

const colors = {
  tinta: '#0E0E0F',
  red: '#D63B2F',
  paper: '#F5F2EC',
  paperMuted: '#EDE9E0',
  graphite: '#5A5850',
  grey: '#9A978E',
};

export default function LoginScreen() {
  const { signIn, register, signInAsGuest, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    try {
      setIsSubmitting(true);
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (error: any) {
      const msg =
        error?.status === 401 ? 'Email ou senha incorretos.' :
        error?.status === 409 ? 'Este email já está cadastrado.' :
        error?.status === 400 ? 'Senha deve ter no mínimo 8 caracteres.' :
        'Não foi possível entrar. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setPassword('');
  };

  const busy = isSubmitting || isLoading;
  const label = mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA';

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.tinta} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View>
            <Text accessibilityRole="header" style={styles.brand}>
              <Text style={styles.brandTinta}>TASK</Text>
              <Text style={styles.brandRed}>FLOW</Text>
            </Text>
            <View style={styles.rule} />
            <Text style={styles.tagline}>Foco com propósito</Text>
            <Text style={styles.meta}>APP DE PRODUTIVIDADE · IOS & ANDROID · UCB 2026</Text>
          </View>

          <View style={styles.authentication}>
            <Text style={styles.sectionLabel}>
              {mode === 'login' ? 'ENTRAR NA SUA CONTA' : 'CRIAR UMA CONTA'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.grey}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!busy}
            />

            <TextInput
              style={[styles.input, styles.inputSpacing]}
              placeholder="Senha (mín. 8 caracteres)"
              placeholderTextColor={colors.grey}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
              editable={!busy}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.buttonPressed]}
              onPress={handleSubmit}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? 'Aguarde...' : label}
              </Text>
            </Pressable>

            <View style={styles.secondaryRule} />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.buttonPressed]}
              onPress={toggleMode}
            >
              <Text style={styles.toggleText}>
                {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar sem login"
              style={({ pressed }) => [pressed && styles.buttonPressed]}
              onPress={signInAsGuest}
            >
              <Text style={styles.guestText}>Entrar sem login</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.credits}>
          MICAEL · MURILO · PAULO · PEDRO B. · PEDRO T.{"\n"}
          VINÍCIUS O. · VINÍCIUS R.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.paper,
    borderTopWidth: 2,
    borderTopColor: colors.red,
  },
  screen: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: 40,
    paddingTop: 72,
  },
  brand: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  brandTinta: {
    color: colors.tinta,
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
    color: colors.tinta,
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
  input: {
    backgroundColor: colors.paperMuted,
    borderColor: '#D7D2C8',
    borderWidth: 1,
    color: colors.tinta,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 14,
    height: 58,
    paddingHorizontal: 16,
  },
  inputSpacing: {
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.tinta,
    height: 58,
    justifyContent: 'center',
    marginTop: 14,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: colors.paper,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 19,
    lineHeight: 22,
  },
  secondaryRule: {
    backgroundColor: '#D7D2C8',
    height: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  toggleText: {
    color: colors.graphite,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  guestText: {
    color: colors.grey,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
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
