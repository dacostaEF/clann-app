import { Platform } from 'react-native';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null;
} else {
  SQLite = require('expo-sqlite');
}

// Chave para localStorage na Web
const WEB_DELIVERY_STATUS_KEY = 'clann_delivery_status';

/**
 * Gerenciador de status de entrega e leitura de mensagens
 * Sprint 6 - ETAPA 4
 * Inspirado no WhatsApp: ✔ enviado, ✔✔ entregue, ✔✔ azul lido
 */
class DeliveryManager {
  constructor() {
    if (Platform.OS !== 'web' && SQLite) {
      this.db = SQLite.openDatabase('clans.db');
    } else {
      this.db = null;
    }
  }

  // ---------------------------------------------------------
  // Helpers para localStorage na Web
  // ---------------------------------------------------------
  _getWebDeliveryStatus() {
    if (Platform.OS !== 'web') return {};
    try {
      const data = localStorage.getItem(WEB_DELIVERY_STATUS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  _saveWebDeliveryStatus(status) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_DELIVERY_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('Erro ao salvar status de entrega no localStorage:', error);
    }
  }

  // ---------------------------------------------------------
  // Inicializar estrutura de status padrão
  // ---------------------------------------------------------
  initializeStatus() {
    return {
      delivered_to: [],
      read_by: []
    };
  }

  // ---------------------------------------------------------
  // Carregar status de uma mensagem
  // ---------------------------------------------------------
  async loadStatus(messageId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const status = this._getWebDeliveryStatus();
      const messageStatus = status[messageId];
      
      if (!messageStatus) {
        return this.initializeStatus();
      }

      try {
        const parsed = typeof messageStatus === 'string' 
          ? JSON.parse(messageStatus) 
          : messageStatus;
        
        // Garantir estrutura correta (pode ser objeto antigo ou array novo)
        if (parsed.delivered_to && parsed.read_by) {
          // Formato antigo (objeto)
          return {
            delivered_to: Array.isArray(parsed.delivered_to) ? parsed.delivered_to : [],
            read_by: Array.isArray(parsed.read_by) ? parsed.read_by : []
          };
        } else if (Array.isArray(parsed)) {
          // Formato novo (array direto) - compatibilidade
          return {
            delivered_to: parsed,
            read_by: []
          };
        }
        
        return this.initializeStatus();
      } catch {
        return this.initializeStatus();
      }
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT delivered_to, read_by FROM clan_messages WHERE id = ? LIMIT 1;`,
          [messageId],
          (_, { rows }) => {
            if (rows.length === 0) {
              resolve(this.initializeStatus());
              return;
            }

            const row = rows.item(0);
            let deliveredTo = [];
            let readBy = [];

            try {
              if (row.delivered_to) {
                const parsed = JSON.parse(row.delivered_to);
                deliveredTo = Array.isArray(parsed) ? parsed : (parsed.delivered_to || []);
              }
              if (row.read_by) {
                const parsed = JSON.parse(row.read_by);
                readBy = Array.isArray(parsed) ? parsed : (parsed.read_by || []);
              }
            } catch (error) {
              console.warn('Erro ao parsear status de entrega:', error);
            }

            resolve({
              delivered_to: Array.isArray(deliveredTo) ? deliveredTo : [],
              read_by: Array.isArray(readBy) ? readBy : []
            });
          },
          (_, error) => {
            console.warn('Erro ao carregar status de entrega:', error);
            resolve(this.initializeStatus());
          }
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Marcar mensagem como entregue
  // ---------------------------------------------------------
  async markDelivered(messageId, totemId) {
    if (!messageId || !totemId) {
      throw new Error('messageId e totemId são obrigatórios');
    }

    const currentStatus = await this.loadStatus(messageId);
    
    // Adiciona totemId se não estiver na lista (sem duplicar)
    if (!currentStatus.delivered_to.includes(totemId)) {
      currentStatus.delivered_to.push(totemId);
    }

    await this.saveStatus(messageId, currentStatus);
    return currentStatus;
  }

  // ---------------------------------------------------------
  // Marcar mensagem como lida
  // ---------------------------------------------------------
  async markRead(messageId, totemId) {
    if (!messageId || !totemId) {
      throw new Error('messageId e totemId são obrigatórios');
    }

    const currentStatus = await this.loadStatus(messageId);
    
    // Adiciona totemId se não estiver na lista (sem duplicar)
    if (!currentStatus.read_by.includes(totemId)) {
      currentStatus.read_by.push(totemId);
    }

    // Se leu, também foi entregue
    if (!currentStatus.delivered_to.includes(totemId)) {
      currentStatus.delivered_to.push(totemId);
    }

    await this.saveStatus(messageId, currentStatus);
    return currentStatus;
  }

  // ---------------------------------------------------------
  // Salvar status de uma mensagem
  // ---------------------------------------------------------
  async saveStatus(messageId, status) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const allStatus = this._getWebDeliveryStatus();
      // Salvar como objeto completo para facilitar acesso
      allStatus[messageId] = JSON.stringify(status);
      this._saveWebDeliveryStatus(allStatus);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Salvar delivered_to e read_by separadamente
        const deliveredToJson = JSON.stringify(status.delivered_to || []);
        const readByJson = JSON.stringify(status.read_by || []);
        
        tx.executeSql(
          `UPDATE clan_messages SET delivered_to = ?, read_by = ? WHERE id = ?;`,
          [deliveredToJson, readByJson, messageId],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Sincronizar status de entrega de um CLANN
  // ---------------------------------------------------------
  async syncDeliveryStatus(clanId) {
    // Esta função pode ser expandida no futuro para sincronização entre dispositivos
    // Por enquanto, apenas retorna sucesso
    return Promise.resolve(true);
  }

  // ---------------------------------------------------------
  // Remover totemId de todas as mensagens (quando mensagem é deletada)
  // ---------------------------------------------------------
  async removeTotemFromStatus(messageId, totemId) {
    const currentStatus = await this.loadStatus(messageId);
    
    currentStatus.delivered_to = currentStatus.delivered_to.filter(id => id !== totemId);
    currentStatus.read_by = currentStatus.read_by.filter(id => id !== totemId);

    await this.saveStatus(messageId, currentStatus);
    return currentStatus;
  }
}

export default new DeliveryManager();

