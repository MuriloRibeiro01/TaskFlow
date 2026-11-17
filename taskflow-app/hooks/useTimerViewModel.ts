import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { getAllTasks } from '@/database/tasks';
import { recordCompletedPomodoro } from '@/database/pomodoro';
import { Task as DBTask } from '@/types/task.types';
import { useAuth } from '@/database/context/auth_context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
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

export function formatSessionDuration(pomodoros: number, focusSeconds = FOCUS_SECONDS) {
  const minutes = Math.round((pomodoros * focusSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}H ${String(remainder).padStart(2, '0')}MIN` : `${minutes} MIN`;
}

export function useTimerViewModel() {
  const { user } = useAuth();

  const notifIdRef = useRef<string | null>(null);

  const cancelNotif = useCallback(() => {
    if (!notifIdRef.current) return;
    Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
    notifIdRef.current = null;
  }, []);

  const scheduleNotif = useCallback((seconds: number, isBreakMode: boolean) => {
    if (notifIdRef.current) {
      Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      notifIdRef.current = null;
    }
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted'
        || (await Notifications.requestPermissionsAsync()).status === 'granted';
      if (!granted) return;
      notifIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: isBreakMode ? 'Intervalo concluído!' : 'Pomodoro concluído!',
          body: isBreakMode ? 'Hora de voltar ao foco.' : 'Hora do intervalo.',
        },
        trigger: {
          seconds,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });
    })().catch(() => {});
  }, []);

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
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished, isRunning]);

  useEffect(() => {
    if (!isRunning || isFinished || remainingSeconds > 0) return;

    if (mode === 'break') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('focus');
      setCycleTotalSeconds(setupFocusSeconds);
      setRemainingSeconds(setupFocusSeconds);
      scheduleNotif(setupFocusSeconds, false);
      return;
    }

    if (!activeTask) {
      cancelNotif();
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
      cancelNotif();
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    setMode('break');
    setCycleTotalSeconds(BREAK_SECONDS);
    setRemainingSeconds(BREAK_SECONDS);
    scheduleNotif(BREAK_SECONDS, true);
  }, [
    activeTask,
    cancelNotif,
    completedCycles,
    cycleTotalSeconds,
    isFinished,
    isRunning,
    mode,
    remainingSeconds,
    scheduleNotif,
    sessionTotalPomodoros,
    setupFocusSeconds,
    user?.id,
  ]);

  useEffect(() => {
    if (!isRunning && hasStarted && !isFinished) cancelNotif();
  }, [isRunning, hasStarted, isFinished, cancelNotif]);

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
      setRemainingSeconds(setupFocusSeconds);
      scheduleNotif(setupFocusSeconds, false);
    } else {
      scheduleNotif(remainingSeconds, isBreak);
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
    cancelNotif();
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
    setIsRunning,
    decreaseSetupDuration,
    increaseSetupDuration,
    formatTime,
    formatSessionDuration,
  };
}
