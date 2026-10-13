import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';

const WEEKDAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

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

function formatFocusLabel(minutes: number): string {
  if (minutes === 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${m}min`;
}

export default function Estatisticas() {
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

  // Cálculo das barras
  const maxCount = Math.max(...tasksByDay.map((d) => d.count), 0);
  const maxFocus = Math.max(...tasksByDay.map((d) => d.focusMin), 0);

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
    <View style={styles.screen}>
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
            <View style={styles.chartRow}>
              {tasksByDay.map((d) => {
                const barHeight =
                  maxCount > 0 && d.count > 0
                    ? Math.max(4, Math.round((d.count / maxCount) * 80))
                    : 4;

                return (
                  <View key={d.date} style={styles.chartColumn}>
                    <Text style={styles.chartValueText}>{d.count}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: Colors.vermelho,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartDayText}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Seção TEMPO DE FOCO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TEMPO DE FOCO</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {tasksByDay.map((d) => {
                const barHeight =
                  maxFocus > 0 && d.focusMin > 0
                    ? Math.max(4, Math.round((d.focusMin / maxFocus) * 80))
                    : 4;

                return (
                  <View key={d.date} style={styles.chartColumn}>
                    <Text
                      style={styles.chartValueText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatFocusLabel(d.focusMin)}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: Colors.tinta,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartDayText}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
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
    color: Colors.papel,
  },
  headerTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingXl,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
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
    backgroundColor: Colors.papel2,
    borderWidth: 1,
    borderColor: Colors.papel3,
    paddingVertical: Spacing.sp4,
    paddingHorizontal: Spacing.sp2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  metricValue: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingLg,
    color: Colors.tinta,
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
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
    color: Colors.tinta,
    letterSpacing: 0.5,
    marginBottom: Spacing.sp3,
  },
  chartCard: {
    backgroundColor: Colors.papel2,
    borderWidth: 1,
    borderColor: Colors.papel3,
    paddingVertical: Spacing.sp4,
    paddingHorizontal: Spacing.sp2,
    borderRadius: 0,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartValueText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    marginBottom: Spacing.sp2,
    height: 14,
    textAlign: 'center',
  },
  barTrack: {
    height: 80,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 20,
    borderRadius: 0,
  },
  chartDayText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp2,
    letterSpacing: 0.3,
  },
});
