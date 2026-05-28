import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { getAllTasks } from '@/database/tasks';
import { Task as DBTask } from '@/types/task.types';

type Priority = 'Alta' | 'Média' | 'Baixa';
type Status = 'in_progress' | 'pending' | 'done';

interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  minutes: number;
  totalPips: number;
  donePips: number;
}

function dbTaskToView(t: DBTask): Task {
  const priorityMap: Record<string, Priority> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  const estimated = t.estimated_pomodoros ?? 0;
  const completed = t.completed_pomodoros ?? 0;
  return {
    id: `T-${String(t.id).padStart(3, '0')}`,
    title: t.title,
    priority: priorityMap[t.priority] ?? 'Baixa',
    status: (t.status as Status) ?? 'pending',
    minutes: estimated * 25,
    totalPips: estimated,
    donePips: completed,
  };
}

function isoDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function splitByDate(tasks: DBTask[]): { today: Task[]; tomorrow: Task[] } {
  const todayStr = isoDateStr(new Date());
  const tomorrowStr = isoDateStr(new Date(Date.now() + 86400000));

  const today: Task[] = [];
  const tomorrow: Task[] = [];

  for (const t of tasks) {
    if (t.due_date) {
      // due_date stored as ISO "YYYY-MM-DD ..." — compare first 10 chars
      const dueDay = t.due_date.substring(0, 10);
      if (dueDay === tomorrowStr) {
        tomorrow.push(dbTaskToView(t));
      } else {
        today.push(dbTaskToView(t));
      }
    } else {
      // sem due_date: mostrar só se criada hoje
      const createdDay = t.created_at ? t.created_at.substring(0, 10) : '';
      if (createdDay === todayStr) {
        today.push(dbTaskToView(t));
      }
    }
  }

  return { today, tomorrow };
}

function PipsDots({ total, done, current }: { total: number; done: number; current: number }) {
  return (
    <View style={styles.pipsRow}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < done;
        const isCurrent = !isDone && i === done && current > 0;
        return (
          <View
            key={i}
            style={[
              styles.pip,
              isDone && styles.pipDone,
              isCurrent && styles.pipCurrent,
              !isDone && !isCurrent && styles.pipPending,
            ]}
          />
        );
      })}
    </View>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, { symbol: string; color: string; bg: string }> = {
    Alta:  { symbol: '▲', color: Colors.vermelho, bg: 'rgba(214,59,47,0.08)' },
    Média: { symbol: '—', color: Colors.grafite,  bg: 'rgba(14,14,15,0.06)' },
    Baixa: { symbol: '▽', color: Colors.cinza,    bg: 'rgba(14,14,15,0.03)' },
  };
  const s = map[priority];
  return (
    <View style={[styles.priorityBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.priorityText, { color: s.color, fontFamily: Fonts.mono }]}>
        {s.symbol} {priority}
      </Text>
    </View>
  );
}

function TaskCard({ task }: { task: Task }) {
  const isDone = task.status === 'done';
  const isActive = task.status === 'in_progress';

  const leftBorderColor = isActive ? Colors.vermelho : isDone ? Colors.tinta : 'transparent';
  const cardBg = isActive ? Colors.papel3 : Colors.papel2;

  return (
    <View style={[styles.card, { opacity: isDone ? 0.5 : 1, backgroundColor: cardBg }]}>
      <View style={[styles.cardLeftBorder, { backgroundColor: leftBorderColor }]} />

      {/* Checkbox */}
      <View style={[styles.cardCheckbox, isDone && styles.cardCheckboxDone]}>
        {isDone && (
          <Text style={[styles.cardCheckboxMark, { fontFamily: Fonts.mono }]}>✓</Text>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.taskId, { fontFamily: Fonts.mono }]}>{task.id}</Text>
          <PriorityBadge priority={task.priority} />
        </View>

        <Text
          style={[
            styles.taskTitle,
            { fontFamily: Fonts.barlowSemiBold },
            isDone && styles.taskTitleDone,
          ]}
        >
          {task.title}
        </Text>

        <View style={styles.cardFooter}>
          <StatusBadge status={task.status} />
          <PipsDots total={task.totalPips} done={task.donePips} current={isActive ? 1 : 0} />
          {task.totalPips > 0 && (
            <Text style={[styles.pipsLabel, { fontFamily: Fonts.mono }]}>
              {task.donePips}/{task.totalPips} pom.
            </Text>
          )}
          {task.minutes > 0 && (
            <Text style={[styles.timeText, { fontFamily: Fonts.mono }]}>{task.minutes} min</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string; bg: string }> = {
    in_progress: { label: '● em foco', color: Colors.papel, bg: Colors.tinta },
    pending: { label: '— pendente', color: Colors.grafite, bg: 'rgba(14,14,15,0.06)' },
    done: { label: '✓ concluída', color: Colors.tinta, bg: 'rgba(14,14,15,0.06)' },
  };
  const s = map[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusText, { color: s.color, fontFamily: Fonts.mono }]}>{s.label}</Text>
    </View>
  );
}

export default function Index() {
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);

  const todayLabel = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks();
      const { today, tomorrow } = splitByDate(all);
      setTodayTasks(today);
      setTomorrowTasks(tomorrow);
    }, [])
  );

  const completed = todayTasks.filter(t => t.status === 'done').length;
  const totalMins = todayTasks.reduce((acc, t) => acc + t.minutes, 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const focusLabel = h > 0 ? `${h}h ${m}min de foco` : `${m}min de foco`;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { fontFamily: Fonts.barlowBold }]}>
            TAREFAS DE HOJE
          </Text>
          <Text style={[styles.headerDate, { fontFamily: Fonts.mono }]}>{todayLabel}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.plusButton} onPress={() => router.push('/nova-tarefa')}>
          <Text style={[styles.plusText, { fontFamily: Fonts.barlowBold }]}>+</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text style={[styles.summaryText, { fontFamily: Fonts.mono }]}>
          {completed} DE {todayTasks.length} TAREFAS{'  '}·{'  '}{focusLabel.toUpperCase()}
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={[styles.sectionLabel, { fontFamily: Fonts.mono }]}>HOJE</Text>
        {todayTasks.length === 0 && (
          <Text style={[styles.emptyText, { fontFamily: Fonts.mono }]}>
            Nenhuma tarefa. Adicione uma.
          </Text>
        )}
        {todayTasks.map(task => <TaskCard key={task.id} task={task} />)}

        <Text style={[styles.sectionLabel, { fontFamily: Fonts.mono }]}>AMANHÃ</Text>
        {tomorrowTasks.length === 0 && (
          <Text style={[styles.emptyText, { fontFamily: Fonts.mono }]}>
            Nenhuma tarefa. Adicione uma.
          </Text>
        )}
        {tomorrowTasks.map(task => <TaskCard key={task.id} task={task} />)}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp5,
    paddingHorizontal: Spacing.sp5,
    backgroundColor: Colors.tinta,
  },
  headerTitle: {
    fontSize: FontSize.headingXl,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    letterSpacing: 0.5,
  },
  plusButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.papel,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 24,
    color: Colors.papel,
    lineHeight: 28,
  },
  summary: {
    paddingHorizontal: Spacing.sp5,
    paddingVertical: Spacing.sp3,
    backgroundColor: Colors.papel,
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
  },
  summaryText: {
    fontSize: FontSize.label,
    color: Colors.grafite,
    letterSpacing: 0.3,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.sp4,
    paddingBottom: Spacing.sp6,
  },
  sectionLabel: {
    fontSize: FontSize.label,
    color: Colors.cinza,
    letterSpacing: 1,
    marginTop: Spacing.sp8,
    marginBottom: Spacing.sp2,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 0,
    marginBottom: Spacing.sp5,
  },
  cardLeftBorder: {
    width: 2,
  },
  cardCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: Colors.tinta,
    alignSelf: 'flex-start',
    marginTop: Spacing.sp4,
    marginLeft: Spacing.sp3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cardCheckboxDone: {
    backgroundColor: Colors.tinta,
    borderColor: Colors.tinta,
  },
  cardCheckboxMark: {
    color: Colors.papel,
    fontSize: 13,
    lineHeight: 16,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.sp4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  taskId: {
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  taskTitle: {
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
    marginBottom: Spacing.sp3,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.grafite,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sp2,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  pipsRow: {
    flexDirection: 'row',
    gap: Spacing.sp1,
    alignItems: 'center',
  },
  pip: {
    width: 6,
    height: 6,
  },
  pipDone: {
    backgroundColor: Colors.vermelho,
  },
  pipCurrent: {
    backgroundColor: Colors.tinta,
  },
  pipPending: {
    borderWidth: 1,
    borderColor: '#D6D3CB',
    backgroundColor: 'transparent',
  },
  pipsLabel: {
    fontSize: FontSize.label,
    color: Colors.cinza,
  },
  timeText: {
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginLeft: 'auto',
  },
  emptyText: {
    fontSize: FontSize.caption,
    color: Colors.cinza,
    marginTop: Spacing.sp2,
  },
});
