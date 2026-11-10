import React, { useCallback, useState } from 'react';
import { Appearance, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { ColorTheme, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';
import { useNetInfo } from '@react-native-community/netinfo';
import { useToast } from '@/components/notifications/Toast';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Perfil() {
  const { colors, colorScheme } = useTheme();
  const styles = getStyles(colors);
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const netInfo = useNetInfo();
  const [tasks, setTasks] = useState<Task[]>([]);

  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [soundOn, setSoundOn] = useState(true);
  const [vibOn, setVibOn] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(user?.id ?? '');
      setTasks(all);
    }, [user?.id])
  );

  const today = new Date().toISOString().substring(0, 10);
  const todayDone = tasks.filter(
    (t) => t.status === 'done' && t.completed_at?.substring(0, 10) === today
  );
  const pomToday = todayDone.reduce(
    (acc, t) => acc + (t.completed_pomodoros ?? 0),
    0
  );
  const doneToday = todayDone.length;

  const isOnline = netInfo.isConnected === true;
  const syncMeta = isOnline ? 'Sincronizado' : 'Sem conexão';

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name ?? 'Usuário';
  const email = user?.email ?? '';
  const provider = String(
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? ''
  ).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View style={styles.container}>
      {/* 1. Header (fora do scroll) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PERFIL</Text>
      </View>

      {/* 2. Scroll */}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2a. Cartão do usuário */}
        <View style={styles.userCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(fullName)}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            {email ? <Text style={styles.userEmail}>{email}</Text> : null}
            {provider ? <Text style={styles.userProvider}>{provider}</Text> : null}
          </View>
        </View>

        {/* 2b. Seção "Hoje" */}
        <View>
          <Text style={styles.sectionLabel}>HOJE</Text>
          <View style={styles.todayGrid}>
            <View style={styles.todayCell}>
              <Text style={styles.todayNumber}>{pomToday}</Text>
              <Text style={styles.todayLabel}>POMODOROS</Text>
            </View>
            <View style={styles.todayCell}>
              <Text style={styles.todayNumber}>{doneToday}</Text>
              <Text style={styles.todayLabel}>TAREFAS CONCLUÍDAS</Text>
            </View>
          </View>
          <View
            style={[
              styles.syncRow,
              { borderLeftColor: isOnline ? '#4CAF50' : colors.cinza },
            ]}
          >
            <View>
              <Text style={styles.syncText}>Sincronização</Text>
              <Text style={styles.syncMeta}>{syncMeta}</Text>
            </View>
            <View
              style={[
                styles.syncBadge,
                {
                  backgroundColor: isOnline
                    ? 'rgba(76,175,80,0.08)'
                    : colors.papel3,
                },
              ]}
            >
              <Text
                style={[
                  styles.syncBadgeText,
                  { color: isOnline ? '#4CAF50' : colors.cinza },
                ]}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2c. Seção de navegação (sem label) */}
        <View style={styles.navSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir para histórico"
            style={({ pressed }) => [
              styles.navItem,
              pressed && { backgroundColor: colors.papel3 },
            ]}
            onPress={() => router.push('/historico')}
          >
            <Text style={styles.navText}>Histórico</Text>
            <Text style={styles.navChevron}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir para estatísticas"
            style={({ pressed }) => [
              styles.navItem,
              pressed && { backgroundColor: colors.papel3 },
            ]}
            onPress={() => router.push('/estatisticas')}
          >
            <Text style={styles.navText}>Estatísticas</Text>
            <Text style={styles.navChevron}>›</Text>
          </Pressable>
        </View>

        {/* 2d. Seção Configurações */}
        <View>
          <Text style={styles.sectionLabel}>CONFIGURAÇÕES</Text>
          <View style={styles.settingsList}>
            {/* Duração do foco */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Duração do foco</Text>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Diminuir duração do foco"
                  style={styles.stepperButton}
                  onPress={() => setFocusDuration((prev) => Math.max(5, prev - 5))}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{focusDuration} min</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aumentar duração do foco"
                  style={styles.stepperButton}
                  onPress={() => setFocusDuration((prev) => Math.min(60, prev + 5))}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Duração da pausa */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Duração da pausa</Text>
              <View style={styles.stepperContainer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Diminuir duração da pausa"
                  style={styles.stepperButton}
                  onPress={() => setBreakDuration((prev) => Math.max(1, prev - 5))}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{breakDuration} min</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aumentar duração da pausa"
                  style={styles.stepperButton}
                  onPress={() => setBreakDuration((prev) => Math.min(30, prev + 5))}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Tema */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Tema</Text>
              <View style={styles.themeButtonGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tema Claro"
                  style={[
                    styles.themeButton,
                    colorScheme === 'light'
                      ? { borderColor: colors.tinta, backgroundColor: colors.tinta }
                      : { borderColor: colors.cinza, backgroundColor: 'transparent' },
                  ]}
                  onPress={() => Appearance.setColorScheme('light')}
                >
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: colorScheme === 'light' ? colors.textoClaro : colors.grafite },
                    ]}
                  >
                    Claro
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tema Escuro"
                  style={[
                    styles.themeButton,
                    colorScheme === 'dark'
                      ? { borderColor: colors.tinta, backgroundColor: colors.tinta }
                      : { borderColor: colors.cinza, backgroundColor: 'transparent' },
                  ]}
                  onPress={() => Appearance.setColorScheme('dark')}
                >
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: colorScheme === 'dark' ? colors.textoClaro : colors.grafite },
                    ]}
                  >
                    Escuro
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Sons */}
            <View style={styles.settingToggleRow}>
              <Text style={styles.settingLabel}>Sons</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Alternar sons"
                accessibilityState={{ checked: soundOn }}
                style={[
                  styles.toggleTrack,
                  soundOn
                    ? { borderColor: colors.tinta, backgroundColor: colors.tinta, alignItems: 'flex-end' }
                    : { borderColor: colors.cinza, backgroundColor: 'transparent', alignItems: 'flex-start' },
                ]}
                onPress={() => setSoundOn((v) => !v)}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    { backgroundColor: soundOn ? colors.textoClaro : colors.cinza },
                  ]}
                />
              </Pressable>
            </View>

            {/* Vibração */}
            <View style={styles.settingToggleRow}>
              <Text style={styles.settingLabel}>Vibração</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Alternar vibração"
                accessibilityState={{ checked: vibOn }}
                style={[
                  styles.toggleTrack,
                  vibOn
                    ? { borderColor: colors.tinta, backgroundColor: colors.tinta, alignItems: 'flex-end' }
                    : { borderColor: colors.cinza, backgroundColor: 'transparent', alignItems: 'flex-start' },
                ]}
                onPress={() => setVibOn((v) => !v)}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    { backgroundColor: vibOn ? colors.textoClaro : colors.cinza },
                  ]}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 2e. Seção Ações */}
        <View style={styles.actionsSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exportar relatório (PDF)"
            style={styles.exportButton}
            onPress={() => showToast('Em breve', 'info')}
          >
            <Text style={styles.exportButtonText}>Exportar relatório (PDF)</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.papel,
    },
    header: {
      backgroundColor: colors.tinta,
      paddingTop: Spacing.sp12,
      paddingHorizontal: Spacing.sp5,
      paddingBottom: Spacing.sp4,
      borderBottomWidth: 1,
      borderBottomColor: colors.tinta,
    },
    headerTitle: {
      fontFamily: Fonts.barlowBold,
      fontSize: 20,
      letterSpacing: 0.06,
      color: colors.textoClaro,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.papel,
    },
    scrollContent: {
      paddingHorizontal: Spacing.sp5,
      paddingTop: Spacing.sp5,
      paddingBottom: Spacing.sp10,
      gap: Spacing.sp6,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sp4,
      backgroundColor: colors.papel2,
      gap: 14,
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 0,
      backgroundColor: colors.tinta,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 0,
      backgroundColor: colors.tinta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontFamily: Fonts.barlowBold,
      fontSize: 20,
      color: colors.textoClaro,
    },
    userInfo: {
      flex: 1,
      gap: 3,
    },
    userName: {
      fontFamily: Fonts.barlow,
      fontSize: 18,
      color: colors.tinta,
    },
    userEmail: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 0.06,
      color: colors.cinza,
    },
    userProvider: {
      fontFamily: Fonts.mono,
      fontSize: 8,
      letterSpacing: 0.14,
      color: colors.cinza,
      textTransform: 'uppercase',
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 0.16,
      color: colors.cinza,
      textTransform: 'uppercase',
      marginBottom: Spacing.sp2,
    },
    todayGrid: {
      flexDirection: 'row',
      gap: 2,
    },
    todayCell: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.papel2,
    },
    todayNumber: {
      fontFamily: Fonts.barlowBold,
      fontSize: 28,
      lineHeight: 28,
      color: colors.tinta,
    },
    todayLabel: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 0.1,
      color: colors.cinza,
      marginTop: 6,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.papel2,
      borderLeftWidth: 2,
      marginTop: 2,
    },
    syncText: {
      fontFamily: Fonts.dmSans,
      fontSize: 13,
      color: colors.grafite,
    },
    syncMeta: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 0.06,
      color: colors.cinza,
      marginTop: 3,
    },
    syncBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    syncBadgeText: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 0.08,
    },
    navSection: {
      gap: 2,
    },
    navItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      backgroundColor: colors.papel2,
    },
    navText: {
      fontFamily: Fonts.barlow,
      fontSize: 16,
      color: colors.tinta,
    },
    navChevron: {
      fontFamily: Fonts.mono,
      fontSize: 16,
      color: colors.cinza,
    },
    settingsList: {
      gap: 2,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.papel2,
    },
    settingToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.papel2,
    },
    settingLabel: {
      fontFamily: Fonts.dmSans,
      fontSize: 13,
      color: colors.grafite,
    },
    stepperContainer: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    stepperButton: {
      width: 28,
      height: 28,
      borderWidth: 1,
      borderColor: colors.tinta,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonText: {
      fontFamily: Fonts.mono,
      fontSize: 14,
      color: colors.tinta,
      textAlign: 'center',
    },
    stepperValue: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: colors.tinta,
      minWidth: 46,
      textAlign: 'center',
    },
    themeButtonGroup: {
      flexDirection: 'row',
      gap: 4,
    },
    themeButton: {
      height: 28,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    themeButtonText: {
      fontFamily: Fonts.mono,
      fontSize: 10,
    },
    toggleTrack: {
      width: 34,
      height: 18,
      padding: 2,
      borderWidth: 1,
      justifyContent: 'center',
    },
    toggleKnob: {
      width: 12,
      height: 12,
    },
    actionsSection: {
      gap: 10,
    },
    exportButton: {
      width: '100%',
      height: 44,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.papel3,
      borderRadius: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    exportButtonText: {
      fontFamily: Fonts.barlowBold,
      fontSize: 15,
      color: colors.tinta,
    },
    signOutButton: {
      width: '100%',
      height: 46,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.tinta,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutButtonText: {
      fontFamily: Fonts.barlowBold,
      fontSize: 16,
      color: colors.tinta,
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