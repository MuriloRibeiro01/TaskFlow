// sync/conflict.resolver.ts
export class ConflictResolver {
  resolveTaskConflict(localTask: any, remoteTask: any): any {
    const localDate = new Date(localTask.updated_at || localTask.created_at);
    const remoteDate = new Date(remoteTask.updated_at || remoteTask.created_at);
    
    if (localDate > remoteDate) {
      return localTask;
    }
    return remoteTask;
  }

  resolveSessionConflict(localSession: any, remoteSession: any): any {
    const localDate = new Date(localSession.ended_at || localSession.started_at);
    const remoteDate = new Date(remoteSession.ended_at || remoteSession.started_at);
    
    if (localDate > remoteDate) {
      return localSession;
    }
    return remoteSession;
  }
}