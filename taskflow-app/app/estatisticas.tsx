import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';
const WEEKDAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function SimpleBarChart({
  data,
  barColor,
  labelColor,
}: {
  data: { label: string; value: number }[];
  barColor: string;
  labelColor: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const BAR_AREA = 130;
  return (
    <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ height: BAR_AREA, justifyContent: 'flex-end' }}>
            <View
              style={{
                width: 16,
                height: Math.max((d.value / max) * BAR_AREA, d.value > 0 ? 3 : 0),
                backgroundColor: barColor,
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 9, color: labelColor, marginTop: 6 }}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface DayStat {
  label: string;
  date: string;
  count: number;
  focusMin: number;
}

function getPast7Days(): { label: string; date: string }[] {
  const result: { label: string; date: string }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const label = WEEKDAYS_PT[d.getDay()];
    result.push({ label, date });
  }

  return result;
}


export default function Estatisticas() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(user?.id ?? '');
      setTasks(all);
    }, [user?.id])
  );

  const past7Days = getPast7Days();

  const tasksByDay: DayStat[] = past7Days.map((day) => {
    const dayTasks = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      const compDate = t.completed_at ? t.completed_at.substring(0, 10) : '';
      return compDate === day.date;
    });

    const count = dayTasks.length;
    const focusMin = dayTasks.reduce(
      (acc, t) => acc + (t.estimated_pomodoros ?? 0) * 25,
      0
    );

    return {
      label: day.label,
      date: day.date,
      count,
      focusMin,
    };
  });

  // Métricas de destaque
  let bestDay = tasksByDay[0];
  for (const d of tasksByDay) {
    if (d.count > bestDay.count) {
      bestDay = d;
    }
  }
  const bestDayLabel = bestDay && bestDay.count > 0 ? bestDay.label : '—';

  const totalTasks7 = tasksByDay.reduce((acc, d) => acc + d.count, 0);
  const avgTasksPerDay = (totalTasks7 / 7).toFixed(1);

  const past7DateSet = new Set(past7Days.map((d) => d.date));
  const tasksLast7Days = tasks.filter(
    (t) =>
      t.status === 'done' &&
      t.completed_at &&
      past7DateSet.has(t.completed_at.substring(0, 10))
  );
  const totalPomodoros7 = tasksLast7Days.reduce(
    (acc, t) => acc + (t.completed_pomodoros ?? 0),
    0
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.screen}>
      {/* Header dark */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={16}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ESTATÍSTICAS</Text>
        <Text style={styles.headerSubtitle}>ÚLTIMOS 7 DIAS</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Seção Métricas em Destaque */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{bestDayLabel}</Text>
            <Text style={styles.metricLabel}>MELHOR DIA</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{avgTasksPerDay}</Text>
            <Text style={styles.metricLabel}>MÉDIA / DIA</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalPomodoros7}</Text>
            <Text style={styles.metricLabel}>TOTAL POM.</Text>
          </View>
        </View>

        {/* Seção TAREFAS CONCLUÍDAS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TAREFAS CONCLUÍDAS</Text>
          <View style={styles.chartCard}>
            <SimpleBarChart
              data={tasksByDay.map((d) => ({ label: d.label, value: d.count }))}
              barColor={colors.vermelho}
              labelColor={colors.cinza}
            />
          </View>
        </View>

        {/* Seção TEMPO DE FOCO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TEMPO DE FOCO</Text>
          <View style={styles.chartCard}>
            <SimpleBarChart
              data={tasksByDay.map((d) => ({ label: d.label, value: d.focusMin }))}
              barColor={colors.tinta}
              labelColor={colors.cinza}
            />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.papel,
    },
    header: {
      backgroundColor: colors.tinta,
      paddingTop: Spacing.sp12,
      paddingHorizontal: Spacing.sp5,
      paddingBottom: Spacing.sp5,
    },
    backButton: {
      alignSelf: 'flex-start',
      marginRight: 'auto',
      paddingVertical: Spacing.sp1,
      marginBottom: Spacing.sp2,
    },
    backText: {
      fontFamily: Fonts.mono,
      fontSize: FontSize.body,
      color: colors.textoClaro,
    },
    headerTitle: {
      fontFamily: Fonts.barlowBold,
      fontSize: FontSize.headingXl,
      color: colors.textoClaro,
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontFamily: Fonts.mono,
      fontSize: FontSize.label,
      color: colors.cinza,
      marginTop: Spacing.sp1,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.sp5,
      paddingTop: Spacing.sp5,
      paddingBottom: Spacing.sp8,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: Spacing.sp2,
      marginBottom: Spacing.sp6,
    },
    metricCard: {
      flex: 1,
      backgroundColor: colors.papel2,
      borderWidth: 1,
      borderColor: colors.papel3,
      paddingVertical: Spacing.sp4,
      paddingHorizontal: Spacing.sp2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
    },
    metricValue: {
      fontFamily: Fonts.barlowBold,
      fontSize: FontSize.headingLg,
      color: colors.tinta,
    },
    metricLabel: {
      fontFamily: Fonts.mono,
      fontSize: FontSize.taskId,
      color: colors.cinza,
      marginTop: Spacing.sp1,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    section: {
      marginBottom: Spacing.sp6,
    },
    sectionTitle: {
      fontFamily: Fonts.barlowBold,
      fontSize: FontSize.caption,
      color: colors.tinta,
      letterSpacing: 0.5,
      marginBottom: Spacing.sp3,
    },
    chartCard: {
      height: 200,
      backgroundColor: colors.papel2,
      borderWidth: 1,
      borderColor: colors.papel3,
      borderRadius: 0,
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
