import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

// Chave para localStorage na Web
const WEB_REACTIONS_KEY = 'clann_message_reactions';

let database = null;

export const getDatabase = async () => {
  if (!database) {
    database = await SQLite.openDatabaseAsync('clans.db');
  }
  return database;
};

// Emojis disponíveis para reações
export const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮'];

/**
 * Gerenciador de reações em mensagens
 * Sprint 6 - ETAPA 3
 */
class ReactionsManager {
  constructor() {
    if (Platform.OS !== 'web' && SQLite) {
      this.db = null; // Será inicializado via getDatabase()
    } else {
      this.db = null;
    }
  }

  // ---------------------------------------------------------
  // Helpers para localStorage na Web
  // ---------------------------------------------------------
  _getWebReactions() {
    if (Platform.OS !== 'web') return {};
    try {
      const data = localStorage.getItem(WEB_REACTIONS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  _saveWebReactions(reactions) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_REACTIONS_KEY, JSON.stringify(reactions));
    } catch (error) {
      console.error('Erro ao salvar reações no localStorage:', error);
    }
  }

  // ---------------------------------------------------------
  // Inicializar estrutura de reações padrão
  // ---------------------------------------------------------
  initializeReactions() {
    const reactions = {};
    AVAILABLE_REACTIONS.forEach(emoji => {
      reactions[emoji] = [];
    });
    return reactions;
  }

  // ---------------------------------------------------------
  // Carregar reações de uma mensagem
  // ---------------------------------------------------------
  async loadReactions(messageId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const reactions = this._getWebReactions();
      const messageReactions = reactions[messageId];
      
      if (!messageReactions) {
        return this.initializeReactions();
      }

      try {
        return typeof messageReactions === 'string' 
          ? JSON.parse(messageReactions) 
          : messageReactions;
      } catch {
        return this.initializeReactions();
      }
    }

    const db = await getDatabase();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (!db || typeof db.execAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação ReactionsManager.getReactions');
      return Promise.resolve({});
    }
    
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT reactions FROM clan_messages WHERE id = ? LIMIT 1;`,
          [messageId],
          (_, { rows }) => {
            if (rows.length === 0) {
              resolve(this.initializeReactions());
              return;
            }

            const reactionsJson = rows.item(0).reactions;
            
            if (!reactionsJson) {
              resolve(this.initializeReactions());
              return;
            }

            try {
              const reactions = JSON.parse(reactionsJson);
              // Garantir que todas as reações disponíveis existam
              const initialized = this.initializeReactions();
              Object.keys(initialized).forEach(emoji => {
                if (!reactions[emoji]) {
                  reactions[emoji] = [];
                }
              });
              resolve(reactions);
            } catch (error) {
              console.warn('Erro ao parsear reações:', error);
              resolve(this.initializeReactions());
            }
          },
          (_, error) => {
            console.warn('Erro ao carregar reações:', error);
            resolve(this.initializeReactions());
          }
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Alternar reação (adicionar ou remover)
  // ---------------------------------------------------------
  async toggleReaction(messageId, emoji, totemId) {
    if (!AVAILABLE_REACTIONS.includes(emoji)) {
      throw new Error('Emoji de reação inválido');
    }

    const currentReactions = await this.loadReactions(messageId);
    
    // Verifica se o totem já reagiu com este emoji
    const emojiReactions = currentReactions[emoji] || [];
    const hasReacted = emojiReactions.includes(totemId);

    if (hasReacted) {
      // Remove reação
      currentReactions[emoji] = emojiReactions.filter(id => id !== totemId);
    } else {
      // Adiciona reação (remove de outros emojis primeiro)
      AVAILABLE_REACTIONS.forEach(e => {
        if (e !== emoji && currentReactions[e]) {
          currentReactions[e] = currentReactions[e].filter(id => id !== totemId);
        }
      });
      currentReactions[emoji] = [...emojiReactions, totemId];
    }

    // Salva reações atualizadas
    await this.saveReactions(messageId, currentReactions);
    
    return currentReactions;
  }

  // ---------------------------------------------------------
  // Salvar reações de uma mensagem
  // ---------------------------------------------------------
  async saveReactions(messageId, reactions) {
    const reactionsJson = JSON.stringify(reactions);

    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const allReactions = this._getWebReactions();
      allReactions[messageId] = reactionsJson;
      this._saveWebReactions(allReactions);
      return Promise.resolve(true);
    }

    const db = await getDatabase();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (!db || typeof db.execAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação ReactionsManager.updateReactions');
      return Promise.resolve(true);
    }
    
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `UPDATE clan_messages SET reactions = ? WHERE id = ?;`,
          [reactionsJson, messageId],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Mesclar reações (para sincronização futura)
  // ---------------------------------------------------------
  mergeReactions(currentReactions, newReactions) {
    const merged = this.initializeReactions();
    
    AVAILABLE_REACTIONS.forEach(emoji => {
      const current = currentReactions[emoji] || [];
      const incoming = newReactions[emoji] || [];
      // Remove duplicados e mescla
      merged[emoji] = [...new Set([...current, ...incoming])];
    });

    return merged;
  }

  // ---------------------------------------------------------
  // Obter contagem de reações
  // ---------------------------------------------------------
  getReactionCounts(reactions) {
    const counts = {};
    AVAILABLE_REACTIONS.forEach(emoji => {
      counts[emoji] = (reactions[emoji] || []).length;
    });
    return counts;
  }

  // ---------------------------------------------------------
  // Verificar se totem reagiu com emoji específico
  // ---------------------------------------------------------
  hasReacted(reactions, emoji, totemId) {
    const emojiReactions = reactions[emoji] || [];
    return emojiReactions.includes(totemId);
  }
}

export default new ReactionsManager();

