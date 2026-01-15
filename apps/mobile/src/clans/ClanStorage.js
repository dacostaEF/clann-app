import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

// Chaves para localStorage na Web
const WEB_CLANS_KEY = 'clann_clans';
const WEB_CLAN_MEMBERS_KEY = 'clann_clan_members';
const WEB_MESSAGES_KEY = 'clann_messages';
const WEB_LINKED_DEVICES_KEY = 'clann_linked_devices';
const WEB_SECURITY_LOG_KEY = 'clann_security_log';
const WEB_CLAN_RULES_KEY = 'clann_clan_rules';
const WEB_CLAN_COUNCIL_KEY = 'clann_clan_council';
const WEB_PENDING_APPROVALS_KEY = 'clann_pending_approvals';

let database = null;

export const getDatabase = async () => {
  if (!database) {
    try {
      database = await SQLite.openDatabaseAsync('clann.db');
      
      // 🔍 AUDITORIA SQLite: Logar informações do banco
      console.log('[AUDITORIA SQLite] ClanStorage.getDatabase()');
      console.log('[AUDITORIA SQLite] db.constructor:', database?.constructor?.name);
      console.log('[AUDITORIA SQLite] typeof db.transaction:', typeof database?.transaction);
      console.log('[AUDITORIA SQLite] Nome do banco: clann.db');
      console.log('[AUDITORIA SQLite] Instância do banco:', database);
      
      // 🔍 AUDITORIA SQLite: Verificar tabelas existentes
      try {
        const tables = await database.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
        console.log('[AUDITORIA SQLite] Tabelas no banco:', tables.map(t => t.name));
        const clanMessagesExists = tables.some(t => t.name === 'clan_messages');
        console.log('[AUDITORIA SQLite] Tabela clan_messages existe?', clanMessagesExists);
      } catch (err) {
        console.warn('[AUDITORIA SQLite] Erro ao verificar tabelas:', err);
      }
      
      console.log('[AUDITORIA SQLite] Database opened successfully');
    } catch (error) {
      console.error('[AUDITORIA SQLite] Failed to open database:', error);
      throw error;
    }
  } else {
    // 🔍 AUDITORIA SQLite: Logar quando banco já existe
    console.log('[AUDITORIA SQLite] ClanStorage.getDatabase() - reutilizando instância existente');
    console.log('[AUDITORIA SQLite] Instância do banco:', database);
  }
  return database;
};

export const initializeDatabase = async () => {
  const db = await getDatabase();
};

class ClanStorage {
  constructor() {
    if (Platform.OS !== 'web' && SQLite) {
      this.db = null; // Será inicializado via getDatabase()
    } else {
      this.db = null; // No web, não há banco
    }
    this.dbInitPromise = null; // Lock para evitar corridas de inicialização
  }

  // ---------------------------------------------------------
  // Garantir inicialização única do DB (com lock)
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
        const db = await getDatabase();
        if (!db) {
          throw new Error('[FATAL] DB não inicializado - getDatabase() retornou null');
        }
        this.db = db;
        return db;
      })();
    }

    // Aguarda a promise de inicialização (mesma para todas as chamadas simultâneas)
    return await this.dbInitPromise;
  }

  // ---------------------------------------------------------
  // Helpers para localStorage na Web
  // ---------------------------------------------------------
  _getWebClans() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_CLANS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebClans(clans) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_CLANS_KEY, JSON.stringify(clans));
    } catch (error) {
      console.error('Erro ao salvar CLANNs no localStorage:', error);
    }
  }

  _getWebMembers() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_CLAN_MEMBERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebMembers(members) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_CLAN_MEMBERS_KEY, JSON.stringify(members));
    } catch (error) {
      console.error('Erro ao salvar membros no localStorage:', error);
    }
  }

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

  _getWebLinkedDevices() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_LINKED_DEVICES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebLinkedDevices(devices) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_LINKED_DEVICES_KEY, JSON.stringify(devices));
    } catch (error) {
      console.error('Erro ao salvar dispositivos vinculados no localStorage:', error);
    }
  }

  _getWebSecurityLog() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_SECURITY_LOG_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebSecurityLog(logs) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_SECURITY_LOG_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Erro ao salvar log de segurança no localStorage:', error);
    }
  }

  _getWebRules() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_CLAN_RULES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebRules(rules) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_CLAN_RULES_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error('Erro ao salvar regras no localStorage:', error);
    }
  }

  _getWebCouncil() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_CLAN_COUNCIL_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebCouncil(council) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_CLAN_COUNCIL_KEY, JSON.stringify(council));
    } catch (error) {
      console.error('Erro ao salvar conselho no localStorage:', error);
    }
  }

  _getWebPendingApprovals() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_PENDING_APPROVALS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebPendingApprovals(approvals) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_PENDING_APPROVALS_KEY, JSON.stringify(approvals));
    } catch (error) {
      console.error('Erro ao salvar aprovações pendentes no localStorage:', error);
    }
  }

  getDB() {
    return this.db;
  }

  async init() {
    if (Platform.OS === 'web') {
      // No web, não há banco de dados
      return Promise.resolve(true);
    }
    
    // ✅ INICIALIZAR this.db ANTES de qualquer operação
    if (!this.db) {
      try {
        this.db = await getDatabase();
        console.log('✅ ClanStorage: this.db inicializado com sucesso');
      } catch (error) {
        console.error('❌ ClanStorage: Erro ao inicializar this.db:', error);
        return Promise.reject(error);
      }
    }
    
    try {
      // ✅ Migrado para API async - execAsync para criação de tabelas
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS clans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          description TEXT,
          invite_code TEXT UNIQUE NOT NULL,
          privacy TEXT DEFAULT 'public',
          created_at TEXT NOT NULL,
          founder_totem TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clan_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL,
          totem_id TEXT NOT NULL,
          role TEXT NOT NULL,
          joined_at TEXT NOT NULL,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE TABLE IF NOT EXISTS clan_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          payload TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE TABLE IF NOT EXISTS clan_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL,
          author_totem TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          self_destruct_at INTEGER,
          burn_after_read INTEGER DEFAULT 0,
          reactions TEXT,
          delivered_to TEXT,
          read_by TEXT,
          edited INTEGER DEFAULT 0,
          deleted INTEGER DEFAULT 0,
          original_content TEXT,
          edited_at INTEGER,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_clan_id ON clan_messages(clan_id);

        CREATE TABLE IF NOT EXISTS linked_devices (
          device_id TEXT PRIMARY KEY,
          totem_id TEXT NOT NULL,
          public_key TEXT NOT NULL,
          linked_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_linked_devices_totem_id ON linked_devices(totem_id);

        CREATE TABLE IF NOT EXISTS security_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event TEXT NOT NULL,
          actor_totem TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          prev_hash TEXT,
          hash TEXT NOT NULL,
          details TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_security_log_timestamp ON security_log(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_security_log_actor ON security_log(actor_totem);

        CREATE TABLE IF NOT EXISTS clan_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL,
          rule_id TEXT NOT NULL,
          text TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          version INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          approved_by TEXT,
          category TEXT,
          template_id TEXT,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE TABLE IF NOT EXISTS rule_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          text TEXT NOT NULL,
          category TEXT,
          description TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rule_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          text TEXT NOT NULL,
          changed_by TEXT,
          changed_at INTEGER NOT NULL,
          change_type TEXT,
          FOREIGN KEY (rule_id) REFERENCES clan_rules(rule_id)
        );

        CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);
        CREATE INDEX IF NOT EXISTS idx_clan_rules_category ON clan_rules(category);

        CREATE TABLE IF NOT EXISTS clan_council (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL UNIQUE,
          founder_totem TEXT NOT NULL,
          elders TEXT,
          approvals_required INTEGER DEFAULT 2,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE TABLE IF NOT EXISTS pending_approvals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clan_id INTEGER NOT NULL,
          action_type TEXT NOT NULL,
          action_data TEXT,
          requested_by TEXT NOT NULL,
          approvals TEXT,
          rejections TEXT,
          status TEXT DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          executed INTEGER DEFAULT 0,
          executed_at INTEGER,
          FOREIGN KEY (clan_id) REFERENCES clans(id)
        );

        CREATE INDEX IF NOT EXISTS idx_clan_rules_clan_id ON clan_rules(clan_id);
        CREATE INDEX IF NOT EXISTS idx_pending_approvals_clan_id ON pending_approvals(clan_id);
      `);

      // ✅ Migrado para API async - ALTER TABLE com try/catch para ignorar erros
      const alterTableQueries = [
        `ALTER TABLE clan_messages ADD COLUMN self_destruct_at INTEGER;`,
        `ALTER TABLE clan_messages ADD COLUMN burn_after_read INTEGER DEFAULT 0;`,
        `ALTER TABLE clan_messages ADD COLUMN reactions TEXT;`,
        `ALTER TABLE clan_messages ADD COLUMN delivered_to TEXT;`,
        `ALTER TABLE clan_messages ADD COLUMN read_by TEXT;`,
        `ALTER TABLE clan_messages ADD COLUMN edited INTEGER DEFAULT 0;`,
        `ALTER TABLE clan_messages ADD COLUMN deleted INTEGER DEFAULT 0;`,
        `ALTER TABLE clan_messages ADD COLUMN original_content TEXT;`,
        `ALTER TABLE clan_messages ADD COLUMN edited_at INTEGER;`,
        `ALTER TABLE clan_messages ADD COLUMN status TEXT DEFAULT 'sent';`, // PASSO 1: Status de envio
        `ALTER TABLE clan_rules ADD COLUMN category TEXT;`,
        `ALTER TABLE clan_rules ADD COLUMN template_id TEXT;`,
        `ALTER TABLE pending_approvals ADD COLUMN executed INTEGER DEFAULT 0;`,
        `ALTER TABLE pending_approvals ADD COLUMN executed_at INTEGER;`
      ];

      for (const query of alterTableQueries) {
        try {
          await this.db.execAsync(query);
        } catch (error) {
          // Ignora erro se coluna já existe (migration idempotente)
          // SQLite retorna erro específico quando coluna já existe
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes('duplicate column') || 
              errorMessage.includes('already exists') ||
              errorMessage.includes('no such column') === false) {
            // Coluna já existe ou outro erro não crítico - ignorar silenciosamente
            // (migration idempotente é o comportamento esperado)
          } else {
            // Outro tipo de erro - logar mas não bloquear
            console.warn(`[ClanStorage] Aviso na migration: ${errorMessage}`);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('❌ ClanStorage: Erro ao inicializar banco:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------
  // Criar CLANN
  // ---------------------------------------------------------
  async createClan(data, totemId, founderPublicKey = null) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const invite = this._generateInviteCode();
      const clanId = Date.now();
      const now = new Date().toISOString();
      
      const newClan = {
        id: clanId,
        name: data.name,
        icon: data.icon,
        description: data.description || '',
        invite_code: invite,
        privacy: data.privacy || 'public',
        created_at: now,
        founder_totem: totemId,
        founder_public_key: founderPublicKey // MVP 1: Key Exchange
      };

      // Salva o CLANN
      const clans = this._getWebClans();
      clans.push(newClan);
      this._saveWebClans(clans);

      // Salva o membro (fundador) com public_key
      const members = this._getWebMembers();
      members.push({
        id: Date.now() + 1,
        clan_id: clanId,
        totem_id: totemId,
        role: 'founder',
        joined_at: now,
        public_key: founderPublicKey // MVP 1: Key Exchange
      });
      this._saveWebMembers(members);

      return Promise.resolve({
        id: clanId,
        name: data.name,
        icon: data.icon,
        description: data.description || '',
        invite_code: invite,
        privacy: data.privacy || 'public',
        members: 1,
        role: 'founder'
      });
    }

    const invite = this._generateInviteCode();

    // ✅ Migrado para API async - runAsync para INSERTs
    try {
      // Migration: garantir que coluna founder_public_key existe
      try {
        await this.db.execAsync(`ALTER TABLE clans ADD COLUMN founder_public_key TEXT;`);
      } catch (e) {
        // Ignora se coluna já existe
      }
      try {
        await this.db.execAsync(`ALTER TABLE clan_members ADD COLUMN public_key TEXT;`);
      } catch (e) {
        // Ignora se coluna já existe
      }

      const result = await this.db.runAsync(
        `INSERT INTO clans (name, icon, description, invite_code, privacy, created_at, founder_totem, founder_public_key)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?);`,
        [data.name, data.icon, data.description || null, invite, data.privacy || 'public', totemId, founderPublicKey]
      );

      const clanId = result.lastInsertRowId;

      // 🟢 LOG DIAGNÓSTICO: CLANN inserido no banco
      console.log('🟢 [DB] CLANN inserido', { 
        clanId: clanId, 
        totemId: totemId 
      });

      // Inserir o fundador como membro com public_key
      await this.db.runAsync(
        `INSERT INTO clan_members (clan_id, totem_id, role, joined_at, public_key)
         VALUES (?, ?, 'founder', datetime('now'), ?);`,
        [clanId, totemId, founderPublicKey]
      );

      return {
        id: clanId,
        name: data.name,
        icon: data.icon,
        description: data.description,
        invite_code: invite
      };
    } catch (error) {
      throw error;
    }
  }

  // ---------------------------------------------------------
  // Entrar no CLANN via invite code
  // ---------------------------------------------------------
  async joinClan(inviteCode, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const clans = this._getWebClans();
      const clan = clans.find(c => c.invite_code === inviteCode.toUpperCase());
      
      if (!clan) {
        throw new Error('Código de convite inválido');
      }

      // Verifica se já é membro
      const members = this._getWebMembers();
      const alreadyMember = members.some(
        m => m.clan_id === clan.id && m.totem_id === totemId
      );

      if (alreadyMember) {
        throw new Error('Você já é membro deste CLANN');
      }

      // Adiciona como membro
      members.push({
        id: Date.now(),
        clan_id: clan.id,
        totem_id: totemId,
        role: 'member',
        joined_at: new Date().toISOString()
      });
      this._saveWebMembers(members);

      return clan;
    }

    // Busca o clan pelo invite_code
    const clan = await this.db.getFirstAsync(
      `SELECT * FROM clans WHERE invite_code = ? LIMIT 1;`,
      [inviteCode]
    );

    if (!clan) {
      throw new Error('Código de convite inválido');
    }

    // Insere como membro
    await this.db.runAsync(
      `INSERT INTO clan_members (clan_id, totem_id, role, joined_at)
       VALUES (?, ?, 'member', datetime('now'));`,
      [clan.id, totemId]
    );

    return clan;
  }

  // ---------------------------------------------------------
  // Sair do CLANN
  // ---------------------------------------------------------
  async leaveClan(clanId, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const members = this._getWebMembers();
      const filtered = members.filter(
        m => !(m.clan_id === parseInt(clanId) && m.totem_id === totemId)
      );
      this._saveWebMembers(filtered);
      return true;
    }

    await this.db.runAsync(
      `DELETE FROM clan_members WHERE clan_id = ? AND totem_id = ?;`,
      [clanId, totemId]
    );

    return true;
  }

  // ---------------------------------------------------------
  // Buscar CLANN por código de convite (MVP 1: Key Exchange)
  // ---------------------------------------------------------
  async getClanByInviteCode(inviteCode) {
    if (Platform.OS === 'web' || !this.db) {
      const clans = this._getWebClans();
      const clan = clans.find(c => c.invite_code === inviteCode.toUpperCase());
      return clan || null;
    }

    const db = await this.ensureDb();
    const result = await db.getFirstAsync(
      `SELECT * FROM clans WHERE invite_code = ? LIMIT 1;`,
      [inviteCode.toUpperCase()]
    );
    return result || null;
  }

  // ---------------------------------------------------------
  // Buscar membros de um CLANN (MVP 1: Key Exchange)
  // ---------------------------------------------------------
  async getClanMembers(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      const members = this._getWebMembers();
      return members.filter(m => m.clan_id === parseInt(clanId));
    }

    const db = await this.ensureDb();
    const results = await db.getAllAsync(
      `SELECT * FROM clan_members WHERE clan_id = ?;`,
      [parseInt(clanId)]
    );
    return results || [];
  }

  // ---------------------------------------------------------
  // Buscar CLANN por ID
  // ---------------------------------------------------------
  getClanById(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const clans = this._getWebClans();
      const clan = clans.find(c => c.id === parseInt(clanId));
      
      if (!clan) {
        return Promise.reject(new Error('CLANN não encontrado'));
      }

      // Conta membros
      const members = this._getWebMembers();
      const memberCount = members.filter(m => m.clan_id === parseInt(clanId)).length;

      return Promise.resolve({
        ...clan,
        members: memberCount
      });
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `
          SELECT c.*, 
            (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) AS members
          FROM clans c
          WHERE c.id = ?
          `,
          [clanId],
          (_, { rows }) => {
            if (rows.length === 0) {
              reject(new Error("CLANN não encontrado"));
            } else {
              resolve(rows.item(0));
            }
          },
          (_, err) => reject(err)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Buscar CLANNs do usuário
  // ---------------------------------------------------------
  async getUserClans(totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const members = this._getWebMembers();
      const clans = this._getWebClans();
      
      // Encontra CLANNs onde o usuário é membro
      const userMemberShips = members.filter(m => m.totem_id === totemId);
      const userClans = userMemberShips.map(membership => {
        const clan = clans.find(c => c.id === membership.clan_id);
        if (!clan) return null;
        
        // Conta membros deste CLANN
        const memberCount = members.filter(m => m.clan_id === clan.id).length;
        
        return {
          ...clan,
          role: membership.role,
          members: memberCount
        };
      }).filter(c => c !== null);

      // Ordena por data de criação (mais recente primeiro)
      userClans.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      // 🗃️ LOG DIAGNÓSTICO FINAL: Query executada (Web)
      console.log('🗃️ [SQL] Query executada para totem_id:', totemId);
      console.log('🗃️ [SQL] Resultados da query:', userClans);

      return Promise.resolve(userClans);
    }

    // ✅ Migrado para API async - getAllAsync para SELECT
    try {
      const results = await this.db.getAllAsync(
        `SELECT c.*, m.role,
          (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) AS members
        FROM clans c
        JOIN clan_members m ON m.clan_id = c.id
        WHERE m.totem_id = ?
        ORDER BY c.created_at DESC;`,
        [totemId]
      );
      
      // 🗃️ LOG DIAGNÓSTICO FINAL: Query executada (SQLite)
      console.log('🗃️ [SQL] Query executada para totem_id:', totemId);
      console.log('🗃️ [SQL] Resultados da query:', results);
      
      return results;
    } catch (error) {
      throw error;
    }
  }

  // ---------------------------------------------------------
  // Dispositivos Vinculados (Sprint 7 - ETAPA 1)
  // ---------------------------------------------------------
  
  /**
   * Adiciona um dispositivo vinculado
   * @param {string} deviceId - ID único do dispositivo
   * @param {string} totemId - ID do Totem
   * @param {string} publicKey - Chave pública do dispositivo
   * @returns {Promise<void>}
   */
  async addLinkedDevice(deviceId, totemId, publicKey) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const devices = this._getWebLinkedDevices();
      devices.push({
        device_id: deviceId,
        totem_id: totemId,
        public_key: publicKey,
        linked_at: Date.now()
      });
      this._saveWebLinkedDevices(devices);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT OR REPLACE INTO linked_devices (device_id, totem_id, public_key, linked_at)
           VALUES (?, ?, ?, ?);`,
          [deviceId, totemId, publicKey, Date.now()],
          () => resolve(),
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Busca dispositivos vinculados a um Totem
   * @param {string} totemId - ID do Totem
   * @returns {Promise<Array>}
   */
  async getLinkedDevices(totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const devices = this._getWebLinkedDevices();
      return Promise.resolve(devices.filter(d => d.totem_id === totemId));
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM linked_devices WHERE totem_id = ? ORDER BY linked_at DESC;`,
          [totemId],
          (_, { rows }) => resolve(rows._array),
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Remove um dispositivo vinculado
   * @param {string} deviceId - ID do dispositivo
   * @returns {Promise<void>}
   */
  async removeLinkedDevice(deviceId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const devices = this._getWebLinkedDevices();
      const filtered = devices.filter(d => d.device_id !== deviceId);
      this._saveWebLinkedDevices(filtered);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM linked_devices WHERE device_id = ?;`,
          [deviceId],
          () => resolve(),
          (_, err) => reject(err)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Security Log - Hash-Chain (Sprint 7 - ETAPA 3)
  // ---------------------------------------------------------

  /**
   * Adiciona um evento ao log de segurança com hash-chain
   * @param {string} event - Tipo de evento
   * @param {string} actorTotem - Totem que executou a ação
   * @param {string} details - Detalhes adicionais (JSON string)
   * @param {string} hash - Hash calculado (gerado externamente)
   * @param {string} prevHash - Hash do evento anterior
   * @returns {Promise<number>} ID do evento registrado
   */
  async addSecurityLogEvent(event, actorTotem, hash, prevHash = null, details = null) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const logs = this._getWebSecurityLog();
      const newLog = {
        id: Date.now(),
        event,
        actor_totem: actorTotem,
        timestamp: Date.now(),
        prev_hash: prevHash,
        hash,
        details
      };
      logs.push(newLog);
      this._saveWebSecurityLog(logs);
      return Promise.resolve(newLog.id);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO security_log (event, actor_totem, timestamp, prev_hash, hash, details)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [event, actorTotem, Date.now(), prevHash, hash, details],
          (_, result) => resolve(result.insertId),
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Busca o último evento do log (para obter prev_hash)
   * @returns {Promise<Object|null>} Último evento ou null
   */
  async getLastSecurityLogEvent() {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const logs = this._getWebSecurityLog();
      if (logs.length === 0) return null;
      
      // Ordena por timestamp e retorna o último
      const sorted = logs.sort((a, b) => b.timestamp - a.timestamp);
      return sorted[0];
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM security_log ORDER BY timestamp DESC LIMIT 1;`,
          [],
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(rows.item(0));
            } else {
              resolve(null);
            }
          },
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Busca eventos do log de segurança
   * @param {number} limit - Limite de eventos (padrão: 100)
   * @param {number} offset - Offset para paginação
   * @returns {Promise<Array>} Lista de eventos
   */
  async getSecurityLogEvents(limit = 100, offset = 0) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const logs = this._getWebSecurityLog();
      const sorted = logs.sort((a, b) => b.timestamp - a.timestamp);
      return Promise.resolve(sorted.slice(offset, offset + limit));
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM security_log ORDER BY timestamp DESC LIMIT ? OFFSET ?;`,
          [limit, offset],
          (_, { rows }) => resolve(rows._array),
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Verifica integridade da hash-chain
   * @returns {Promise<Object>} Resultado da verificação
   */
  async verifySecurityLogIntegrity() {
    try {
      const events = await this.getSecurityLogEvents(1000, 0);
      
      if (events.length === 0) {
        return { valid: true, errors: [] };
      }

      const errors = [];
      
      // Verifica cada evento em relação ao anterior
      for (let i = 0; i < events.length - 1; i++) {
        const current = events[i];
        const next = events[i + 1];
        
        // O hash do próximo evento deve corresponder ao prev_hash
        if (next.prev_hash !== current.hash) {
          errors.push({
            eventId: next.id,
            message: `Hash mismatch: expected ${current.hash}, got ${next.prev_hash}`
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        totalEvents: events.length
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: `Erro ao verificar integridade: ${error.message}` }],
        totalEvents: 0
      };
    }
  }

  /**
   * Obtém regras do CLANN (para RulesEngine)
   * @returns {Array} Lista de regras
   */
  getWebRules() {
    return this._getWebRules();
  }

  /**
   * Salva regras do CLANN (para RulesEngine)
   * @param {Array} rules - Lista de regras
   */
  saveWebRules(rules) {
    this._saveWebRules(rules);
  }

  getWebCouncils() {
    return this._getWebCouncil();
  }

  saveWebCouncils(councils) {
    this._saveWebCouncil(councils);
  }

  getWebMembers() {
    return this._getWebMembers();
  }

  saveWebMembers(members) {
    this._saveWebMembers(members);
  }

  getWebClans() {
    return this._getWebClans();
  }

  saveWebClans(clans) {
    this._saveWebClans(clans);
  }

  /**
   * Obtém o role do usuário em um CLANN específico
   * @param {number} clanId - ID do CLANN
   * @param {string} totemId - ID do Totem
   * @returns {Promise<string|null>} Role do usuário ou null se não for membro
   */
  async getUserRole(clanId, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const members = this._getWebMembers();
      const member = members.find(
        m => m.clan_id === parseInt(clanId) && m.totem_id === totemId
      );
      return Promise.resolve(member ? member.role : null);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT role FROM clan_members WHERE clan_id = ? AND totem_id = ?;`,
          [clanId, totemId],
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(rows.item(0).role);
            } else {
              resolve(null);
            }
          },
          (_, err) => reject(err)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // DOSE 2: Métodos para entrada via clannId (Gateway)
  // ---------------------------------------------------------

  /**
   * Busca todos os CLANNs (para verificar se já existe um com clannId externo)
   * @returns {Promise<Array>} Lista de todos os CLANNs
   */
  getAllClans() {
    if (Platform.OS === 'web' || !this.db) {
      const clans = this._getWebClans();
      return Promise.resolve(clans);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM clans ORDER BY created_at DESC;`,
          [],
          (_, { rows }) => resolve(rows._array),
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Adiciona um membro a um CLANN
   * @param {number|string} clanId - ID do CLANN
   * @param {string} totemId - ID do Totem
   * @param {string} role - Papel do membro ('member', 'admin', 'founder')
   * @returns {Promise<boolean>}
   */
  addMember(clanId, totemId, role = 'member') {
    if (Platform.OS === 'web' || !this.db) {
      const members = this._getWebMembers();
      
      // Verifica se já é membro
      const alreadyMember = members.some(
        m => m.clan_id === parseInt(clanId) && m.totem_id === totemId
      );
      
      if (alreadyMember) {
        return Promise.resolve(true);
      }

      // Adiciona como membro
      members.push({
        id: Date.now(),
        clan_id: parseInt(clanId),
        totem_id: totemId,
        role: role,
        joined_at: new Date().toISOString()
      });
      this._saveWebMembers(members);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Verifica se já é membro
        tx.executeSql(
          `SELECT * FROM clan_members WHERE clan_id = ? AND totem_id = ?;`,
          [clanId, totemId],
          (_, { rows }) => {
            if (rows.length > 0) {
              // Já é membro
              resolve(true);
            } else {
              // Adiciona como membro
              tx.executeSql(
                `INSERT INTO clan_members (clan_id, totem_id, role, joined_at)
                 VALUES (?, ?, ?, datetime('now'));`,
                [clanId, totemId, role],
                () => resolve(true),
                (_, err) => reject(err)
              );
            }
          },
          (_, err) => reject(err)
        );
      });
    });
  }

  /**
   * Cria um CLANN a partir de um convite (sem fundador específico)
   * @param {Object} clanData - Dados do CLANN { name, description, icon, privacy, external_clann_id }
   * @param {string} totemId - ID do Totem que está entrando
   * @returns {Promise<Object>} CLANN criado
   */
  createClanForInvite(clanData, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      const invite = this._generateInviteCode();
      const clanId = Date.now();
      const now = new Date().toISOString();
      
      const newClan = {
        id: clanId,
        name: clanData.name,
        icon: clanData.icon || '🏛️',
        description: clanData.description || '',
        invite_code: invite,
        privacy: clanData.privacy || 'public',
        created_at: now,
        founder_totem: null, // Sem fundador específico (entrada via convite)
        external_clann_id: clanData.external_clann_id // Armazena o clannId do Gateway
      };

      // Salva o CLANN
      const clans = this._getWebClans();
      clans.push(newClan);
      this._saveWebClans(clans);

      // Adiciona o primeiro membro
      const members = this._getWebMembers();
      members.push({
        id: Date.now() + 1,
        clan_id: clanId,
        totem_id: totemId,
        role: 'member',
        joined_at: now
      });
      this._saveWebMembers(members);

      return Promise.resolve({
        id: clanId,
        name: newClan.name,
        icon: newClan.icon,
        description: newClan.description,
        invite_code: invite,
        privacy: newClan.privacy,
        external_clann_id: newClan.external_clann_id,
        members: 1,
        role: 'member'
      });
    }

    const invite = this._generateInviteCode();

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO clans (name, icon, description, invite_code, privacy, created_at, founder_totem)
           VALUES (?, ?, ?, ?, ?, datetime('now'), NULL);`,
          [
            clanData.name,
            clanData.icon || '🏛️',
            clanData.description || null,
            invite,
            clanData.privacy || 'public'
          ],
          (_, result) => {
            const clanId = result.insertId;

            // Adiciona o primeiro membro
            tx.executeSql(
              `INSERT INTO clan_members (clan_id, totem_id, role, joined_at)
               VALUES (?, ?, 'member', datetime('now'));`,
              [clanId, totemId],
              () => {
                // Tenta adicionar external_clann_id se a coluna existir
                // (migração futura pode adicionar essa coluna)
                tx.executeSql(
                  `UPDATE clans SET external_clann_id = ? WHERE id = ?;`,
                  [clanData.external_clann_id, clanId],
                  () => {},
                  () => {} // Ignora erro se coluna não existir
                );

                resolve({
                  id: clanId,
                  name: clanData.name,
                  icon: clanData.icon || '🏛️',
                  description: clanData.description || '',
                  invite_code: invite,
                  privacy: clanData.privacy || 'public',
                  external_clann_id: clanData.external_clann_id,
                  members: 1,
                  role: 'member'
                });
              },
              (_, err) => reject(err)
            );
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Utilitário interno
  // ---------------------------------------------------------
  _generateInviteCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}

export default new ClanStorage();
