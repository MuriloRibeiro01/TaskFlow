import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '@/database/context/auth_context';

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

  if(isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.subtitle}>Organize suas tarefas</Text>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.googleButtonText}>Entrar com Google</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});