import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Priority = 'Alta' | 'Média' | 'Baixa';
type Status = 'em foco' | 'pendente' | 'concluída';

interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  minutes: number;
  sessions: number;
}

const TASKS_TODAY: Task[] = [
  { id: 'T-001', title: 'Implementar CRUD de Tarefas', priority: 'Alta', status: 'em foco', minutes: 50, sessions: 3 },
  { id: 'T-002', title: 'Design das telas no Figma', priority: 'Média', status: 'pendente', minutes: 37, sessions: 3 },
  { id: 'T-003', title: 'Setup do projeto', priority: 'Baixa', status: 'concluída', minutes: 25, sessions: 2 },
];

const TASKS_TOMORROW: Task[] = [];

const PRIORITY_COLORS: Record<Priority, string> = {
  Alta: '#E53935',
  Média: '#757575',
  Baixa: '#757575',
};

const PRIORITY_ICONS: Record<Priority, string> = {
  Alta: '▲',
  Média: '—',
  Baixa: '▼',
};

const STATUS_COLORS: Record<Status, string> = {
  'em foco': '#E53935',
  'pendente': '#757575',
  'concluída': '#4CAF50',
};

function SessionDots({ total, filled }: { total: number; filled: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i < filled ? styles.dotFilled : styles.dotEmpty]}
        />
      ))}
    </View>
  );
}

function TaskCard({ task }: { task: Task }) {
  const isDone = task.status === 'concluída';
  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.cardRow}>
        <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.taskId}>{task.id}</Text>
            <View style={styles.priorityBadge}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[task.priority] }]}>
                {PRIORITY_ICONS[task.priority]} {task.priority}
              </Text>
            </View>
          </View>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>{task.title}</Text>
          <View style={styles.cardFooter}>
            <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[task.status] }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[task.status] }]}>
                {isDone ? '✓' : '—'} {task.status}
              </Text>
            </View>
            <SessionDots total={task.sessions} filled={isDone ? task.sessions : 1} />
            <Text style={styles.timeText}>{task.minutes} min</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function Index() {
  const [today] = useState(() =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .toUpperCase()
  );

  const completed = TASKS_TODAY.filter(t => t.status === 'concluída').length;
  const totalFocus = TASKS_TODAY.reduce((acc, t) => acc + t.minutes, 0);
  const focusHours = Math.floor(totalFocus / 60);
  const focusMins = totalFocus % 60;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TAREFAS DE HOJE</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.plusButton} onPress={() => console.log('Nova tarefa')}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {completed} DE {TASKS_TODAY.length} TAREFAS
          {'  ·  '}
          {focusHours}H {focusMins}MIN DE FOCO
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionLabel}>HOJE</Text>
        {TASKS_TODAY.map(task => <TaskCard key={task.id} task={task} />)}

        <Text style={styles.sectionLabel}>AMANHÃ</Text>
        {TASKS_TOMORROW.length === 0 && (
          <Text style={styles.emptyText}>Nenhuma tarefa para amanhã.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  headerDate: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  plusButton: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 26,
    color: '#fff',
    lineHeight: 30,
  },
  summary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  summaryText: {
    fontSize: 12,
    color: '#757575',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardDone: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: 'row',
  },
  priorityBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  taskId: {
    fontSize: 11,
    color: '#9E9E9E',
    letterSpacing: 0.5,
  },
  priorityBadge: {},
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  taskTitle: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
    marginBottom: 10,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9E9E9E',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  dotFilled: {
    backgroundColor: '#E53935',
  },
  dotEmpty: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: 'transparent',
  },
  timeText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  emptyText: {
    fontSize: 13,
    color: '#BDBDBD',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
