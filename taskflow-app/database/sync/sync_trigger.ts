// Gatilho de sync: cada gravação local avisa, e quem escuta (o contexto de auth, só com usuário logado)
// recebe uma chamada só depois de um tempo sem gravações, para criar + editar seguidos virarem um sync.

type Listener = { callback: () => void; delayMs: number; timer?: ReturnType<typeof setTimeout> };

const listeners = new Set<Listener>();

export function notifyLocalChange() {
    for (const listener of listeners) {
        clearTimeout(listener.timer);
        listener.timer = setTimeout(listener.callback, listener.delayMs);
    }
}

export function onLocalChange(callback: () => void, delayMs = 1500) {
    const listener: Listener = { callback, delayMs };
    listeners.add(listener);
    return () => {
        clearTimeout(listener.timer);
        listeners.delete(listener);
    };
}
