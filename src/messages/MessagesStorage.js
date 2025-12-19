import { Platform } from 'react-native';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null; // Não será usado no web
} else {
  SQLite = require('expo-sqlite');
}

// Chave para localStorage na Web
const WEB_MESSAGES_KEY = 'clann_messages';

/**
 * Camada de acesso ao SQLite para mensagens dos CLANNs
 * Gerencia persistência de mensagens localmente
 * 
 * Sprint 4: Chat básico funcional
 */
class MessagesStorage {
  constructor() {
    if (Platform.OS !== 'web' && SQLite) {
      // Usa o mesmo banco de dados dos CLANNs
      this.db = SQLite.openDatabase('clans.db');
    } else {
      this.db = null; // No web, não há banco
    }
  }

  // ---------------------------------------------------------
  // Helpers para localStorage na Web
  // ---------------------------------------------------------
  _getWebMessages() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_MESSAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebMessages(messages) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Erro ao salvar mensagens no localStorage:', error);
    }
  }

  // ---------------------------------------------------------
  // Inicialização (tabela já criada em ClanStorage.init())
  // ---------------------------------------------------------
  async init() {
    if (Platform.OS === 'web' || !this.db) {
      // No web, não há banco de dados (usa localStorage)
      return Promise.resolve(true);
    }
    // Tabela já foi criada em ClanStorage.init()
    return Promise.resolve(true);
  }

  // ---------------------------------------------------------
  // Adicionar mensagem
  // ---------------------------------------------------------
  async addMessage(clanId, authorTotem, text, options = {}) {
    const { selfDestructAt = null, burnAfterRead = false } = options;
    
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const messages = this._getWebMessages();
      const newMessage = {
        id: Date.now(),
        clan_id: parseInt(clanId),
        author_totem: authorTotem,
        message: text,
        timestamp: Date.now(),
        self_destruct_at: selfDestructAt,
        burn_after_read: burnAfterRead ? 1 : 0,
        reactions: null, // Reações serão inicializadas quando necessário
        delivered_to: JSON.stringify([]), // Sprint 6 - ETAPA 4
        read_by: JSON.stringify([]), // Sprint 6 - ETAPA 4
        edited: 0, // Sprint 6 - ETAPA 5
        deleted: 0, // Sprint 6 - ETAPA 5
        original_content: null, // Sprint 6 - ETAPA 5
        edited_at: null // Sprint 6 - ETAPA 5
      };
      messages.push(newMessage);
      this._saveWebMessages(messages);
      return Promise.resolve(newMessage);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO clan_messages (clan_id, author_totem, message, timestamp, self_destruct_at, burn_after_read, reactions, delivered_to, read_by, edited, deleted, original_content, edited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            clanId, 
            authorTotem, 
            text, 
            Date.now(), 
            selfDestructAt, 
            burnAfterRead ? 1 : 0, 
            null,
            JSON.stringify([]), // Sprint 6 - ETAPA 4: delivered_to
            JSON.stringify([]), // Sprint 6 - ETAPA 4: read_by
            0, // Sprint 6 - ETAPA 5: edited
            0, // Sprint 6 - ETAPA 5: deleted
            null, // Sprint 6 - ETAPA 5: original_content
            null // Sprint 6 - ETAPA 5: edited_at
          ],
          (_, result) => {
            resolve({
              id: result.insertId,
              clan_id: clanId,
              author_totem: authorTotem,
              message: text,
              timestamp: Date.now(),
              self_destruct_at: selfDestructAt,
              burn_after_read: burnAfterRead ? 1 : 0,
              reactions: null,
              delivered_to: JSON.stringify([]),
              read_by: JSON.stringify([]),
              edited: 0,
              deleted: 0,
              original_content: null,
              edited_at: null
            });
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Buscar mensagens desde um timestamp (Sprint 6 - ETAPA 6)
  // ---------------------------------------------------------
  async getMessagesSince(clanId, lastTimestamp) {
    const now = Date.now();
    
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const messages = this._getWebMessages();
      const clanMessages = messages
        .filter(m => {
          // Filtra por CLANN
          if (m.clan_id !== parseInt(clanId)) return false;
          
          // Filtra por timestamp (apenas mensagens mais recentes)
          if (m.timestamp <= lastTimestamp) return false;
          
          // Remove mensagens expiradas (self-destruct)
          if (m.self_destruct_at && m.self_destruct_at <= now) return false;
          
          return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp); // Ordena ASC
      
      return Promise.resolve(clanMessages);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Busca mensagens mais recentes que lastTimestamp
        tx.executeSql(
          `SELECT * FROM clan_messages 
           WHERE clan_id = ? 
           AND timestamp > ?
           AND (self_destruct_at IS NULL OR self_destruct_at > ?)
           ORDER BY timestamp ASC;`,
          [clanId, lastTimestamp, now],
          (_, { rows }) => {
            const messages = [];
            for (let i = 0; i < rows.length; i++) {
              messages.push(rows.item(i));
            }
            resolve(messages);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Buscar mensagens de um CLANN (filtra expiradas)
  // ---------------------------------------------------------
  async getMessages(clanId) {
    const now = Date.now();
    
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const messages = this._getWebMessages();
      const clanMessages = messages
        .filter(m => {
          // Filtra por CLANN
          if (m.clan_id !== parseInt(clanId)) return false;
          
          // Remove mensagens expiradas (self-destruct)
          if (m.self_destruct_at && m.self_destruct_at <= now) return false;
          
          return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp); // Ordena ASC (mais antigo primeiro)
      
      return Promise.resolve(clanMessages);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Remove mensagens expiradas primeiro
        tx.executeSql(
          `DELETE FROM clan_messages 
           WHERE clan_id = ? 
           AND self_destruct_at IS NOT NULL 
           AND self_destruct_at <= ?;`,
          [clanId, now],
          () => {},
          (_, error) => console.warn('Erro ao limpar mensagens expiradas:', error)
        );

        // Busca mensagens não expiradas
        tx.executeSql(
          `SELECT * FROM clan_messages 
           WHERE clan_id = ? 
           AND (self_destruct_at IS NULL OR self_destruct_at > ?)
           ORDER BY timestamp ASC;`,
          [clanId, now],
          (_, { rows }) => {
            const messages = [];
            for (let i = 0; i < rows.length; i++) {
              messages.push(rows.item(i));
            }
            resolve(messages);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Atualizar mensagem (Sprint 6 - ETAPA 5)
  // ---------------------------------------------------------
  async updateMessage(messageId, updates) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, atualiza no localStorage
      const messages = this._getWebMessages();
      const index = messages.findIndex(m => m.id === parseInt(messageId));
      
      if (index === -1) {
        return Promise.reject(new Error('Mensagem não encontrada'));
      }

      // Aplicar atualizações
      messages[index] = { ...messages[index], ...updates };
      this._saveWebMessages(messages);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Construir query dinamicamente baseado nos updates
        const fields = [];
        const values = [];

        if (updates.message !== undefined) {
          fields.push('message = ?');
          values.push(updates.message);
        }
        if (updates.original_content !== undefined) {
          fields.push('original_content = ?');
          values.push(updates.original_content);
        }
        if (updates.edited !== undefined) {
          fields.push('edited = ?');
          values.push(updates.edited);
        }
        if (updates.deleted !== undefined) {
          fields.push('deleted = ?');
          values.push(updates.deleted);
        }
        if (updates.edited_at !== undefined) {
          fields.push('edited_at = ?');
          values.push(updates.edited_at);
        }

        if (fields.length === 0) {
          resolve(true);
          return;
        }

        values.push(messageId);

        tx.executeSql(
          `UPDATE clan_messages SET ${fields.join(', ')} WHERE id = ?;`,
          values,
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Batch Insert - Inserir múltiplas mensagens (Sprint 7 - ETAPA 6)
  // ---------------------------------------------------------
  async batchInsertMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return Promise.resolve([]);
    }

    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const allMessages = this._getWebMessages();
      const newMessages = messages.map(msg => ({
        id: Date.now() + Math.random(), // ID único
        clan_id: parseInt(msg.clanId),
        author_totem: msg.authorTotem,
        message: msg.text,
        timestamp: msg.timestamp || Date.now(),
        self_destruct_at: msg.selfDestructAt || null,
        burn_after_read: msg.burnAfterRead ? 1 : 0,
        reactions: msg.reactions || null,
        delivered_to: msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
        read_by: msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
        edited: msg.edited || 0,
        deleted: msg.deleted || 0,
        original_content: msg.originalContent || null,
        edited_at: msg.editedAt || null
      }));
      
      allMessages.push(...newMessages);
      this._saveWebMessages(allMessages);
      return Promise.resolve(newMessages);
    }

    // No SQLite, usa transação única para inserir todas
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        const insertedMessages = [];
        let insertCount = 0;
        const totalMessages = messages.length;

        messages.forEach((msg, index) => {
          tx.executeSql(
            `INSERT INTO clan_messages (clan_id, author_totem, message, timestamp, self_destruct_at, burn_after_read, reactions, delivered_to, read_by, edited, deleted, original_content, edited_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              msg.clanId,
              msg.authorTotem,
              msg.text,
              msg.timestamp || Date.now(),
              msg.selfDestructAt || null,
              msg.burnAfterRead ? 1 : 0,
              msg.reactions || null,
              msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
              msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
              msg.edited || 0,
              msg.deleted || 0,
              msg.originalContent || null,
              msg.editedAt || null
            ],
            (_, result) => {
              insertedMessages.push({
                id: result.insertId,
                clan_id: msg.clanId,
                author_totem: msg.authorTotem,
                message: msg.text,
                timestamp: msg.timestamp || Date.now(),
                self_destruct_at: msg.selfDestructAt || null,
                burn_after_read: msg.burnAfterRead ? 1 : 0,
                reactions: msg.reactions || null,
                delivered_to: msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
                read_by: msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
                edited: msg.edited || 0,
                deleted: msg.deleted || 0,
                original_content: msg.originalContent || null,
                edited_at: msg.editedAt || null
              });
              
              insertCount++;
              if (insertCount === totalMessages) {
                resolve(insertedMessages);
              }
            },
            (_, error) => {
              console.error(`Erro ao inserir mensagem ${index} no batch:`, error);
              insertCount++;
              if (insertCount === totalMessages) {
                // Retorna o que conseguiu inserir
                resolve(insertedMessages);
              }
            }
          );
        });
      }, (error) => {
        console.error('Erro na transação batch:', error);
        reject(error);
      });
    });
  }

  // ---------------------------------------------------------
  // Deletar mensagem fisicamente (para uso interno)
  // ---------------------------------------------------------
  async deleteMessage(messageId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const messages = this._getWebMessages();
      const filtered = messages.filter(m => m.id !== parseInt(messageId));
      this._saveWebMessages(filtered);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM clan_messages WHERE id = ?;`,
          [messageId],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Obter banco de dados (para uso externo)
  // ---------------------------------------------------------
  getDB() {
    return this.db;
  }

  // ---------------------------------------------------------
  // Limpar todas as mensagens de um CLANN
  // ---------------------------------------------------------
  async clearMessages(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const messages = this._getWebMessages();
      const filtered = messages.filter(m => m.clan_id !== parseInt(clanId));
      this._saveWebMessages(filtered);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM clan_messages WHERE clan_id = ?;`,
          [clanId],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }
}

export default new MessagesStorage();

