// Datas gravadas pelo app (SQLite em UTC ou ISO) convertidas para o dia/hora local do aparelho.
import { toIso } from '@/database/api/mappers';

// 'AAAA-MM-DD' no fuso local (toISOString daria o dia em UTC)
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDay(value?: string | null): string {
  const iso = toIso(value);
  return iso ? dayKey(new Date(iso)) : '';
}

export function localTime(value?: string | null): string {
  const iso = toIso(value);
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
