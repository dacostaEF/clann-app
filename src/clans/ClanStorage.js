import { Platform } from 'react-native';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null; // Não será usado no web
} else {
  SQLite = require('expo-sqlite');
}

// Chaves para localStorage na Web
const WEB_CLANS_KEY = 'clann_clans';
const WEB_CLAN_MEMBERS_KEY = 'clann_clan_members';
const WEB_MESSAGES_KEY = 'clann_messages';
const WEB_LINKED_DEVICES_KEY = 'clann_linked_devices';
const WEB_SECURITY_LOG_KEY = 'clann_security_log';
const WEB_CLAN_RULES_KEY = 'clann_clan_rules';
const WEB_CLAN_COUNCIL_KEY = 'clann_clan_council';
const WEB_PENDING_APPROVALS_KEY = 'clann_pending_approvals';

class ClanStorage {
  constructor() {
    if (Platform.OS !== 'web' && SQLite) {
      this.db = SQLite.openDatabase('clans.db');
    } else {
      this.db = null; // No web, não há banco
    }
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
    if (Platform.OS === 'web' || !this.db) {
      // No web, não há banco de dados
      return Promise.resolve(true);
    }
    
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {

        // Tabela principal de CLANNs
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            description TEXT,
            invite_code TEXT UNIQUE NOT NULL,
            privacy TEXT DEFAULT 'public',
            created_at TEXT NOT NULL,
            founder_totem TEXT NOT NULL
          );`
        );

        // Membros do CLANN
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clan_id INTEGER NOT NULL,
            totem_id TEXT NOT NULL,
            role TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            FOREIGN KEY (clan_id) REFERENCES clans(id)
          );`
        );

        // Atividade do CLANN (para futuros chats e logs)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clan_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            payload TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (clan_id) REFERENCES clans(id)
          );`
        );

        // Mensagens do CLANN (Sprint 4 + Sprint 6)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_messages (
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
          );`
        );

        // Adicionar colunas se não existirem (migration para Sprint 6)
        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN self_destruct_at INTEGER;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );
        
        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN burn_after_read INTEGER DEFAULT 0;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Adicionar coluna reactions (Sprint 6 - ETAPA 3)
        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN reactions TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Adicionar colunas de status de entrega (Sprint 6 - ETAPA 4)
        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN delivered_to TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN read_by TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Adicionar colunas de edição/exclusão (Sprint 6 - ETAPA 5)
        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN edited INTEGER DEFAULT 0;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN deleted INTEGER DEFAULT 0;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN original_content TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        tx.executeSql(
          `ALTER TABLE clan_messages ADD COLUMN edited_at INTEGER;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Índice para performance nas queries de mensagens
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_messages_clan_id ON clan_messages(clan_id);`
        );

        // Tabela de dispositivos vinculados (Sprint 7 - ETAPA 1)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS linked_devices (
            device_id TEXT PRIMARY KEY,
            totem_id TEXT NOT NULL,
            public_key TEXT NOT NULL,
            linked_at INTEGER NOT NULL
          );`
        );

        // Índice para performance nas queries de dispositivos
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_linked_devices_totem_id ON linked_devices(totem_id);`
        );

        // Tabela de log de segurança com hash-chain (Sprint 7 - ETAPA 3)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS security_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            actor_totem TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            prev_hash TEXT,
            hash TEXT NOT NULL,
            details TEXT
          );`
        );

        // Índice para performance nas queries de log
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_security_log_timestamp ON security_log(timestamp DESC);`
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_security_log_actor ON security_log(actor_totem);`
        );

        // Tabela de regras do CLANN (Sprint 7 - Governança - ETAPA 1)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_rules (
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
          );`
        );

        // Adicionar colunas de categoria e template (ETAPA 2 - Migration)
        tx.executeSql(
          `ALTER TABLE clan_rules ADD COLUMN category TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );
        tx.executeSql(
          `ALTER TABLE clan_rules ADD COLUMN template_id TEXT;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Tabela de templates de regras (Sprint 7 - Governança - ETAPA 2)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS rule_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            text TEXT NOT NULL,
            category TEXT,
            description TEXT,
            created_at INTEGER NOT NULL
          );`
        );

        // Tabela de histórico de versões das regras (Sprint 7 - Governança - ETAPA 2)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS rule_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            text TEXT NOT NULL,
            changed_by TEXT,
            changed_at INTEGER NOT NULL,
            change_type TEXT,
            FOREIGN KEY (rule_id) REFERENCES clan_rules(rule_id)
          );`
        );

        // Índices para performance
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);`
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_clan_rules_category ON clan_rules(category);`
        );

        // Tabela de conselho de anciões (Sprint 7 - Governança - ETAPA 1)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clan_council (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clan_id INTEGER NOT NULL UNIQUE,
            founder_totem TEXT NOT NULL,
            elders TEXT,
            approvals_required INTEGER DEFAULT 2,
            FOREIGN KEY (clan_id) REFERENCES clans(id)
          );`
        );

        // Tabela de aprovações pendentes (Sprint 7 - Governança - ETAPA 4)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS pending_approvals (
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
          );`
        );

        // Adiciona colunas de execução se não existirem (migração)
        tx.executeSql(
          `ALTER TABLE pending_approvals ADD COLUMN executed INTEGER DEFAULT 0;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );
        tx.executeSql(
          `ALTER TABLE pending_approvals ADD COLUMN executed_at INTEGER;`,
          [],
          () => {},
          () => {} // Ignora erro se coluna já existe
        );

        // Índices para performance
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_clan_rules_clan_id ON clan_rules(clan_id);`
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_pending_approvals_clan_id ON pending_approvals(clan_id);`
        );

      },
      (error) => reject(error),
      () => resolve(true));
    });
  }

  // ---------------------------------------------------------
  // Criar CLANN
  // ---------------------------------------------------------
  createClan(data, totemId) {
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
        founder_totem: totemId
      };

      // Salva o CLANN
      const clans = this._getWebClans();
      clans.push(newClan);
      this._saveWebClans(clans);

      // Salva o membro (fundador)
      const members = this._getWebMembers();
      members.push({
        id: Date.now() + 1,
        clan_id: clanId,
        totem_id: totemId,
        role: 'founder',
        joined_at: now
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

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO clans (name, icon, description, invite_code, privacy, created_at, founder_totem)
           VALUES (?, ?, ?, ?, ?, datetime('now'), ?);`,
          [data.name, data.icon, data.description || null, invite, data.privacy || 'public', totemId],
          (_, result) => {
            const clanId = result.insertId;

            // Inserir o fundador como membro
            tx.executeSql(
              `INSERT INTO clan_members (clan_id, totem_id, role, joined_at)
               VALUES (?, ?, 'founder', datetime('now'));`,
              [clanId, totemId]
            );

            resolve({
              id: clanId,
              name: data.name,
              icon: data.icon,
              description: data.description,
              invite_code: invite
            });
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ---------------------------------------------------------
  // Entrar no CLANN via invite code
  // ---------------------------------------------------------
  joinClan(inviteCode, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const clans = this._getWebClans();
      const clan = clans.find(c => c.invite_code === inviteCode.toUpperCase());
      
      if (!clan) {
        return Promise.reject(new Error('Código de convite inválido'));
      }

      // Verifica se já é membro
      const members = this._getWebMembers();
      const alreadyMember = members.some(
        m => m.clan_id === clan.id && m.totem_id === totemId
      );

      if (alreadyMember) {
        return Promise.reject(new Error('Você já é membro deste CLANN'));
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

      return Promise.resolve(clan);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {

        tx.executeSql(
          `SELECT * FROM clans WHERE invite_code = ? LIMIT 1;`,
          [inviteCode],
          (_, { rows }) => {
            if (rows.length === 0) {
              reject(new Error("Código de convite inválido"));
              return;
            }

            const clan = rows.item(0);

            tx.executeSql(
              `INSERT INTO clan_members (clan_id, totem_id, role, joined_at)
               VALUES (?, ?, 'member', datetime('now'));`,
              [clan.id, totemId],
              () => resolve(clan),
              (_, err) => reject(err)
            );
          }
        );

      });
    });
  }

  // ---------------------------------------------------------
  // Sair do CLANN
  // ---------------------------------------------------------
  leaveClan(clanId, totemId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const members = this._getWebMembers();
      const filtered = members.filter(
        m => !(m.clan_id === parseInt(clanId) && m.totem_id === totemId)
      );
      this._saveWebMembers(filtered);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM clan_members WHERE clan_id = ? AND totem_id = ?;`,
          [clanId, totemId],
          () => resolve(true),
          (_, err) => reject(err)
        );
      });
    });
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
  getUserClans(totemId) {
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

      return Promise.resolve(userClans);
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {

        tx.executeSql(
          `
          SELECT c.*, m.role,
            (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) AS members
          FROM clans c
          JOIN clan_members m ON m.clan_id = c.id
          WHERE m.totem_id = ?
          ORDER BY c.created_at DESC;
          `,
          [totemId],
          (_, { rows }) => resolve(rows._array),
          (_, err) => reject(err)
        );

      });
    });
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
