// sync/sync.strategy.ts
import { SyncService } from './sync.service';

export class SyncStrategy {
  private syncService: SyncService;

  constructor() {
    this.syncService = new SyncService();
  }

  // Sincronização completa (pull + push)
  async fullSync() {
    return await this.syncService.syncAll();
  }

  // Sincronização apenas de push (enviar alterações locais)
  async pushSync() {
    const stats = this.syncService.getSyncStats();
    const pendingRecords = stats.pendingTasks + stats.pendingSessions;
    
    if (pendingRecords === 0) {
      return { success: true, message: 'No pending records' };
    }

    return await this.syncService.syncAll();
  }

  // Sincronização apenas de pull (baixar alterações remotas)
  async pullSync() {
    // O SyncService já faz pull durante o syncAll
    // Podemos implementar um método específico se necessário
    return await this.syncService.syncAll();
  }

  // Sincronização em background (silenciosa)
  async backgroundSync() {
    try {
      const result = await this.syncService.syncAll();
      return result;
    } catch (error) {
      console.error('Background sync failed:', error);
      return { success: false, error };
    }
  }
}