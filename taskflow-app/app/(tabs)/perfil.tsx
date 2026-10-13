import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFocusTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}min`;
}

export default function Perfil() {
  const { user, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(user?.id ?? '');
      setTasks(all);
    }, [user?.id])
  );

  const completedTasksCount = tasks.filter((t) => t.status === 'done').length;
  const totalPomodoros = tasks.reduce((acc, t) => acc + (t.completed_pomodoros ?? 0), 0);
  const totalFocusMinutes = tasks.reduce((acc, t) => acc + (t.estimated_pomodoros ?? 0), 0) * 25;
  const focusTimeFormatted = formatFocusTime(totalFocusMinutes);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name ?? 'Usuário';
  const email = user?.email ?? '';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.screen}>
      {/* Header dark */}
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(fullName)}</Text>
          </View>
        )}
        <Text style={styles.name}>{fullName}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Seção Estatísticas */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>ESTATÍSTICAS</Text>
          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{completedTasksCount}</Text>
              <Text style={styles.statLabel}>CONCLUÍDAS</Text>
            </View>
            <View style={[styles.statColumn, styles.statColumnMiddle]}>
              <Text style={styles.statValue}>{totalPomodoros}</Text>
              <Text style={styles.statLabel}>POMODOROS</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{focusTimeFormatted}</Text>
              <Text style={styles.statLabel}>TEMPO DE FOCO</Text>
            </View>
          </View>
        </View>

        {/* Seção de Navegação */}
        <View style={styles.navSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir para histórico"
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={() => router.push('/historico')}
          >
            <Text style={styles.navButtonText}>HISTÓRICO →</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir para estatísticas"
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={() => router.push('/estatisticas')}
          >
            <Text style={styles.navButtonText}>ESTATÍSTICAS →</Text>
          </Pressable>
        </View>

        {/* Botão Sair */}
        <View style={styles.logoutContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            onPress={handleSignOut}
          >
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.papel,
  },
  header: {
    backgroundColor: Colors.tinta,
    paddingTop: Spacing.sp12,
    paddingHorizontal: Spacing.sp5,
    paddingBottom: Spacing.sp6,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cinza,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.barlowBold,
    fontSize: 28,
    color: Colors.papel,
  },
  name: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingLg,
    color: Colors.papel,
    marginTop: Spacing.sp3,
    letterSpacing: 0.5,
  },
  email: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
  },
  statsSection: {
    paddingHorizontal: Spacing.sp5,
    marginTop: Spacing.sp6,
  },
  sectionTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    letterSpacing: 0.5,
    marginBottom: Spacing.sp4,
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sp4,
    paddingHorizontal: Spacing.sp2,
  },
  statColumnMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.papel3,
  },
  statValue: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingLg,
    color: Colors.tinta,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  navSection: {
    marginTop: Spacing.sp6,
    paddingHorizontal: Spacing.sp5,
    gap: Spacing.sp3,
  },
  navButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.sp4,
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
    justifyContent: 'center',
    borderRadius: 0,
  },
  navButtonPressed: {
    backgroundColor: Colors.papel3,
  },
  navButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
    letterSpacing: 0.5,
  },
  logoutContainer: {
    marginTop: 'auto',
    paddingHorizontal: Spacing.sp5,
    paddingTop: Spacing.sp8,
    paddingBottom: Spacing.sp8,
  },
  logoutButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.vermelho,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(214,59,47,0.08)',
  },
  logoutText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.vermelho,
    letterSpacing: 0.5,
  },
});