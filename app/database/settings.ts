// Preferências do Perfil (duração do foco/pausa, sons, vibração), guardadas no aparelho.
import Storage from 'expo-sqlite/kv-store';

export type Settings = {
    focusMinutes: number;
    breakMinutes: number;
    sound: boolean;
    vibration: boolean;
};

const KEY = 'taskflow.settings';
export const DEFAULT_SETTINGS: Settings = { focusMinutes: 25, breakMinutes: 5, sound: true, vibration: true };

export function getSettings(): Settings {
    try {
        const raw = Storage.getItemSync(KEY);
        return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(patch: Partial<Settings>): Settings {
    const next = { ...getSettings(), ...patch };
    try {
        Storage.setItemSync(KEY, JSON.stringify(next));
    } catch {
        // Sem armazenamento a preferência vale só até fechar o app
    }
    return next;
}
