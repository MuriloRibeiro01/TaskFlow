import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { completeTask, deleteTask, getAllTasks, reopenTask } from '@/database/tasks';
import { Task as DBTask } from '@/types/task.types';
import { Trash2 } from 'lucide-react-native';
import { useAuth } from '@/database/context/auth_context';
import { Swipeable } from 'react-native-gesture-handler';

type Priority = 'Alta' | 'Média' | 'Baixa';
type Status = 'in_progress' | 'pending' | 'done';
type StatusFilter = 'all' | 'open';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high';
type FilterMenu = 'status' | 'priority' | null;

export interface Task {
  id: number;
  displayId: string;
  title: string;
  priority: Priority;
  status: Status;
  minutes: number;
  totalPips: number;
  donePips: number;
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  open: 'Não concluídas',
};

const PRIORITY_FILTER_LABELS: Record<PriorityFilter, string> = {
  all: 'Todas',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export function dbTaskToView(t: DBTask): Task {
  const priorityMap: Record<string, Priority> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  const estimated = t.estimated_pomodoros ?? 0;
  const completed = t.completed_pomodoros ?? 0;
  return {
    id: t.id,
    displayId: `T-${String(t.id).padStart(3, '0')}`,
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

export function TaskCard({ 
    task,
    selected = false,
    onPress,
    onCheck,
   }: {
    task: Task;
    selected?: boolean;
    onPress?: () => void;
    onCheck?: () =>  void;
   }) {
  const isDone = task.status === 'done';
  const isActive = task.status === 'in_progress';

  

  const leftBorderColor = isActive ? Colors.vermelho : isDone ? Colors.tinta : 'transparent';
  const cardBg = isActive ? Colors.papel3 : Colors.papel2;

  return (
    <Pressable onPress={onPress}>
      <View style={[
        styles.card,
        selected && {
          borderWidth: 2,
          borderColor: Colors.vermelho
        },
        { opacity: isDone ? 0.5 : 1, backgroundColor: cardBg }]}>
        <View style={[styles.cardLeftBorder, { backgroundColor: leftBorderColor }]} />

        {/* Checkbox */}
        <Pressable
          onPress={onCheck}
          style={[
              styles.cardCheckbox, 
              isDone && styles.cardCheckboxDone,
              ]}>
            {isDone && (
              <Text style={[styles.cardCheckboxMark, { fontFamily: Fonts.mono }]}>✓</Text>
            )}
        </Pressable>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={[styles.taskId, { fontFamily: Fonts.mono }]}>
              {task.displayId}
            </Text>

            <View style={styles.headerActions}>
              <PriorityBadge priority={task.priority} />
            </View>
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
    </Pressable>
  );
}

function SwipeableTaskCard({
  task,
  onCheck,
  onDelete,
}: {
  task: Task;
  onCheck: () => void;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  const requestDeletion = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable style={styles.swipeDeleteAction} onPress={requestDeletion}>
          <Trash2 size={19} color={Colors.papel} />
          <Text style={styles.swipeDeleteText}>EXCLUIR</Text>
        </Pressable>
      )}
    >
      <TaskCard task={task} onCheck={onCheck} />
    </Swipeable>
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

function filterTasks(tasks: Task[], statusFilter: StatusFilter, priorityFilter: PriorityFilter) {
  const priorityFilterMap: Record<Priority, PriorityFilter> = {
    Alta: 'high',
    Média: 'medium',
    Baixa: 'low',
  };

  return tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all' || task.status !== 'done';
    const matchesPriority = priorityFilter === 'all' || priorityFilterMap[task.priority] === priorityFilter;
    return matchesStatus && matchesPriority;
  });
}

export default function Index() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [openFilter, setOpenFilter] = useState<FilterMenu>(null);
  const [completedTask, setCompletedTask] = useState<Task | null>(null);
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<Task | null>(null);
  const completedToastOpacity = useRef(new Animated.Value(0)).current;
  const deleteConfirmationOpacity = useRef(new Animated.Value(0)).current;

  const todayLabel = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(userId);
      const { today, tomorrow } = splitByDate(all);
      setTodayTasks(today);
      setTomorrowTasks(tomorrow);
    }, [userId])
  );

  useEffect(() => {
    if (!completedTask) return;

    completedToastOpacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(completedToastOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(2800),
      Animated.timing(completedToastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setCompletedTask(null);
    });

    return () => animation.stop();
  }, [completedTask, completedToastOpacity]);

  useEffect(() => {
    if (!taskPendingDeletion) return;

    deleteConfirmationOpacity.setValue(0);
    const animation = Animated.timing(deleteConfirmationOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [deleteConfirmationOpacity, taskPendingDeletion]);

  const completed = todayTasks.filter(t => t.status === 'done').length;
  const totalMins = todayTasks.reduce((acc, t) => acc + t.minutes, 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const focusLabel = h > 0 ? `${h}h ${m}min de foco` : `${m}min de foco`;
  const progress = todayTasks.length > 0 ? (completed / todayTasks.length) * 100 : 0;
  const filteredTodayTasks = filterTasks(todayTasks, statusFilter, priorityFilter);
  const filteredTomorrowTasks = filterTasks(tomorrowTasks, statusFilter, priorityFilter);

  const refreshFromDatabase = () => {
    const all = getAllTasks(userId);
    const { today, tomorrow } = splitByDate(all);
    setTodayTasks(today);
    setTomorrowTasks(tomorrow);
  };

  const deleteTaskNow = (task: Task) => {
    deleteTask(task.id);
    refreshFromDatabase();
  };

  const dismissDeletion = (shouldDelete: boolean) => {
    const task = taskPendingDeletion;
    if (!task) return;

    Animated.timing(deleteConfirmationOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setTaskPendingDeletion(null);
      if (shouldDelete) deleteTaskNow(task);
    });
  };

  const handleCheck = (task: Task) => {
    const nextStatus: Status = task.status === 'done' ? 'pending' : 'done';

    if (nextStatus === 'done') completeTask(task.id);
    else reopenTask(task.id);

    const updateTask = (tasks: Task[]) => tasks.map((item) => (
      item.id === task.id
        ? { ...item, status: nextStatus, donePips: nextStatus === 'done' ? item.totalPips : 0 }
        : item
    ));
    setTodayTasks(updateTask);
    setTomorrowTasks(updateTask);

    if (nextStatus === 'done') setCompletedTask(task);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.headerTitle, { fontFamily: Fonts.barlowBold }]}>TAREFAS DE HOJE</Text>
            <Text style={[styles.headerDate, { fontFamily: Fonts.mono }]}>{todayLabel}</Text>
          </View>
          <Pressable style={styles.plusButton} onPress={() => router.push('/nova-tarefa')}>
            <Text style={[styles.plusText, { fontFamily: Fonts.barlowBold }]}>+</Text>
          </Pressable>
        </View>
        {/* TODO: conectar este menu ao fluxo de priorização com IA e à Matriz de Eisenhower. */}
        <View style={styles.eisenhowerMenu}>
          <Text style={styles.eisenhowerTitle}>Priorizar com IA</Text>
          <Text style={styles.eisenhowerMeta}>MATRIZ DE EISENHOWER →</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={[styles.summaryText, { fontFamily: Fonts.mono }]}>
          {completed} DE {todayTasks.length} TAREFAS{'  '}·{'  '}{focusLabel.toUpperCase()}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <View style={styles.filters}>
          <View style={styles.filterRow}>
            <Pressable style={styles.filterButton} onPress={() => setOpenFilter(openFilter === 'status' ? null : 'status')}>
              <Text style={styles.filterText}>status: {STATUS_FILTER_LABELS[statusFilter].toLowerCase()}</Text>
              <Text style={styles.filterChevron}>⌄</Text>
            </Pressable>
            <Pressable style={styles.filterButton} onPress={() => setOpenFilter(openFilter === 'priority' ? null : 'priority')}>
              <Text style={styles.filterText}>prioridade: {PRIORITY_FILTER_LABELS[priorityFilter].toLowerCase()}</Text>
              <Text style={styles.filterChevron}>⌄</Text>
            </Pressable>
          </View>
          {openFilter === 'status' && (
            <View style={styles.filterMenu}>
              {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((option) => (
                <Pressable key={option} style={styles.filterOption} onPress={() => { setStatusFilter(option); setOpenFilter(null); }}>
                  <Text style={styles.filterOptionText}>{STATUS_FILTER_LABELS[option]}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {openFilter === 'priority' && (
            <View style={styles.filterMenu}>
              {(Object.keys(PRIORITY_FILTER_LABELS) as PriorityFilter[]).map((option) => (
                <Pressable key={option} style={styles.filterOption} onPress={() => { setPriorityFilter(option); setOpenFilter(null); }}>
                  <Text style={styles.filterOptionText}>{PRIORITY_FILTER_LABELS[option]}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {todayTasks.length === 0 && tomorrowTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>☰</Text></View>
            <Text style={styles.emptyTitle}>NENHUMA TAREFA</Text>
            <Text style={styles.emptyDescription}>ADICIONE UMA PARA{`\n`}COMEÇAR O DIA.</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>HOJE</Text>
              <Text style={styles.sectionMeta}>{todayTasks.length} TAREFAS</Text>
            </View>
            {filteredTodayTasks.length === 0 ? (
              <Text style={styles.emptyText}>NENHUMA TAREFA COM ESTES FILTROS.</Text>
            ) : filteredTodayTasks.map((task) => (
              <SwipeableTaskCard key={task.id} task={task} onDelete={() => setTaskPendingDeletion(task)} onCheck={() => handleCheck(task)} />
            ))}

            {tomorrowTasks.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>AMANHÃ</Text>
                  <Text style={styles.sectionMeta}>{tomorrowTasks.length} TAREFAS</Text>
                </View>
                {filteredTomorrowTasks.length === 0 ? (
                  <Text style={styles.emptyText}>NENHUMA TAREFA COM ESTES FILTROS.</Text>
                ) : filteredTomorrowTasks.map((task) => (
                  <SwipeableTaskCard key={task.id} task={task} onDelete={() => setTaskPendingDeletion(task)} onCheck={() => handleCheck(task)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      {completedTask && (
        <Animated.View style={[styles.completedToast, { opacity: completedToastOpacity }]}>
          <Text style={styles.completedToastTitle}>✓  TAREFA CONCLUÍDA</Text>
          <Text style={styles.completedToastMessage}>{completedTask.displayId} · {completedTask.title}</Text>
        </Animated.View>
      )}
      {taskPendingDeletion && (
        <Animated.View style={[styles.deleteOverlay, { opacity: deleteConfirmationOpacity }]}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>EXCLUIR TAREFA?</Text>
            <Text style={styles.deleteDialogMessage} numberOfLines={2}>{taskPendingDeletion.title}</Text>
            <View style={styles.deleteDialogActions}>
              <Pressable style={styles.cancelDeleteButton} onPress={() => dismissDeletion(false)}>
                <Text style={styles.cancelDeleteText}>CANCELAR</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={() => dismissDeletion(true)}>
                <Text style={styles.confirmDeleteText}>EXCLUIR</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.papel,
  },
  header: {
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp5,
    paddingHorizontal: Spacing.sp5,
    backgroundColor: Colors.tinta,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    textAlign: 'center',
    fontSize: 24,
    color: Colors.papel,
    lineHeight: 26,
    transform: [{ translateY: -2 }],
  },
  eisenhowerMenu: {
    minHeight: 44,
    marginTop: Spacing.sp4,
    paddingHorizontal: Spacing.sp3,
    borderWidth: 1,
    borderColor: '#403F3B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eisenhowerTitle: {
    fontFamily: Fonts.barlowSemiBold,
    fontSize: FontSize.taskTitle,
    color: Colors.papel,
  },
  eisenhowerMeta: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.25,
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
  progressTrack: {
    height: 3,
    marginTop: Spacing.sp2,
    backgroundColor: Colors.papel3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.vermelho,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.sp4,
    paddingBottom: Spacing.sp6,
  },
  filters: {
    marginTop: Spacing.sp4,
    marginBottom: Spacing.sp4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sp2,
  },
  filterButton: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: Spacing.sp3,
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.grafite,
  },
  filterChevron: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.grafite
  },
  filterMenu: {
    marginTop: Spacing.sp2,
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
  },
  filterOption: {
    minHeight: 38,
    paddingHorizontal: Spacing.sp3,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
  },
  filterOptionText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.grafite,
  },
  sectionHeader: {
    marginTop: Spacing.sp4,
    marginBottom: Spacing.sp3,
    paddingBottom: Spacing.sp2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
    letterSpacing: 0.4,
  },
  sectionMeta: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.cinza,
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
  swipeDeleteAction: {
    width: 104,
    marginBottom: Spacing.sp5,
    backgroundColor: Colors.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sp1,
  },
  swipeDeleteText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
    letterSpacing: 0.3,
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
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.cinza,
    marginTop: Spacing.sp2,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    marginBottom: Spacing.sp4,
    borderWidth: 1,
    borderColor: Colors.grafite,
    alignItems: 'center',
    justifyContent: 'center',
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
  completedToast: {
    position: 'absolute',
    right: Spacing.sp4,
    bottom: 88,
    left: Spacing.sp4,
    padding: Spacing.sp4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.vermelho,
    backgroundColor: Colors.tinta,
  },
  completedToastTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.caption,
    color: Colors.papel,
    letterSpacing: 0.4,
  },
  completedToastMessage: {
    marginTop: Spacing.sp1,
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.grafite,
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: Spacing.sp5,
    backgroundColor: 'rgba(14,14,15,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialog: {
    width: '100%',
    maxWidth: 340,
    padding: Spacing.sp5,
    backgroundColor: Colors.papel,
    borderTopWidth: 3,
    borderTopColor: Colors.vermelho,
  },
  deleteDialogTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingLg,
    color: Colors.tinta,
    letterSpacing: 0.5,
  },
  deleteDialogMessage: {
    marginTop: Spacing.sp2,
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
  },
  deleteDialogActions: {
    flexDirection: 'row',
    gap: Spacing.sp2,
    marginTop: Spacing.sp5,
  },
  cancelDeleteButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 40,
    backgroundColor: Colors.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDeleteText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    letterSpacing: 0.2,
  },
  confirmDeleteText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

});
