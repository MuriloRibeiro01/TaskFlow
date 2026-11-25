import { useCallback, useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { completeTask, deleteTask, getAllTasks, reopenTask } from '@/database/tasks';
import { Task as DBTask } from '@/types/task.types';
import { Quadrant } from '@/types/prioritization.types';
import { useAuth } from '@/database/context/auth_context';
import { useToast } from '@/components/notifications/Toast';

export type Priority = 'Alta' | 'Média' | 'Baixa';
export type Status = 'in_progress' | 'pending' | 'done';
export type StatusFilter = 'all' | 'open';
export type PriorityFilter = 'all' | 'low' | 'medium' | 'high';
export type FilterMenu = 'status' | 'priority' | null;

export interface Task {
  id: number;
  displayId: string;
  title: string;
  priority: Priority;
  status: Status;
  minutes: number;
  totalPips: number;
  donePips: number;
  quadrant?: Quadrant | null;
}

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
    quadrant: (t.quadrant as Quadrant) ?? null,
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
      const dueDay = t.due_date.substring(0, 10);
      if (dueDay === tomorrowStr) {
        tomorrow.push(dbTaskToView(t));
      } else {
        today.push(dbTaskToView(t));
      }
    } else {
      const createdDay = t.created_at ? t.created_at.substring(0, 10) : '';
      if (createdDay === todayStr) {
        today.push(dbTaskToView(t));
      }
    }
  }
  return { today, tomorrow };
}

export function filterTasks(tasks: Task[], statusFilter: StatusFilter, priorityFilter: PriorityFilter) {
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

export function useTaskList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.id ?? '';

  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [openFilter, setOpenFilter] = useState<FilterMenu>(null);
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<Task | null>(null);
  const [deleteConfirmationOpacity] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(userId);
      const { today, tomorrow } = splitByDate(all);
      setTodayTasks(today);
      setTomorrowTasks(tomorrow);
    }, [userId])
  );

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

  const refresh = () => {
    const all = getAllTasks(userId);
    const { today, tomorrow } = splitByDate(all);
    setTodayTasks(today);
    setTomorrowTasks(tomorrow);
  };

  const deleteTaskNow = (task: Task) => {
    deleteTask(task.id);
    refresh();
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
    const updateTask = (tasks: Task[]) =>
      tasks.map((item) =>
        item.id === task.id
          ? { ...item, status: nextStatus, donePips: nextStatus === 'done' ? item.totalPips : 0 }
          : item
      );
    setTodayTasks(updateTask);
    setTomorrowTasks(updateTask);
    if (nextStatus === 'done') {
      showToast(`✓ ${task.displayId} · ${task.title}`, 'success');
    }
  };

  const completed = todayTasks.filter((t) => t.status === 'done').length;
  const totalMins = todayTasks.reduce((acc, t) => acc + t.minutes, 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const focusLabel = h > 0 ? `${h}h ${m}min de foco` : `${m}min de foco`;
  const progress = todayTasks.length > 0 ? (completed / todayTasks.length) * 100 : 0;
  const filteredTodayTasks = filterTasks(todayTasks, statusFilter, priorityFilter);
  const filteredTomorrowTasks = filterTasks(tomorrowTasks, statusFilter, priorityFilter);
  const todayLabel = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();

  return {
    todayTasks,
    tomorrowTasks,
    filteredTodayTasks,
    filteredTomorrowTasks,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    openFilter,
    setOpenFilter,
    taskPendingDeletion,
    setTaskPendingDeletion,
    deleteConfirmationOpacity,
    dismissDeletion,
    handleCheck,
    completed,
    focusLabel,
    progress,
    todayLabel,
    refresh,
  };
}
