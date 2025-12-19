import { Platform } from 'react-native';
import { randomBytes } from '../utils/randomBytes';
import { sha256 } from '@noble/hashes/sha256';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null;
} else {
  SQLite = require('expo-sqlite');
}

// Chave para localStorage na Web
const WEB_KEYS_KEY = 'clann_clan_keys';

/**
 * Gerenciador de chaves de grupo (GroupKeys) para criptografia E2E
 * Cada CLANN tem uma GroupKey única usada para criptografar mensagens
 */
class KeyManager {
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
  _getWebKeys() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_KEYS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebKeys(keys) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_KEYS_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Erro ao salvar chaves no localStorage:', error);
    }
  }

  // ---------------------------------------------------------
  // Inicialização - Criar tabela de chaves
  // ---------------------------------------------------------
  async init() {
    if (Platform.OS === 'web' || !this.db) {
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clan_id INTEGER NOT NULL UNIQUE,
            group_key TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (clan_id) REFERENCES clans(id)
          );`
        );

        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_keys_clan_id ON clan_keys(clan_id);`
        );
      },
      (error) => reject(error),
      () => resolve(true));
    });
  }

  // ---------------------------------------------------------
  // Gerar GroupKey para um CLANN
  // ---------------------------------------------------------
  async generateGroupKey(clanId) {
    // Gera 32 bytes aleatórios (256 bits) para AES-256
    const keyBytes = randomBytes(32);
    const groupKey = Buffer.from(keyBytes).toString('hex');

    // Salva a chave
    await this.saveGroupKey(clanId, groupKey);

    return groupKey;
  }

  // ---------------------------------------------------------
  // Salvar GroupKey
  // ---------------------------------------------------------
  async saveGroupKey(clanId, groupKey) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const keys = this._getWebKeys();
      const existingIndex = keys.findIndex(k => k.clan_id === parseInt(clanId));
      
      const keyData = {
        id: existingIndex >= 0 ? keys[existingIndex].id : Date.now(),
        clan_id: parseInt(clanId),
        group_key: groupKey,
        created_at: existingIndex >= 0 ? keys[existingIndex].created_at : Date.now(),
        updated_at: Date.now(),
      };

      if (existingIndex >= 0) {
        keys[existingIndex] = keyData;
      } else {
        keys.push(keyData);
      }

      this._saveWebKeys(keys);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Verifica se já existe
        tx.executeSql(
          `SELECT id FROM clan_keys WHERE clan_id = ?;`,
          [clanId],
          (_, { rows }) => {
            const now = Date.now();
            
            if (rows.length > 0) {
              // Atualiza chave existente
              tx.executeSql(
                `UPDATE clan_keys 
                 SET group_key = ?, updated_at = ? 
                 WHERE clan_id = ?;`,
                [groupKey, now, clanId],
                () => resolve(true),
                (_, error) => reject(error)
              );
            } else {
              // Insere nova chave
              tx.executeSql(
                `INSERT INTO clan_keys (clan_id, group_key, created_at, updated_at)
                 VALUES (?, ?, ?, ?);`,
                [clanId, groupKey, now, now],
                () => resolve(true),
                (_, error) => reject(error)
              );
            }
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Obter GroupKey de um CLANN
  // ---------------------------------------------------------
  async getGroupKey(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const keys = this._getWebKeys();
      const keyData = keys.find(k => k.clan_id === parseInt(clanId));
      
      if (!keyData) {
        // Se não existe, gera uma nova
        return await this.generateGroupKey(clanId);
      }

      return Promise.resolve(keyData.group_key);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT group_key FROM clan_keys WHERE clan_id = ? LIMIT 1;`,
          [clanId],
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(rows.item(0).group_key);
            } else {
              // Se não existe, gera uma nova
              this.generateGroupKey(clanId)
                .then(key => resolve(key))
                .catch(error => reject(error));
            }
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Regenerar GroupKey (para modo de emergência)
  // ---------------------------------------------------------
  async regenerateGroupKey(clanId) {
    return await this.generateGroupKey(clanId);
  }

  // ---------------------------------------------------------
  // Deletar GroupKey
  // ---------------------------------------------------------
  async deleteGroupKey(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      const keys = this._getWebKeys();
      const filtered = keys.filter(k => k.clan_id !== parseInt(clanId));
      this._saveWebKeys(filtered);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM clan_keys WHERE clan_id = ?;`,
          [clanId],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }
}

export default new KeyManager();

