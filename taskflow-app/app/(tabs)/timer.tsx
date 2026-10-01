import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { getAllTasks } from '@/database/tasks';
import { recordCompletedPomodoro } from '@/database/pomodoro';
import { Task as DBTask } from '@/types/task.types';
import { useAuth } from '@/database/context/auth_context';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const INCREMENT_SECONDS = 15 * 60;
const SETUP_STEP_SECONDS = 5 * 60;
const MIN_FOCUS_SECONDS = 5 * 60;

type TimerMode = 'focus' | 'break';
type Priority = 'Alta' | 'Média' | 'Baixa';
type TimerTask = {
  id: number;
  displayId: string;
  title: string;
  priority: Priority;
  estimatedPomodoros: number;
  completedPomodoros: number;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isTaskForToday(task: DBTask) {
  return (task.due_date ?? task.created_at)?.substring(0, 10) === dateKey(new Date());
}

function toTimerTask(task: DBTask): TimerTask {
  const priorities: Record<string, Priority> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  return {
    id: task.id,
    displayId: `T-${String(task.id).padStart(3, '0')}`,
    title: task.title,
    priority: priorities[task.priority] ?? 'Baixa',
    estimatedPomodoros: Math.max(1, task.estimated_pomodoros ?? 1),
    completedPomodoros: task.completed_pomodoros ?? 0,
  };
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function formatSessionDuration(pomodoros: number, focusSeconds = FOCUS_SECONDS) {
  const minutes = Math.round((pomodoros * focusSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}H ${String(remainder).padStart(2, '0')}MIN` : `${minutes} MIN`;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const priorityData: Record<Priority, { symbol: string; color: string; backgroundColor: string }> = {
    Alta: { symbol: '▲', color: Colors.vermelho, backgroundColor: 'rgba(214,59,47,0.08)' },
    Média: { symbol: '—', color: Colors.grafite, backgroundColor: Colors.papel3 },
    Baixa: { symbol: '▽', color: Colors.cinza, backgroundColor: 'rgba(14,14,15,0.03)' },
  };
  const data = priorityData[priority];
  return (
    <View style={[styles.priorityBadge, { backgroundColor: data.backgroundColor }]}>
      <Text style={[styles.priorityText, { color: data.color }]}>
        {data.symbol} {priority.toUpperCase()}
      </Text>
    </View>
  );
}

function TaskSelectionCard({
  task,
  selected,
  onPress,
  active,
  completed,
}: {
  task: TimerTask;
  selected: boolean;
  onPress?: () => void;
  active?: boolean;
  completed?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.taskCard,
        selected && styles.taskCardSelected,
        active && styles.taskCardActive,
        completed && styles.taskCardCompleted,
      ]}
    >
      {!active && (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
      )}
      <View style={styles.taskContent}>
        <View style={styles.taskTopRow}>
          <Text style={styles.taskId}>{task.displayId}</Text>
          <PriorityBadge priority={task.priority} />
        </View>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <View style={styles.taskBottomRow}>
          {active && <Text style={styles.focusBadge}>◉ EM FOCO</Text>}
          {completed && <Text style={styles.completedBadge}>✓ CONCLUÍDA</Text>}
          <Text style={styles.taskMeta}>
            {task.completedPomodoros} / {task.estimatedPomodoros} POM.
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Timer() {
  const { user } = useAuth();
  const [todayTasks, setTodayTasks] = useState<TimerTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [completedCycles, setCompletedCycles] = useState(0);
  const [sessionTotalPomodoros, setSessionTotalPomodoros] = useState(0);
  const [setupFocusSeconds, setSetupFocusSeconds] = useState(FOCUS_SECONDS);
  const [cycleTotalSeconds, setCycleTotalSeconds] = useState(FOCUS_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(FOCUS_SECONDS);

  useFocusEffect(
    useCallback(() => {
      const tasks = getAllTasks(user?.id ?? '')
        .filter(isTaskForToday)
        .filter((task) => task.status !== 'done')
        .map(toTimerTask);
      setTodayTasks(tasks);
      setSelectedTaskIds((ids) => ids.filter((id) => tasks.some((task) => task.id === id)));
    }, [user?.id])
  );

  const selectedTasks = useMemo(
    () => todayTasks.filter((task) => selectedTaskIds.includes(task.id)),
    [selectedTaskIds, todayTasks]
  );
  const pendingSelectedTasks = useMemo(
    () => selectedTasks.filter((task) => task.completedPomodoros < task.estimatedPomodoros),
    [selectedTasks]
  );
  const completedSelectedTasks = useMemo(
    () => selectedTasks.filter((task) => task.completedPomodoros >= task.estimatedPomodoros),
    [selectedTasks]
  );
  const availablePomodoros = useMemo(
    () => pendingSelectedTasks.reduce(
      (total, task) => total + (task.estimatedPomodoros - task.completedPomodoros),
      0
    ),
    [pendingSelectedTasks]
  );
  const totalPomodoros = hasStarted ? sessionTotalPomodoros : availablePomodoros;
  const activeTask = pendingSelectedTasks[0] ?? null;
  const progress = cycleTotalSeconds > 0
    ? Math.max(0, Math.min(1, remainingSeconds / cycleTotalSeconds))
    : 0;
  const isBreak = mode === 'break';
  const displaySeconds = hasStarted ? remainingSeconds : setupFocusSeconds;
  const displayProgress = hasStarted ? progress : 1;

  useEffect(() => {
    if (!isRunning || isFinished) return;

    const interval = setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isFinished, isRunning]);

  useEffect(() => {
    if (!isRunning || isFinished || remainingSeconds > 0) return;

    if (mode === 'break') {
      setMode('focus');
      setCycleTotalSeconds(setupFocusSeconds);
      setRemainingSeconds(setupFocusSeconds);
      return;
    }

    if (!activeTask) {
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    let completedPomodoros = activeTask.completedPomodoros + 1;
    if (user?.id && activeTask.id > 0) {
      const result = recordCompletedPomodoro({
        task_id: activeTask.id,
        user_id: user.id,
        duration_seconds: cycleTotalSeconds,
      });
      completedPomodoros = result.completedPomodoros;
    }

    setTodayTasks((tasks) => tasks.map((task) => (
      task.id === activeTask.id ? { ...task, completedPomodoros } : task
    )));

    const nextCompletedCycles = completedCycles + 1;
    setCompletedCycles(nextCompletedCycles);

    if (nextCompletedCycles >= sessionTotalPomodoros) {
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    setMode('break');
    setCycleTotalSeconds(BREAK_SECONDS);
    setRemainingSeconds(BREAK_SECONDS);
  }, [
    activeTask,
    completedCycles,
    cycleTotalSeconds,
    isFinished,
    isRunning,
    mode,
    remainingSeconds,
    sessionTotalPomodoros,
    setupFocusSeconds,
    user?.id,
  ]);

  const toggleTask = (id: number) => {
    setSelectedTaskIds((ids) => (
      ids.includes(id) ? ids.filter((taskId) => taskId !== id) : [...ids, id]
    ));
  };
  const startOrResumeTimer = () => {
    if (pendingSelectedTasks.length === 0) return;
    if (!hasStarted) {
      setSessionTotalPomodoros(availablePomodoros);
      setCompletedCycles(0);
      setCycleTotalSeconds(setupFocusSeconds);
      setRemainingSeconds(setupFocusSeconds);
    }
    setHasStarted(true);
    setIsFinished(false);
    setIsRunning(true);
  };
  const incrementCycle = () => {
    if (isBreak || isFinished) return;
    setRemainingSeconds((seconds) => seconds + INCREMENT_SECONDS);
    setCycleTotalSeconds((seconds) => seconds + INCREMENT_SECONDS);
  };
  const cancelTimer = () => {
    setIsRunning(false);
    setHasStarted(false);
    setIsFinished(false);
    setMode('focus');
    setCompletedCycles(0);
    setSessionTotalPomodoros(0);
    setCycleTotalSeconds(setupFocusSeconds);
    setRemainingSeconds(setupFocusSeconds);
  };
  const displayTitle = !hasStarted ? 'NOVO POMODORO' : isFinished ? 'SESSÃO CONCLUÍDA' : isBreak ? 'INTERVALO' : 'POMODORO ATUAL';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TIMER</Text>
        {hasStarted && !isFinished && (
          <Text style={[styles.headerStatus, isRunning && styles.headerStatusActive]}>
            {isRunning ? (isBreak ? 'PAUSA' : 'FOCO') : 'PAUSADO'}
          </Text>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.timerHeading}>{displayTitle}</Text>
        <View style={[styles.timerBox, hasStarted && styles.timerBoxActive]}>
          <View style={[styles.timerCorner, styles.timerCornerTopLeft]} />
          <View style={[styles.timerCorner, styles.timerCornerTopRight]} />
          <View style={[styles.timerCorner, styles.timerCornerBottomLeft]} />
          <View style={[styles.timerCorner, styles.timerCornerBottomRight]} />
          <Text style={styles.timerText}>{formatTime(displaySeconds)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }]} />
          </View>
          <Text style={styles.timerMode}>{isFinished ? 'CONCLUÍDA' : isBreak ? 'INTERVALO' : 'FOCO'}</Text>
        </View>

        {hasStarted ? (
          <>
            <View style={styles.timerControls}>
              <Pressable
                style={styles.primaryControl}
                onPress={isRunning ? () => setIsRunning(false) : startOrResumeTimer}
              >
                <Text style={styles.primaryControlText}>{isRunning ? 'Pausar' : 'Retomar'}</Text>
              </Pressable>
              <Pressable
                disabled={isBreak || isFinished}
                style={[styles.incrementControl, (isBreak || isFinished) && styles.controlDisabled]}
                onPress={incrementCycle}
              >
                <Text style={styles.incrementControlText}>15 MIN +</Text>
              </Pressable>
              <Pressable style={styles.cancelControl} onPress={cancelTimer}>
                <Text style={styles.cancelControlText}>Cancelar</Text>
              </Pressable>
            </View>
            <Text style={styles.intervalLabel}>INTERVALO: 5 MINUTOS</Text>
            <View style={styles.cycleRow}>
              {Array.from({ length: totalPomodoros }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.cycleDot,
                    index < completedCycles && styles.cycleDotDone,
                    index === completedCycles
                      && !isFinished
                      && mode === 'focus'
                      && styles.cycleDotCurrent,
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.durationRow}>
              <Pressable
                accessibilityLabel="Reduzir duração do pomodoro"
                style={styles.durationButton}
                onPress={() => setSetupFocusSeconds((seconds) => Math.max(MIN_FOCUS_SECONDS, seconds - SETUP_STEP_SECONDS))}
              >
                <Text style={styles.durationButtonText}>−</Text>
              </Pressable>
              <Text style={styles.durationValue}>{formatTime(setupFocusSeconds)}</Text>
              <Pressable
                accessibilityLabel="Aumentar duração do pomodoro"
                style={styles.durationButton}
                onPress={() => setSetupFocusSeconds((seconds) => seconds + SETUP_STEP_SECONDS)}
              >
                <Text style={styles.durationButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.intervalLabel}>INTERVALO: 5 MINUTOS</Text>
          </>
        )}

        {!hasStarted ? (
          <>
            <Text style={styles.sectionTitle}>SELECIONAR TAREFAS</Text>
            {todayTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>NENHUMA TAREFA PARA HOJE</Text>
                <Text style={styles.emptyDescription}>
                  ADICIONE UMA TAREFA COM DATA DE HOJE PARA INICIAR.
                </Text>
              </View>
            ) : (
              todayTasks.map((task) => (
                <TaskSelectionCard
                  key={task.id}
                  task={task}
                  selected={selectedTaskIds.includes(task.id)}
                  onPress={() => toggleTask(task.id)}
                />
              ))
            )}
            {pendingSelectedTasks.length > 0 && (
              <>
                <Text style={styles.sessionSummary}>
                  SESSÃO: {formatSessionDuration(totalPomodoros, setupFocusSeconds)} · {totalPomodoros} POMODOROS
                </Text>
                <Pressable style={styles.startButton} onPress={startOrResumeTimer}>
                  <Text style={styles.startButtonText}>COMEÇAR TIMER</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.selectedTasksHeading}>
              <Text style={styles.sectionTitle}>TAREFAS SELECIONADAS</Text>
              <Text style={styles.sessionSummary}>
                {formatSessionDuration(totalPomodoros, setupFocusSeconds)}
              </Text>
            </View>
            {pendingSelectedTasks.map((task) => (
              <TaskSelectionCard
                key={task.id}
                task={task}
                selected
                active={mode === 'focus' && task.id === activeTask?.id}
              />
            ))}
            {completedSelectedTasks.length > 0 && (
              <>
                <Text style={styles.completedSectionTitle}>TAREFAS CONCLUÍDAS</Text>
                {completedSelectedTasks.map((task) => (
                  <TaskSelectionCard key={task.id} task={task} selected completed />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.papel },
  header: { minHeight: 128, paddingTop: 60, paddingHorizontal: Spacing.sp5, paddingBottom: Spacing.sp5, backgroundColor: Colors.tinta, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle: { fontFamily: Fonts.barlowBold, fontSize: FontSize.headingLg, color: Colors.papel, letterSpacing: 0.5 },
  headerStatus: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, letterSpacing: 1.8 },
  headerStatusActive: { color: Colors.vermelho },
  content: { padding: Spacing.sp5, paddingBottom: 112 },
  timerHeading: { fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: Colors.tinta, marginBottom: Spacing.sp5 },
  timerBox: { width: 220, height: 220, alignSelf: 'center', paddingHorizontal: Spacing.sp3, borderWidth: 1, borderColor: Colors.tinta, alignItems: 'center', justifyContent: 'center' },
  timerBoxActive: { borderColor: Colors.vermelho },
  timerCorner: { position: 'absolute', width: 8, height: 8, backgroundColor: Colors.vermelho },
  timerCornerTopLeft: { top: -4, left: -4 },
  timerCornerTopRight: { top: -4, right: -4 },
  timerCornerBottomLeft: { bottom: -4, left: -4 },
  timerCornerBottomRight: { right: -4, bottom: -4 },
  timerText: { fontFamily: Fonts.barlowBlackItalic, fontSize: 56, color: Colors.tinta, letterSpacing: -1 },
  progressTrack: { width: '76%', height: 4, marginTop: Spacing.sp6, backgroundColor: Colors.papel3 },
  progressFill: { height: '100%', backgroundColor: Colors.vermelho },
  timerMode: { marginTop: Spacing.sp4, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, letterSpacing: 2 },
  durationRow: { marginTop: Spacing.sp5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sp5 },
  durationButton: { width: 42, height: 42, borderWidth: 1, borderColor: Colors.tinta, alignItems: 'center', justifyContent: 'center' },
  durationButtonText: { fontFamily: Fonts.mono, fontSize: FontSize.body, color: Colors.tinta },
  durationValue: { fontFamily: Fonts.mono, fontSize: FontSize.headingMd, color: Colors.tinta, letterSpacing: 1 },
  intervalLabel: { marginTop: Spacing.sp3, textAlign: 'center', fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, letterSpacing: 0.7 },
  timerControls: { marginTop: Spacing.sp6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sp1 },
  primaryControl: { minWidth: 104, minHeight: 54, backgroundColor: Colors.tinta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sp3 },
  primaryControlText: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.headingMd, color: Colors.papel },
  incrementControl: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  incrementControlText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.vermelho, letterSpacing: 0.6 },
  cancelControl: { minWidth: 84, minHeight: 54, borderWidth: 1, borderColor: Colors.papel3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sp2 },
  cancelControlText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.grafite, letterSpacing: 0.3 },
  controlDisabled: { opacity: 0.35 },
  cycleRow: { marginTop: Spacing.sp5, flexDirection: 'row', justifyContent: 'center', gap: Spacing.sp2, flexWrap: 'wrap' },
  cycleDot: { width: 12, height: 12, borderWidth: 1, borderColor: Colors.papel3 },
  cycleDotDone: { borderColor: Colors.vermelho, backgroundColor: Colors.vermelho },
  cycleDotCurrent: { borderColor: Colors.tinta, backgroundColor: Colors.tinta },
  sectionTitle: { marginTop: Spacing.sp10, marginBottom: Spacing.sp4, fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: Colors.tinta },
  taskCard: { minHeight: 116, marginBottom: Spacing.sp3, padding: Spacing.sp4, backgroundColor: Colors.papel2, flexDirection: 'row', gap: Spacing.sp3 },
  taskCardSelected: { borderLeftWidth: 3, borderLeftColor: Colors.vermelho, backgroundColor: Colors.papel3 },
  taskCardActive: { borderWidth: 1, borderColor: Colors.papel3, borderLeftWidth: 3, borderLeftColor: Colors.vermelho, backgroundColor: Colors.papel },
  taskCardCompleted: { opacity: 0.55, borderLeftColor: Colors.tinta },
  checkbox: { width: 24, height: 24, marginTop: 2, borderWidth: 1, borderColor: Colors.tinta, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: Colors.tinta },
  checkboxMark: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.papel },
  taskContent: { flex: 1 },
  taskTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskId: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, letterSpacing: 0.3 },
  priorityBadge: { paddingVertical: 3, paddingHorizontal: Spacing.sp2 },
  priorityText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, letterSpacing: 0.2 },
  taskTitle: { marginTop: Spacing.sp2, fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.taskTitle, color: Colors.tinta },
  taskBottomRow: { marginTop: Spacing.sp3, flexDirection: 'row', alignItems: 'center', gap: Spacing.sp2 },
  focusBadge: { paddingVertical: 2, paddingHorizontal: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.papel, backgroundColor: Colors.tinta, letterSpacing: 0.2 },
  completedBadge: { paddingVertical: 2, paddingHorizontal: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.papel, backgroundColor: Colors.tinta, letterSpacing: 0.2 },
  taskMeta: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza },
  sessionSummary: { marginTop: Spacing.sp3, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, letterSpacing: 0.3 },
  startButton: { minHeight: 56, marginTop: Spacing.sp4, backgroundColor: Colors.vermelho, alignItems: 'center', justifyContent: 'center' },
  startButtonText: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.headingMd, color: Colors.papel },
  selectedTasksHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  completedSectionTitle: { marginTop: Spacing.sp6, marginBottom: Spacing.sp4, fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: Colors.tinta },
  emptyState: { padding: Spacing.sp5, borderWidth: 1, borderColor: Colors.papel3, alignItems: 'center' },
  emptyTitle: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.body, color: Colors.cinza },
  emptyDescription: { marginTop: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: Colors.cinza, textAlign: 'center', lineHeight: 15 },
});
