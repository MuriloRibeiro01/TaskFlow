import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';

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

const TASKS_TODAY: Task[] = [
  { id: 'T-001', title: 'Implementar CRUD de Tarefas', priority: 'Alta', status: 'in_progress', minutes: 50, totalPips: 3, donePips: 1 },
  { id: 'T-002', title: 'Design das telas no Figma', priority: 'Média', status: 'pending', minutes: 37, totalPips: 3, donePips: 0 },
  { id: 'T-003', title: 'Setup do projeto', priority: 'Baixa', status: 'done', minutes: 25, totalPips: 2, donePips: 2 },
];

const TASKS_TOMORROW: Task[] = [];

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
  if (priority === 'Baixa') return null;

  const isAlta = priority === 'Alta';
  const symbol = isAlta ? '▲' : '—';
  const color = isAlta ? Colors.vermelho : Colors.grafite;
  const bg = isAlta ? 'rgba(214,59,47,0.08)' : 'rgba(14,14,15,0.06)';

  return (
    <View style={[styles.priorityBadge, { backgroundColor: bg }]}>
      <Text style={[styles.priorityText, { color, fontFamily: Fonts.mono }]}>
        {symbol} {priority}
      </Text>
    </View>
  );
}

function TaskCard({ task }: { task: Task }) {
  const isDone = task.status === 'done';
  const isActive = task.status === 'in_progress';

  const leftBorderColor = isActive
    ? Colors.vermelho
    : isDone
    ? Colors.tinta
    : 'transparent';

  const cardBg = isDone ? Colors.papel2 : isActive ? Colors.papel3 : Colors.papel2;

  return (
    <View style={[styles.card, { opacity: isDone ? 0.5 : 1, backgroundColor: cardBg }]}>
      <View style={[styles.cardLeftBorder, { backgroundColor: leftBorderColor }]} />
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
          <Text style={[styles.pipsLabel, { fontFamily: Fonts.mono }]}>
            {task.donePips}/{task.totalPips} pom.
          </Text>
          <Text style={[styles.timeText, { fontFamily: Fonts.mono }]}>{task.minutes} min</Text>
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
  const [today] = useState(() =>
    new Date()
      .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .toUpperCase()
  );

  const completed = TASKS_TODAY.filter(t => t.status === 'done').length;
  const totalMins = TASKS_TODAY.reduce((acc, t) => acc + t.minutes, 0);
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
          <Text style={[styles.headerDate, { fontFamily: Fonts.mono }]}>{today}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.plusButton} onPress={() => console.log('Nova tarefa')}>
          <Text style={[styles.plusText, { fontFamily: Fonts.barlowBold }]}>+</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text style={[styles.summaryText, { fontFamily: Fonts.mono }]}>
          {completed} de {TASKS_TODAY.length} tarefas.{'  '}{focusLabel}.
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={[styles.sectionLabel, { fontFamily: Fonts.mono }]}>HOJE</Text>
        {TASKS_TODAY.map(task => <TaskCard key={task.id} task={task} />)}

        <Text style={[styles.sectionLabel, { fontFamily: Fonts.mono }]}>AMANHÃ</Text>
        {TASKS_TOMORROW.length === 0 && (
          <Text style={[styles.emptyText, { fontFamily: Fonts.mono }]}>
            Nenhuma tarefa. Adicione uma.
          </Text>
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
