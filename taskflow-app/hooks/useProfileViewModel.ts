import { useCallback, useState } from 'react';
import { Appearance } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
    showExportToast: async () => {
      const done = tasks.filter((t) => t.status === 'done');
      const pending = tasks.filter((t) => t.status !== 'done');
      const totalPom = tasks.reduce((s, t) => s + (t.completed_pomodoros ?? 0), 0);
      const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const priorityLabel: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

      const taskRow = (t: (typeof tasks)[0]) => `
        <tr>
          <td>${t.title}</td>
          <td>${priorityLabel[t.priority] ?? t.priority}</td>
          <td style="text-align:center">${t.completed_pomodoros ?? 0}/${t.estimated_pomodoros ?? 0}</td>
          <td>${t.completed_at?.substring(0, 10) ?? t.due_date?.substring(0, 10) ?? '—'}</td>
        </tr>`;

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
        <style>
          body { font-family: 'Courier New', monospace; color: #0E0E0F; padding: 32px; font-size: 12px; }
          h1 { font-size: 20px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px; }
          .meta { color: #666; margin-bottom: 24px; font-size: 11px; }
          .stats { display: flex; gap: 32px; margin-bottom: 32px; }
          .stat { border: 1px solid #0E0E0F; padding: 12px 20px; }
          .stat-n { font-size: 28px; font-weight: 900; }
          .stat-l { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666; }
          h2 { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; border-bottom: 2px solid #0E0E0F; padding-bottom: 4px; margin: 24px 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid #0E0E0F; padding: 6px 8px; }
          td { padding: 6px 8px; border-bottom: 1px solid #E8E8E8; vertical-align: top; }
          .empty { color: #999; font-style: italic; padding: 12px 0; }
        </style></head><body>
        <h1>TaskFlow</h1>
        <p class="meta">Relatório gerado em ${today}</p>
        <div class="stats">
          <div class="stat"><div class="stat-n">${done.length}</div><div class="stat-l">Concluídas</div></div>
          <div class="stat"><div class="stat-n">${pending.length}</div><div class="stat-l">Pendentes</div></div>
          <div class="stat"><div class="stat-n">${totalPom}</div><div class="stat-l">Pomodoros</div></div>
        </div>
        <h2>Tarefas Concluídas</h2>
        ${done.length === 0 ? '<p class="empty">Nenhuma tarefa concluída.</p>' : `
        <table><thead><tr><th>Título</th><th>Prioridade</th><th>Pomodoros</th><th>Concluído em</th></tr></thead>
        <tbody>${done.map(taskRow).join('')}</tbody></table>`}
        <h2>Tarefas Pendentes</h2>
        ${pending.length === 0 ? '<p class="empty">Nenhuma tarefa pendente.</p>' : `
        <table><thead><tr><th>Título</th><th>Prioridade</th><th>Pomodoros</th><th>Prazo</th></tr></thead>
        <tbody>${pending.map(taskRow).join('')}</tbody></table>`}
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar relatório TaskFlow' });
    },
  };
}
