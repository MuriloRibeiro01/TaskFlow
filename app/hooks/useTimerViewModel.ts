import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { getAllTasks } from '@/database/tasks';
import { recordCompletedPomodoro } from '@/database/pomodoro';
import { Task as DBTask } from '@/types/task.types';
import { useAuth } from '@/database/context/auth_context';
import { getSettings } from '@/database/settings';
import { cancelPhaseEnds, schedulePhaseEnds } from '@/services/notificationService';

const FOCUS_SECONDS = 25 * 60;
const INCREMENT_SECONDS = 15 * 60;
const SETUP_STEP_SECONDS = 5 * 60;
const MIN_FOCUS_SECONDS = 5 * 60;

type TimerMode = 'focus' | 'break';
export type Priority = 'Alta' | 'Média' | 'Baixa';
export type TimerTask = {
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

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function secondsUntil(endAt: number, now: number) {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

// Fins de fase daqui em diante (em segundos a partir de agora), até o último foco da sessão, que não tem pausa depois.
export function phaseSchedule(
  mode: TimerMode, remainingSeconds: number, focusLeft: number, focusSeconds: number, breakSeconds: number
) {
  const ends: { phase: TimerMode; seconds: number }[] = [];
  let phase = mode;
  let at = remainingSeconds;
  let left = focusLeft;
  while (left > 0) {
    ends.push({ phase, seconds: at });
    if (phase === 'focus') {
      left -= 1;
      if (left === 0) break;
      phase = 'break';
      at += breakSeconds;
    } else {
      phase = 'focus';
      at += focusSeconds;
    }
  }
  return ends;
}

export function formatSessionDuration(pomodoros: number, focusSeconds = FOCUS_SECONDS) {
  const minutes = Math.round((pomodoros * focusSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}H ${String(remainder).padStart(2, '0')}MIN` : `${minutes} MIN`;
}

export function useTimerViewModel() {
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
  const [breakSeconds, setBreakSeconds] = useState(getSettings().breakMinutes * 60);
  // Fim previsto da fase em andamento: o tempo restante sai dele, então o timer não para em segundo plano
  const endAtRef = useRef<number | null>(null);
  const notificationIdsRef = useRef<string[]>([]);
  const scheduleTokenRef = useRef(0);

  const cancelNotifications = useCallback(() => {
    scheduleTokenRef.current += 1;
    cancelPhaseEnds(notificationIdsRef.current);
    notificationIdsRef.current = [];
  }, []);

  const disarm = useCallback(() => {
    endAtRef.current = null;
    cancelNotifications();
  }, [cancelNotifications]);

  // startAt = fim da fase anterior: ao voltar do segundo plano, as fases que já passaram fecham em sequência
  const arm = useCallback((seconds: number, startAt = Date.now()) => {
    endAtRef.current = startAt + seconds * 1000;
    setRemainingSeconds(secondsUntil(endAtRef.current, Date.now()));
  }, []);

  const scheduleNotifications = (phase: TimerMode, remaining: number, focusLeft: number) => {
    cancelNotifications();
    const token = scheduleTokenRef.current;
    schedulePhaseEnds(phaseSchedule(phase, remaining, focusLeft, setupFocusSeconds, breakSeconds)).then((ids) => {
      // pausou ou mudou enquanto agendava: esses avisos já não valem
      if (scheduleTokenRef.current === token) notificationIdsRef.current = ids;
      else cancelPhaseEnds(ids);
    });
  };

  useEffect(() => disarm, [disarm]);

  useFocusEffect(
    useCallback(() => {
      const tasks = getAllTasks(user?.id ?? '')
        .filter(isTaskForToday)
        .filter((task) => task.status !== 'done')
        .map(toTimerTask);
      setTodayTasks(tasks);
      setSelectedTaskIds((ids) => ids.filter((id) => tasks.some((task) => task.id === id)));
      const settings = getSettings();
      setBreakSeconds(settings.breakMinutes * 60);
      if (!hasStarted) setSetupFocusSeconds(settings.focusMinutes * 60);
    }, [user?.id, hasStarted])
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
  const displayTitle = !hasStarted
    ? 'NOVO POMODORO'
    : isFinished
    ? 'SESSÃO CONCLUÍDA'
    : isBreak
    ? 'INTERVALO'
    : 'POMODORO ATUAL';

  useEffect(() => {
    if (!isRunning || isFinished) return;
    const interval = setInterval(() => {
      if (endAtRef.current !== null) setRemainingSeconds(secondsUntil(endAtRef.current, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished, isRunning]);

  useEffect(() => {
    if (!isRunning || isFinished || remainingSeconds > 0) return;

    const endedAt = endAtRef.current ?? Date.now();
    // vibra só no fim que acabou de acontecer, não nos que já tinham passado com o app fechado
    if (Date.now() - endedAt < 2000 && getSettings().vibration) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    if (mode === 'break') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('focus');
      setCycleTotalSeconds(setupFocusSeconds);
      arm(setupFocusSeconds, endedAt);
      return;
    }

    if (!activeTask) {
      disarm();
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

    setTodayTasks((tasks) =>
      tasks.map((task) => (task.id === activeTask.id ? { ...task, completedPomodoros } : task))
    );

    const nextCompletedCycles = completedCycles + 1;
    setCompletedCycles(nextCompletedCycles);

    if (nextCompletedCycles >= sessionTotalPomodoros) {
      disarm();
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    setMode('break');
    setCycleTotalSeconds(breakSeconds);
    arm(breakSeconds, endedAt);
  }, [
    activeTask,
    arm,
    breakSeconds,
    disarm,
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
    setSelectedTaskIds((ids) =>
      ids.includes(id) ? ids.filter((taskId) => taskId !== id) : [...ids, id]
    );
  };

  const startOrResumeTimer = () => {
    if (pendingSelectedTasks.length === 0) return;
    if (!hasStarted) {
      setSessionTotalPomodoros(availablePomodoros);
      setCompletedCycles(0);
      setCycleTotalSeconds(setupFocusSeconds);
      arm(setupFocusSeconds);
      scheduleNotifications('focus', setupFocusSeconds, availablePomodoros);
    } else {
      arm(remainingSeconds);
      scheduleNotifications(mode, remainingSeconds, sessionTotalPomodoros - completedCycles);
    }
    setHasStarted(true);
    setIsFinished(false);
    setIsRunning(true);
  };

  const pauseTimer = () => {
    disarm();
    setIsRunning(false);
  };

  const incrementCycle = () => {
    if (isBreak || isFinished) return;
    setCycleTotalSeconds((seconds) => seconds + INCREMENT_SECONDS);
    if (isRunning) {
      arm(remainingSeconds + INCREMENT_SECONDS);
      scheduleNotifications(mode, remainingSeconds + INCREMENT_SECONDS, sessionTotalPomodoros - completedCycles);
    } else {
      setRemainingSeconds((seconds) => seconds + INCREMENT_SECONDS);
    }
  };

  const cancelTimer = () => {
    disarm();
    setIsRunning(false);
    setHasStarted(false);
    setIsFinished(false);
    setMode('focus');
    setCompletedCycles(0);
    setSessionTotalPomodoros(0);
    setCycleTotalSeconds(setupFocusSeconds);
    setRemainingSeconds(setupFocusSeconds);
  };

  const decreaseSetupDuration = () =>
    setSetupFocusSeconds((s) => Math.max(MIN_FOCUS_SECONDS, s - SETUP_STEP_SECONDS));
  const increaseSetupDuration = () =>
    setSetupFocusSeconds((s) => s + SETUP_STEP_SECONDS);

  return {
    todayTasks,
    selectedTaskIds,
    isRunning,
    hasStarted,
    isFinished,
    isBreak,
    mode,
    completedCycles,
    totalPomodoros,
    setupFocusSeconds,
    displaySeconds,
    displayProgress,
    displayTitle,
    activeTask,
    pendingSelectedTasks,
    completedSelectedTasks,
    toggleTask,
    startOrResumeTimer,
    incrementCycle,
    cancelTimer,
    pauseTimer,
    breakMinutes: Math.round(breakSeconds / 60),
    decreaseSetupDuration,
    increaseSetupDuration,
    formatTime,
    formatSessionDuration,
  };
}
