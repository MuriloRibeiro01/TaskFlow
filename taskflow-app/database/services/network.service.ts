// services/network.service.ts
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export class NetworkService {
  public isConnected = false;
  private listeners: (() => void)[] = [];

  constructor() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected || false;
      
      // Notificar listeners quando conectar
      if (!wasConnected && this.isConnected) {
        this.listeners.forEach(listener => listener());
      }
    });
  }

  onConnect(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async waitForConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        resolve(true);
      } else {
        const unsubscribe = this.onConnect(() => {
          unsubscribe();
          resolve(true);
        });
      }
    });
  }
}