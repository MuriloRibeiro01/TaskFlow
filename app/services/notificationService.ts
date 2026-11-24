// Notificações locais do timer: avisam o fim do foco ou da pausa, mesmo com o app em segundo plano.
import * as Notifications from 'expo-notifications';
import { getSettings } from '@/database/settings';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: getSettings().sound,
        shouldSetBadge: false,
    }),
});

let permissionAsked = false;

async function canNotify(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    return (await Notifications.requestPermissionsAsync()).granted;
}

// Agenda de uma vez o aviso de cada fim de fase da sessão (com o app fechado nada mais seria agendado).
// Devolve os ids para cancelar quando o timer pausar, mudar ou acabar.
export async function schedulePhaseEnds(ends: { phase: 'focus' | 'break'; seconds: number }[]): Promise<string[]> {
    try {
        if (ends.length === 0 || !(await canNotify())) return [];
        const sound = getSettings().sound;
        const ids = await Promise.all(ends.filter((e) => e.seconds >= 1).map((e) =>
            Notifications.scheduleNotificationAsync({
                content: e.phase === 'focus'
                    ? { title: 'Pomodoro concluído', body: 'Hora da pausa.', sound }
                    : { title: 'Pausa encerrada', body: 'Hora de voltar ao foco.', sound },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(e.seconds) },
            })
        ));
        return ids;
    } catch {
        return []; // sem notificação o timer continua funcionando
    }
}

export function cancelPhaseEnds(ids: string[]) {
    for (const id of ids) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
