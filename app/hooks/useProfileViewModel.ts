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
import { getSettings, saveSettings, Settings } from '@/database/settings';
import { exportReport } from '@/services/reportService';
import { dayKey, localDay } from '@/utils/date';

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
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [isExporting, setIsExporting] = useState(false);
  const updateSettings = (patch: Partial<Settings>) => setSettings(saveSettings(patch));
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

  const today = dayKey(new Date());
  const todayDone = tasks.filter(
    (t) => t.status === 'done' && localDay(t.completed_at) === today
  );
  const pomToday = todayDone.reduce((acc, t) => acc + (t.completed_pomodoros ?? 0), 0);
  const doneToday = todayDone.length;
  const isOnline = netInfo.isConnected === true;
  const syncMeta = isOnline ? 'Sincronizado' : 'Sem conexão';

  const avatarUrl = user?.avatarUrl ?? undefined;
  const email = user?.email ?? '';
  // Contas criadas por e-mail não têm nome: usa a parte antes do @
  const fullName = user?.displayName?.trim() || email.split('@')[0] || 'Usuário';
  const initials = getInitials(fullName);

  const exportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportReport(tasks, fullName);
    } catch {
      showToast('Não foi possível gerar o PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    colorScheme,
    user,
    routine,
    setRoutine,
    saveRoutine,
    focusDuration: settings.focusMinutes,
    setFocusDuration: (next: (prev: number) => number) => updateSettings({ focusMinutes: next(settings.focusMinutes) }),
    breakDuration: settings.breakMinutes,
    setBreakDuration: (next: (prev: number) => number) => updateSettings({ breakMinutes: next(settings.breakMinutes) }),
    soundOn: settings.sound,
    setSoundOn: (next: (prev: boolean) => boolean) => updateSettings({ sound: next(settings.sound) }),
    vibOn: settings.vibration,
    setVibOn: (next: (prev: boolean) => boolean) => updateSettings({ vibration: next(settings.vibration) }),
    pomToday,
    doneToday,
    isOnline,
    syncMeta,
    avatarUrl,
    fullName,
    email,
    initials,
    handleSignOut,
    setColorScheme: Appearance.setColorScheme,
    navigateToHistorico: () => router.push('/historico'),
    navigateToEstatisticas: () => router.push('/estatisticas'),
    exportPdf,
    isExporting,
  };
}
