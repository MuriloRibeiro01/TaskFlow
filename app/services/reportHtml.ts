// HTML do relatório exportado em PDF pelo Perfil (últimos 7 dias, a partir das tarefas locais).
import { Task } from '@/types/task.types';
import { dayKey, localDay } from '@/utils/date';

function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function buildReportHtml(tasks: Task[], userName: string, now = new Date()): string {
    const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - (6 - i) * 86_400_000)));
    const done = tasks.filter((t) => t.status === 'done' && t.completed_at && days.includes(localDay(t.completed_at)));
    const pomodoros = done.reduce((acc, t) => acc + (t.completed_pomodoros ?? 0), 0);
    const open = tasks.filter((t) => t.status !== 'done').length;

    const perDay = days
        .map((d) => `<tr><td>${d.split('-').reverse().join('/')}</td><td>${done.filter((t) => localDay(t.completed_at) === d).length}</td></tr>`)
        .join('');
    const rows = done
        .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
        .map((t) => `<tr><td>${escapeHtml(t.title)}</td><td>${localDay(t.completed_at).split('-').reverse().join('/')}</td><td>${t.completed_pomodoros ?? 0}</td></tr>`)
        .join('');

    return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0E0E0F;padding:24px}
h1{font-size:28px;margin:0}h1 span{color:#D63B2F}h2{font-size:16px;margin-top:28px}
.meta{color:#5A5850;font-size:12px;margin:4px 0 20px}
.cards{display:flex;gap:12px}.card{flex:1;border:1px solid #D6D3CB;padding:12px}
.card b{display:block;font-size:24px}.card small{color:#5A5850;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:12px}td,th{border-bottom:1px solid #D6D3CB;padding:6px;text-align:left}
</style></head><body>
<h1>TASK<span>FLOW</span></h1>
<p class="meta">Relatório de produtividade · ${escapeHtml(userName)} · ${days[0].split('-').reverse().join('/')} a ${days[6].split('-').reverse().join('/')}</p>
<div class="cards">
<div class="card"><b>${done.length}</b><small>TAREFAS CONCLUÍDAS</small></div>
<div class="card"><b>${pomodoros}</b><small>POMODOROS</small></div>
<div class="card"><b>${open}</b><small>TAREFAS EM ABERTO</small></div>
</div>
<h2>Concluídas por dia</h2><table><tr><th>Dia</th><th>Tarefas</th></tr>${perDay}</table>
<h2>Tarefas concluídas</h2>
${rows ? `<table><tr><th>Tarefa</th><th>Concluída em</th><th>Pomodoros</th></tr>${rows}</table>` : '<p class="meta">Nenhuma tarefa concluída no período.</p>'}
</body></html>`;
}
