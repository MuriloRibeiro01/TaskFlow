import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  TimerTask,
  Priority,
  useTimerViewModel,
  formatTime,
  formatSessionDuration,
} from '@/hooks/useTimerViewModel';

function PriorityBadge({ priority }: { priority: Priority }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const priorityData: Record<Priority, { symbol: string; color: string; backgroundColor: string }> = {
    Alta: { symbol: '▲', color: colors.vermelho, backgroundColor: 'rgba(214,59,47,0.08)' },
    Média: { symbol: '—', color: colors.grafite, backgroundColor: colors.papel3 },
    Baixa: { symbol: '▽', color: colors.cinza, backgroundColor: 'rgba(14,14,15,0.03)' },
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
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const {
    selectedTaskIds,
    isRunning,
    hasStarted,
    isFinished,
    isBreak,
    completedCycles,
    totalPomodoros,
    setupFocusSeconds,
    displaySeconds,
    displayProgress,
    displayTitle,
    activeTask,
    pendingSelectedTasks,
    completedSelectedTasks,
    todayTasks,
    toggleTask,
    startOrResumeTimer,
    incrementCycle,
    cancelTimer,
    setIsRunning,
    decreaseSetupDuration,
    increaseSetupDuration,
  } = useTimerViewModel();

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
                      && !isBreak
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
                onPress={decreaseSetupDuration}
              >
                <Text style={styles.durationButtonText}>−</Text>
              </Pressable>
              <Text style={styles.durationValue}>{formatTime(setupFocusSeconds)}</Text>
              <Pressable
                accessibilityLabel="Aumentar duração do pomodoro"
                style={styles.durationButton}
                onPress={increaseSetupDuration}
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
                active={!isBreak && task.id === activeTask?.id}
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

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.papel },
    header: { minHeight: 128, paddingTop: 60, paddingHorizontal: Spacing.sp5, paddingBottom: Spacing.sp5, backgroundColor: colors.tinta, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    headerTitle: { fontFamily: Fonts.barlowBold, fontSize: FontSize.headingLg, color: colors.textoClaro, letterSpacing: 0.5 },
    headerStatus: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, letterSpacing: 1.8 },
    headerStatusActive: { color: colors.vermelho },
    content: { padding: Spacing.sp5, paddingBottom: 112 },
    timerHeading: { fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: colors.tinta, marginBottom: Spacing.sp5 },
    timerBox: { width: 220, height: 220, alignSelf: 'center', paddingHorizontal: Spacing.sp3, borderWidth: 1, borderColor: colors.tinta, alignItems: 'center', justifyContent: 'center' },
    timerBoxActive: { borderColor: colors.vermelho },
    timerCorner: { position: 'absolute', width: 8, height: 8, backgroundColor: colors.vermelho },
    timerCornerTopLeft: { top: -4, left: -4 },
    timerCornerTopRight: { top: -4, right: -4 },
    timerCornerBottomLeft: { bottom: -4, left: -4 },
    timerCornerBottomRight: { right: -4, bottom: -4 },
    timerText: { fontFamily: Fonts.barlowBlackItalic, fontSize: 56, color: colors.tinta, letterSpacing: -1 },
    progressTrack: { width: '76%', height: 4, marginTop: Spacing.sp6, backgroundColor: colors.papel3 },
    progressFill: { height: '100%', backgroundColor: colors.vermelho },
    timerMode: { marginTop: Spacing.sp4, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, letterSpacing: 2 },
    durationRow: { marginTop: Spacing.sp5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sp5 },
    durationButton: { width: 42, height: 42, borderWidth: 1, borderColor: colors.tinta, alignItems: 'center', justifyContent: 'center' },
    durationButtonText: { fontFamily: Fonts.mono, fontSize: FontSize.body, color: colors.tinta },
    durationValue: { fontFamily: Fonts.mono, fontSize: FontSize.headingMd, color: colors.tinta, letterSpacing: 1 },
    intervalLabel: { marginTop: Spacing.sp3, textAlign: 'center', fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, letterSpacing: 0.7 },
    timerControls: { marginTop: Spacing.sp6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sp1 },
    primaryControl: { minWidth: 104, minHeight: 54, backgroundColor: colors.tinta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sp3 },
    primaryControlText: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.headingMd, color: colors.textoClaro },
    incrementControl: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
    incrementControlText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.vermelho, letterSpacing: 0.6 },
    cancelControl: { minWidth: 84, minHeight: 54, borderWidth: 1, borderColor: colors.papel3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sp2 },
    cancelControlText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.grafite, letterSpacing: 0.3 },
    controlDisabled: { opacity: 0.35 },
    cycleRow: { marginTop: Spacing.sp5, flexDirection: 'row', justifyContent: 'center', gap: Spacing.sp2, flexWrap: 'wrap' },
    cycleDot: { width: 12, height: 12, borderWidth: 1, borderColor: colors.papel3 },
    cycleDotDone: { borderColor: colors.vermelho, backgroundColor: colors.vermelho },
    cycleDotCurrent: { borderColor: colors.tinta, backgroundColor: colors.tinta },
    sectionTitle: { marginTop: Spacing.sp10, marginBottom: Spacing.sp4, fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: colors.tinta },
    taskCard: { minHeight: 116, marginBottom: Spacing.sp3, padding: Spacing.sp4, backgroundColor: colors.papel2, flexDirection: 'row', gap: Spacing.sp3 },
    taskCardSelected: { borderLeftWidth: 3, borderLeftColor: colors.vermelho, backgroundColor: colors.papel3 },
    taskCardActive: { borderWidth: 1, borderColor: colors.papel3, borderLeftWidth: 3, borderLeftColor: colors.vermelho, backgroundColor: colors.papel },
    taskCardCompleted: { opacity: 0.55, borderLeftColor: colors.tinta },
    checkbox: { width: 24, height: 24, marginTop: 2, borderWidth: 1, borderColor: colors.tinta, alignItems: 'center', justifyContent: 'center' },
    checkboxSelected: { backgroundColor: colors.tinta },
    checkboxMark: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.textoClaro },
    taskContent: { flex: 1 },
    taskTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    taskId: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, letterSpacing: 0.3 },
    priorityBadge: { paddingVertical: 3, paddingHorizontal: Spacing.sp2 },
    priorityText: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, letterSpacing: 0.2 },
    taskTitle: { marginTop: Spacing.sp2, fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.taskTitle, color: colors.tinta },
    taskBottomRow: { marginTop: Spacing.sp3, flexDirection: 'row', alignItems: 'center', gap: Spacing.sp2 },
    focusBadge: { paddingVertical: 2, paddingHorizontal: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.textoClaro, backgroundColor: colors.tinta, letterSpacing: 0.2 },
    completedBadge: { paddingVertical: 2, paddingHorizontal: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.textoClaro, backgroundColor: colors.tinta, letterSpacing: 0.2 },
    taskMeta: { fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza },
    sessionSummary: { marginTop: Spacing.sp3, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, letterSpacing: 0.3 },
    startButton: { minHeight: 56, marginTop: Spacing.sp4, backgroundColor: colors.vermelho, alignItems: 'center', justifyContent: 'center' },
    startButtonText: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.headingMd, color: colors.textoClaro },
    selectedTasksHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    completedSectionTitle: { marginTop: Spacing.sp6, marginBottom: Spacing.sp4, fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: colors.tinta },
    emptyState: { padding: Spacing.sp5, borderWidth: 1, borderColor: colors.papel3, alignItems: 'center' },
    emptyTitle: { fontFamily: Fonts.barlowSemiBold, fontSize: FontSize.body, color: colors.cinza },
    emptyDescription: { marginTop: Spacing.sp2, fontFamily: Fonts.mono, fontSize: FontSize.taskId, color: colors.cinza, textAlign: 'center', lineHeight: 15 },
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
