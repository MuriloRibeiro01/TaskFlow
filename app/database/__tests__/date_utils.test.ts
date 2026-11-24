import { dayKey, localDay, localTime } from '@/utils/date';

describe('utils/date', () => {
    // SQLite grava em UTC sem fuso: tem de virar o mesmo instante que o ISO com Z
    it('lê datetime do SQLite como UTC', () => {
        const instant = new Date(Date.UTC(2026, 10, 24, 1, 30));
        expect(localDay('2026-11-24 01:30:00')).toBe(dayKey(instant));
        expect(localDay('2026-11-24T01:30:00.000Z')).toBe(dayKey(instant));
        expect(localTime('2026-11-24 01:30:00')).toBe(
            `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`
        );
    });

    it('vazio ou inválido vira string vazia', () => {
        expect(localDay(null)).toBe('');
        expect(localDay('lixo')).toBe('');
        expect(localTime(undefined)).toBe('');
    });

    it('dayKey usa a data local', () => {
        expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
});
