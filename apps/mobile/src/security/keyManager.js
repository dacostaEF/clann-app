import { Platform } from 'react-native';
import { randomBytes } from '../utils/randomBytes';
import { sha256 } from '@noble/hashes/sha256';
import { getDatabase as getClanDatabase } from '../clans/ClanStorage';

// Chave para localStorage na Web
const WEB_KEYS_KEY = 'clann_clan_keys';

/**
 * Gerenciador de chaves de grupo (GroupKeys) para criptografia E2E
 * Cada CLANN tem uma GroupKey única usada para criptografar mensagens
 */
class KeyManager {
  constructor() {
    this.db = null; // Será inicializado via getClanDatabase() (mesmo banco das mensagens)
    this.keyCache = new Map(); // ✅ Cache em memória por clanId
    this.dbInitPromise = null; // Lock para evitar corridas de inicialização
  }

  // ---------------------------------------------------------
  // ✅ Garantir inicialização única do DB (mesmo banco das mensagens)
  // ---------------------------------------------------------
  async ensureDb() {
    if (Platform.OS === 'web') {
      return null; // Web usa localStorage
    }

    // Se já está inicializado, retorna imediatamente
    if (this.db) {
      return this.db;
    }

    // Se não há promise de inicialização, cria uma (lock)
    if (!this.dbInitPromise) {
      this.dbInitPromise = (async () => {
        const db = await getClanDatabase(); // ✅ Usa mesmo banco das mensagens (clann.db)
        if (!db) {
          throw new Error('[FATAL] DB não inicializado - getClanDatabase() retornou null');
        }
        this.db = db;
        console.log('[KeyManager] DB inicializado (clann.db - mesmo das mensagens)');
        return db;
      })();
    }

    // Aguarda a promise de inicialização (mesma para todas as chamadas simultâneas)
    return await this.dbInitPromise;
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
    if (Platform.OS === 'web') {
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (!db || typeof db.execAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação keyManager.init');
      return Promise.resolve(true);
    }
    
    try {
      // ✅ Usar API async (mesma do resto do app)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS clan_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL UNIQUE,
          group_key TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_keys_clan_id ON clan_keys(clan_id);
      `);
      return true;
    } catch (error) {
      console.error('Erro ao inicializar tabela clan_keys:', error);
      return false;
    }
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
    const normalizedClanId = parseInt(clanId);
    
    // Atualizar cache
    this.keyCache.set(normalizedClanId, groupKey);
    
    if (Platform.OS === 'web') {
      // Na Web, salva no localStorage
      const keys = this._getWebKeys();
      const existingIndex = keys.findIndex(k => k.clan_id === normalizedClanId);
      
      const keyData = {
        id: existingIndex >= 0 ? keys[existingIndex].id : Date.now(),
        clan_id: normalizedClanId,
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

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (!db || typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação keyManager.saveGroupKey');
      return Promise.reject(new Error('SQLite async API não disponível'));
    }
    
    try {
      const now = Date.now();
      // ✅ Usar API async: UPDATE ou INSERT
      await db.runAsync(
        `UPDATE clan_keys 
         SET group_key = ?, updated_at = ? 
         WHERE clan_id = ?;`,
        [groupKey, now, normalizedClanId]
      );
      
      // Se nenhuma linha foi afetada, fazer INSERT
      const result = await db.getFirstAsync(
        `SELECT id FROM clan_keys WHERE clan_id = ? LIMIT 1;`,
        [normalizedClanId]
      );
      
      if (!result) {
        await db.runAsync(
          `INSERT INTO clan_keys (clan_id, group_key, created_at, updated_at)
           VALUES (?, ?, ?, ?);`,
          [normalizedClanId, groupKey, now, now]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar groupKey:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------
  // Obter GroupKey de um CLANN (ATÔMICO - garante mesma key sempre)
  // ---------------------------------------------------------
  async getGroupKey(clanId) {
    const normalizedClanId = parseInt(clanId);
    
    // ✅ 1. Cache em memória - se já pegou, retorna imediatamente
    if (this.keyCache.has(normalizedClanId)) {
      const cachedKey = this.keyCache.get(normalizedClanId);
      console.log('[KeyManager] getGroupKey cache HIT para clanId:', normalizedClanId);
      return cachedKey;
    }
    console.log('[KeyManager] getGroupKey cache MISS para clanId:', normalizedClanId);

    if (Platform.OS === 'web') {
      // Na Web, busca no localStorage
      const keys = this._getWebKeys();
      const keyData = keys.find(k => k.clan_id === normalizedClanId);
      
      if (!keyData) {
        // Se não existe, gera uma nova
        const newKey = await this.generateGroupKey(normalizedClanId);
        this.keyCache.set(normalizedClanId, newKey);
        return newKey;
      }

      const key = keyData.group_key;
      this.keyCache.set(normalizedClanId, key);
      return key;
    }

    // ✅ 2. Garantir DB inicializado (mesmo banco das mensagens)
    const db = await this.ensureDb();
    if (!db || typeof db.runAsync !== 'function' || typeof db.getFirstAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação keyManager.getGroupKey');
      return Promise.reject(new Error('SQLite async API não disponível'));
    }

    try {
      // ✅ 3. Criar chave atômica: INSERT OR IGNORE + SELECT
      // Isso garante que mesmo com chamadas simultâneas, apenas 1 INSERT vence
      // e o SELECT sempre retorna a mesma chave
      
      // Gerar chave apenas para o INSERT (se já existir, IGNORE)
      const keyBytes = randomBytes(32);
      const newGroupKey = Buffer.from(keyBytes).toString('hex');
      const now = Date.now();
      
      // INSERT OR IGNORE - se já existe, ignora silenciosamente
      await db.runAsync(
        `INSERT OR IGNORE INTO clan_keys (clan_id, group_key, created_at, updated_at)
         VALUES (?, ?, ?, ?);`,
        [normalizedClanId, newGroupKey, now, now]
      );
      console.log('[KeyManager] INSERT OR IGNORE executed para clanId:', normalizedClanId);
      
      // SELECT - sempre retorna a chave que está no banco (mesma para todas as chamadas)
      const result = await db.getFirstAsync(
        `SELECT group_key FROM clan_keys WHERE clan_id = ? LIMIT 1;`,
        [normalizedClanId]
      );
      
      if (!result || !result.group_key) {
        throw new Error('Chave não encontrada após INSERT OR IGNORE');
      }
      
      const groupKey = result.group_key;
      console.log('[KeyManager] SELECT groupKey length:', groupKey?.length || 0);
      
      // ✅ 4. Guardar no cache
      this.keyCache.set(normalizedClanId, groupKey);
      
      return groupKey;
    } catch (error) {
      console.error('Erro ao obter groupKey:', error);
      throw new Error(`Falha ao obter groupKey para clanId ${normalizedClanId}: ${error.message}`);
    }
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
    const normalizedClanId = parseInt(clanId);
    
    // Remover do cache
    this.keyCache.delete(normalizedClanId);
    
    if (Platform.OS === 'web') {
      const keys = this._getWebKeys();
      const filtered = keys.filter(k => k.clan_id !== normalizedClanId);
      this._saveWebKeys(filtered);
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (!db || typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação keyManager.deleteGroupKey');
      return Promise.resolve(true);
    }
    
    try {
      // ✅ Usar API async
      await db.runAsync(
        `DELETE FROM clan_keys WHERE clan_id = ?;`,
        [normalizedClanId]
      );
      return true;
    } catch (error) {
      console.error('Erro ao deletar groupKey:', error);
      return false;
    }
  }
}

export default new KeyManager();

