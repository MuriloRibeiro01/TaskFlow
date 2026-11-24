// Gera o PDF do relatório e abre a folha de compartilhar (salvar em Arquivos, enviar etc.).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Task } from '@/types/task.types';
import { buildReportHtml } from './reportHtml';

export async function exportReport(tasks: Task[], userName: string) {
    const { uri } = await Print.printToFileAsync({ html: buildReportHtml(tasks, userName) });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste aparelho');
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Relatório TaskFlow' });
}
