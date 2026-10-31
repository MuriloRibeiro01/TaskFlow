// TDD do gatilho de sync: gravação local avisa quem escuta, e gravações seguidas viram um sync só

import { notifyLocalChange, onLocalChange } from '../sync/sync_trigger';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('onLocalChange', () => {
    it('Chama quem escuta depois do atraso, não na hora', () => {
        const listener = jest.fn();
        const off = onLocalChange(listener, 1000);

        notifyLocalChange();
        expect(listener).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        expect(listener).toHaveBeenCalledTimes(1);
        off();
    });

    it('Junta gravações seguidas em uma chamada só', () => {
        const listener = jest.fn();
        const off = onLocalChange(listener, 1000);

        notifyLocalChange();
        jest.advanceTimersByTime(500);
        notifyLocalChange();
        jest.advanceTimersByTime(500);
        notifyLocalChange();
        jest.advanceTimersByTime(1000);

        expect(listener).toHaveBeenCalledTimes(1);
        off();
    });

    it('Depois de cancelar não chama mais, nem o que já estava agendado', () => {
        const listener = jest.fn();
        const off = onLocalChange(listener, 1000);

        notifyLocalChange();
        off();
        notifyLocalChange();
        jest.advanceTimersByTime(5000);

        expect(listener).not.toHaveBeenCalled();
    });

    it('Sem ninguém escutando não faz nada (app sem login)', () => {
        expect(() => notifyLocalChange()).not.toThrow();
    });
});
