import { useCallback, useState } from 'react';
import { Appearance } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAllTasks } from '@/database/tasks';
import { api } from '@/database/api/client';
import { Task } from '@/types/task.types';
import { useAuth } from '@/database/context/auth_context';
import { useToast } from '@/components/notifications/Toast';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTheme } from '@/hooks/useTheme';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useProfileViewModel() {
  const { colorScheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const netInfo = useNetInfo();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [soundOn, setSoundOn] = useState(true);
  const [vibOn, setVibOn] = useState(true);
  const [routine, setRoutine] = useState('');
  const [savedRoutine, setSavedRoutine] = useState('');

  useFocusEffect(
    useCallback(() => {
      const all = getAllTasks(user?.id ?? '');
      setTasks(all);
      api<{ routineText?: string | null }>('GET', '/users/me')
        .then((me) => {
          setRoutine(me.routineText ?? '');
          setSavedRoutine(me.routineText ?? '');
        })
        .catch(() => {});
    }, [user?.id])
  );

  const saveRoutine = async () => {
    if (routine === savedRoutine) return;
    try {
      await api('PATCH', '/users/me', { routineText: routine });
      setSavedRoutine(routine);
      showToast('Rotina salva', 'success');
    } catch {
      showToast('Não foi possível salvar a rotina. Tente de novo com internet.', 'error');
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const today = new Date().toISOString().substring(0, 10);
  const todayDone = tasks.filter(
    (t) => t.status === 'done' && t.completed_at?.substring(0, 10) === today
  );
  const pomToday = todayDone.reduce((acc, t) => acc + (t.completed_pomodoros ?? 0), 0);
  const doneToday = todayDone.length;
  const isOnline = netInfo.isConnected === true;
  const syncMeta = isOnline ? 'Sincronizado' : 'Sem conexão';

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name ?? 'Usuário';
  const email = user?.email ?? '';
  const provider = String(
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? ''
  ).toUpperCase();
  const initials = getInitials(fullName);

  return {
    colorScheme,
    user,
    routine,
    setRoutine,
    saveRoutine,
    focusDuration,
    setFocusDuration,
    breakDuration,
    setBreakDuration,
    soundOn,
    setSoundOn,
    vibOn,
    setVibOn,
    pomToday,
    doneToday,
    isOnline,
    syncMeta,
    avatarUrl,
    fullName,
    email,
    provider,
    initials,
    handleSignOut,
    setColorScheme: Appearance.setColorScheme,
    navigateToHistorico: () => router.push('/historico'),
    navigateToEstatisticas: () => router.push('/estatisticas'),
    showExportToast: () => showToast('Em breve', 'info'),
  };
}
