import { Platform } from 'react-native';
import MessagesStorage from '../messages/MessagesStorage';

/**
 * Gerenciador de sincronização em tempo real
 * Sprint 6 - ETAPA 6
 * Polling inteligente com delta updates (offline-first)
 */
class SyncManager {
  constructor() {
    this.syncIntervals = new Map(); // Map<clanId, intervalId>
    this.isActive = false;
    this.lastTimestamps = new Map(); // Map<clanId, lastTimestamp>
    this.debounceTimers = new Map(); // Map<clanId, timerId> - Sprint 7 - ETAPA 6
    this.pendingSyncs = new Map(); // Map<clanId, callback> - Sprint 7 - ETAPA 6
    this.DEBOUNCE_DELAY = 500; // 500ms de debounce
  }

  // ---------------------------------------------------------
  // Iniciar sincronização para um CLANN
  // ---------------------------------------------------------
  startSync(clanId, callback) {
    if (!clanId || !callback) {
      console.warn('SyncManager: clanId e callback são obrigatórios');
      return;
    }

    // Parar sync anterior se existir
    this.stopSync(clanId);

    // Obter último timestamp das mensagens do CLANN
    this._initializeLastTimestamp(clanId).then(() => {
      // Iniciar polling com debounce (Sprint 7 - ETAPA 6)
      const intervalId = setInterval(() => {
        if (!this.isActive) return;
        
        // Usa debounce para evitar múltiplas chamadas simultâneas
        this._debouncedSync(clanId, callback);
      }, 3000); // 3 segundos

      this.syncIntervals.set(clanId, intervalId);
      this.isActive = true;
    });
  }

  // ---------------------------------------------------------
  // Parar sincronização
  // ---------------------------------------------------------
  stopSync(clanId = null) {
    if (clanId) {
      // Parar sync de um CLANN específico
      const intervalId = this.syncIntervals.get(clanId);
      if (intervalId) {
        clearInterval(intervalId);
        this.syncIntervals.delete(clanId);
        this.lastTimestamps.delete(clanId);
      }
      
      // Limpar debounce timer (Sprint 7 - ETAPA 6)
      const debounceTimer = this.debounceTimers.get(clanId);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        this.debounceTimers.delete(clanId);
      }
      this.pendingSyncs.delete(clanId);
    } else {
      // Parar todos os syncs
      this.syncIntervals.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      this.syncIntervals.clear();
      this.lastTimestamps.clear();
      
      // Limpar todos os debounce timers (Sprint 7 - ETAPA 6)
      this.debounceTimers.forEach((timerId) => {
        clearTimeout(timerId);
      });
      this.debounceTimers.clear();
      this.pendingSyncs.clear();
      
      this.isActive = false;
    }
  }

  // ---------------------------------------------------------
  // Buscar atualizações (delta updates)
  // ---------------------------------------------------------
  async fetchUpdates(clanId, lastTimestamp) {
    try {
      const updates = await MessagesStorage.getMessagesSince(clanId, lastTimestamp);
      return updates || [];
    } catch (error) {
      console.error('Erro ao buscar atualizações:', error);
      return [];
    }
  }

  // ---------------------------------------------------------
  // Inicializar último timestamp
  // ---------------------------------------------------------
  async _initializeLastTimestamp(clanId) {
    try {
      const allMessages = await MessagesStorage.getMessages(clanId);
      if (allMessages.length > 0) {
        const maxTimestamp = Math.max(...allMessages.map(m => m.timestamp || 0));
        this.lastTimestamps.set(clanId, maxTimestamp);
      } else {
        this.lastTimestamps.set(clanId, 0);
      }
    } catch (error) {
      console.warn('Erro ao inicializar timestamp:', error);
      this.lastTimestamps.set(clanId, 0);
    }
  }

  // ---------------------------------------------------------
  // Atualizar último timestamp manualmente
  // ---------------------------------------------------------
  updateLastTimestamp(clanId, timestamp) {
    const current = this.lastTimestamps.get(clanId) || 0;
    if (timestamp > current) {
      this.lastTimestamps.set(clanId, timestamp);
    }
  }

  // ---------------------------------------------------------
  // Debounced Sync (Sprint 7 - ETAPA 6)
  // ---------------------------------------------------------
  _debouncedSync(clanId, callback) {
    // Cancela timer anterior se existir
    const existingTimer = this.debounceTimers.get(clanId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Armazena callback pendente
    this.pendingSyncs.set(clanId, callback);

    // Cria novo timer
    const timerId = setTimeout(async () => {
      try {
        const lastTimestamp = this.lastTimestamps.get(clanId) || 0;
        const updates = await this.fetchUpdates(clanId, lastTimestamp);

        if (updates && updates.length > 0) {
          // Atualizar último timestamp
          const maxTimestamp = Math.max(
            ...updates.map(m => m.timestamp || 0),
            lastTimestamp
          );
          this.lastTimestamps.set(clanId, maxTimestamp);

          // Chamar callback com deltas
          const pendingCallback = this.pendingSyncs.get(clanId);
          if (pendingCallback) {
            pendingCallback(updates);
            this.pendingSyncs.delete(clanId);
          }
        }
      } catch (error) {
        console.warn('Erro na sincronização:', error);
      } finally {
        this.debounceTimers.delete(clanId);
      }
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(clanId, timerId);
  }

  // ---------------------------------------------------------
  // Verificar se está sincronizando
  // ---------------------------------------------------------
  isSyncing(clanId = null) {
    if (clanId) {
      return this.syncIntervals.has(clanId);
    }
    return this.syncIntervals.size > 0;
  }
}

export default new SyncManager();

