import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';

const MONTHS_PT = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
];

function formatDateHeader(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    if (month >= 0 && month < 12) {
      return `${day} ${MONTHS_PT[month]} ${year}`;
    }
  }
  return dateKey;
}

function extractCompletionTime(completedAt: string | null): string {
  if (!completedAt) return '';
  const match = completedAt.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { symbol: string; label: string; color: string; bg: string }> = {
    high: { symbol: '▲', label: 'Alta', color: Colors.vermelho, bg: 'rgba(214,59,47,0.08)' },
    medium: { symbol: '—', label: 'Média', color: Colors.grafite, bg: 'rgba(14,14,15,0.06)' },
    low: { symbol: '▽', label: 'Baixa', color: Colors.cinza, bg: 'rgba(14,14,15,0.03)' },
    Alta: { symbol: '▲', label: 'Alta', color: Colors.vermelho, bg: 'rgba(214,59,47,0.08)' },
    Média: { symbol: '—', label: 'Média', color: Colors.grafite, bg: 'rgba(14,14,15,0.06)' },
    Baixa: { symbol: '▽', label: 'Baixa', color: Colors.cinza, bg: 'rgba(14,14,15,0.03)' },
  };
  const s = map[priority] ?? map.low;
  return (
    <View style={[styles.priorityBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.priorityText, { color: s.color }]}>
        {s.symbol} {s.label}
      </Text>
    </View>
  );
}

export default function Historico() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(user?.id ?? '');
      setTasks(all);
    }, [user?.id])
  );

  const doneTasks = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => {
      const dateA = a.completed_at || a.created_at || '';
      const dateB = b.completed_at || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

  const groupsMap = new Map<string, Task[]>();
  for (const task of doneTasks) {
    const rawDate = task.completed_at || task.created_at || '';
    const dateKey = rawDate.length >= 10 ? rawDate.substring(0, 10) : 'OUTROS';
    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, []);
    }
    groupsMap.get(dateKey)!.push(task);
  }

  const groups = Array.from(groupsMap.entries()).map(([dateKey, groupTasks]) => ({
    dateKey,
    formattedDate: dateKey === 'OUTROS' ? 'OUTROS' : formatDateHeader(dateKey),
    tasks: groupTasks,
  }));

  const subtitleText = `${doneTasks.length} ${doneTasks.length === 1 ? 'TAREFA CONCLUÍDA' : 'TAREFAS CONCLUÍDAS'}`;

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
        <Text style={styles.headerTitle}>HISTÓRICO</Text>
        <Text style={styles.headerSubtitle}>{subtitleText}</Text>
      </View>

      {/* Lista */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {doneTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>☰</Text>
            </View>
            <Text style={styles.emptyTitle}>NENHUMA TAREFA CONCLUÍDA</Text>
            <Text style={styles.emptyDescription}>
              COMPLETE TAREFAS PARA VER SEU HISTÓRICO.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.dateKey} style={styles.groupContainer}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupDateText}>{group.formattedDate}</Text>
              </View>

              {group.tasks.map((task) => {
                const completionTime = extractCompletionTime(task.completed_at);
                const displayId = `T-${String(task.id).padStart(3, '0')}`;

                return (
                  <View key={task.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.taskId}>{displayId}</Text>
                      <PriorityBadge priority={task.priority} />
                    </View>

                    <Text style={styles.taskTitle}>{task.title}</Text>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardMeta}>
                        {task.completed_pomodoros ?? 0} pom.
                      </Text>
                      {completionTime ? (
                        <Text style={styles.cardMeta}>{completionTime}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.sp4,
    paddingBottom: Spacing.sp8,
  },
  groupContainer: {
    marginTop: Spacing.sp4,
  },
  groupHeader: {
    paddingVertical: Spacing.sp3,
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
    marginBottom: Spacing.sp2,
  },
  groupDateText: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.papel2,
    padding: Spacing.sp4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
    borderRadius: 0,
    marginBottom: Spacing.sp2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  taskId: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
    borderRadius: 0,
  },
  priorityText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  taskTitle: {
    fontFamily: Fonts.barlowSemiBold,
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
    marginBottom: Spacing.sp3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.grafite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sp4,
    borderRadius: 0,
  },
  emptyIconText: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    color: Colors.grafite,
  },
  emptyTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    letterSpacing: 0.5,
  },
  emptyDescription: {
    marginTop: Spacing.sp2,
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.4,
  },
});
