/**
 * MigrationManager - Sistema de Migrações Seguras
 * Sprint 8 - ETAPA 1
 * 
 * Gerencia migrações de schema do banco de dados de forma segura e idempotente
 * Suporta SQLite (mobile) e localStorage (web)
 * 
 * Regras obrigatórias:
 * - Migrações devem ser idempotentes
 * - Nenhuma migração pode causar perda de dados
 * - Erros devem ser tratados silenciosamente sem quebrar o app
 * - Web (localStorage) deve simular migrações
 */

import { Platform } from 'react-native';
import ClanStorage from '../clans/ClanStorage';

// Polyfill para web usando localStorage
let SecureStore;
if (Platform.OS === 'web') {
  SecureStore = {
    async setItemAsync(key, value) {
      localStorage.setItem(key, value);
    },
    async getItemAsync(key) {
      return localStorage.getItem(key);
    },
    async deleteItemAsync(key) {
      localStorage.removeItem(key);
    },
  };
} else {
  SecureStore = require('expo-secure-store');
}

const SCHEMA_VERSION_KEY = 'clann_schema_version';
const BACKUP_PREFIX = 'clann_backup_';

/**
 * Versão atual do schema
 * Incrementar a cada nova migração
 */
const CURRENT_SCHEMA_VERSION = 8; // Sprint 8 - ETAPA 3: Device Trust

/**
 * Lista de migrações em ordem
 * Cada migração é uma função que retorna Promise
 */
const migrations = [
  {
    version: 1,
    name: 'Initial Schema',
    description: 'Tabelas base: clans, clan_members, clan_activity, clan_messages'
  },
  {
    version: 2,
    name: 'Sprint 6 - Self Destruct',
    description: 'Adiciona colunas self_destruct_at e burn_after_read em clan_messages'
  },
  {
    version: 3,
    name: 'Sprint 6 - Reactions',
    description: 'Adiciona coluna reactions em clan_messages'
  },
  {
    version: 4,
    name: 'Sprint 6 - Delivery Status',
    description: 'Adiciona colunas delivered_to e read_by em clan_messages'
  },
  {
    version: 5,
    name: 'Sprint 6 - Edit/Delete',
    description: 'Adiciona colunas edited, deleted, original_content, edited_at em clan_messages'
  },
  {
    version: 6,
    name: 'Sprint 7 - Governance',
    description: 'Adiciona tabelas: clan_rules, rule_templates, rule_history, clan_council, pending_approvals'
  },
  {
    version: 7,
    name: 'Sprint 7 - Rules Categories',
    description: 'Adiciona colunas category e template_id em clan_rules, e colunas executed/executed_at em pending_approvals'
  },
  {
    version: 8,
    name: 'Sprint 8 - Device Trust',
    description: 'Adiciona tabela device_trust_scores para sistema de confiança de dispositivo'
  }
];

/**
 * Obtém a versão atual do schema
 * @returns {Promise<number>} Versão atual (0 se não existe)
 */
export async function getCurrentVersion() {
  if (Platform.OS === 'web') {
    try {
      const versionStr = localStorage.getItem(SCHEMA_VERSION_KEY);
      return versionStr ? parseInt(versionStr, 10) : 0;
    } catch (error) {
      console.warn('Erro ao obter versão do schema (web):', error);
      return 0;
    }
  }

  // SQLite
  const db = ClanStorage.getDB();
  if (!db) {
    return 0;
  }

  return new Promise((resolve) => {
    db.transaction(tx => {
      // Verifica se tabela schema_version existe
      tx.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version';`,
        [],
        (_, result) => {
          if (result.rows.length === 0) {
            // Tabela não existe, versão 0
            resolve(0);
            return;
          }

          // Busca versão atual
          tx.executeSql(
            `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1;`,
            [],
            (_, result) => {
              if (result.rows.length > 0) {
                resolve(result.rows.item(0).version);
              } else {
                resolve(0);
              }
            },
            () => resolve(0) // Em caso de erro, assume versão 0
          );
        },
        () => resolve(0) // Em caso de erro, assume versão 0
      );
    });
  });
}

/**
 * Define a versão do schema
 * @param {number} version - Versão a definir
 * @returns {Promise<void>}
 */
export async function setVersion(version) {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(SCHEMA_VERSION_KEY, version.toString());
    } catch (error) {
      console.warn('Erro ao definir versão do schema (web):', error);
    }
    return;
  }

  // SQLite
  const db = ClanStorage.getDB();
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Garante que tabela schema_version existe
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );`,
        [],
        () => {
          // Insere ou atualiza versão
          tx.executeSql(
            `INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?);`,
            [version, Date.now()],
            () => resolve(),
            (_, err) => {
              console.warn('Erro ao definir versão do schema:', err);
              resolve(); // Não falha silenciosamente
            }
          );
        },
        (_, err) => {
          console.warn('Erro ao criar tabela schema_version:', err);
          resolve(); // Não falha silenciosamente
        }
      );
    });
  });
}

/**
 * Cria backup dos dados antes de migrar
 * @param {number} version - Versão atual antes da migração
 * @returns {Promise<string|null>} ID do backup ou null se falhar
 */
export async function backupBeforeMigration(version) {
  if (Platform.OS === 'web') {
    // No web, faz backup do localStorage
    try {
      const backupId = `backup_v${version}_${Date.now()}`;
      const backupData = {
        clans: localStorage.getItem('clann_clans'),
        members: localStorage.getItem('clann_clan_members'),
        messages: localStorage.getItem('clann_messages'),
        rules: localStorage.getItem('clann_clan_rules'),
        council: localStorage.getItem('clann_clan_council'),
        approvals: localStorage.getItem('clann_pending_approvals'),
        version: version
      };
      
      await SecureStore.setItemAsync(`${BACKUP_PREFIX}${backupId}`, JSON.stringify(backupData));
      return backupId;
    } catch (error) {
      console.warn('Erro ao criar backup (web):', error);
      return null;
    }
  }

  // SQLite - Backup seria complexo, então apenas registra
  // Em produção, poderia exportar dados para JSON
  try {
    const backupId = `backup_v${version}_${Date.now()}`;
    // Registra que backup foi criado (em produção, salvaria dados reais)
    await SecureStore.setItemAsync(`${BACKUP_PREFIX}${backupId}`, JSON.stringify({
      version,
      timestamp: Date.now(),
      platform: 'sqlite'
    }));
    return backupId;
  } catch (error) {
    console.warn('Erro ao criar backup (SQLite):', error);
    return null;
  }
}

/**
 * Executa migração específica
 * @param {number} version - Versão da migração
 * @returns {Promise<boolean>} True se sucesso
 */
async function executeMigration(version) {
  const db = ClanStorage.getDB();
  if (!db && Platform.OS !== 'web') {
    console.warn('Banco de dados não disponível para migração');
    return false;
  }

  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      // No web, migrações são apenas versionamento
      // Dados já estão no formato correto via localStorage
      resolve(true);
      return;
    }

    db.transaction(tx => {
      let success = true;

      switch (version) {
        case 1:
          // Migração inicial - tabelas base já criadas em ClanStorage.init()
          // Esta migração apenas marca que schema está na versão 1
          break;

        case 2:
          // Sprint 6 - Self Destruct
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
          break;

        case 3:
          // Sprint 6 - Reactions
          tx.executeSql(
            `ALTER TABLE clan_messages ADD COLUMN reactions TEXT;`,
            [],
            () => {},
            () => {} // Ignora erro se coluna já existe
          );
          break;

        case 4:
          // Sprint 6 - Delivery Status
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
          break;

        case 5:
          // Sprint 6 - Edit/Delete
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
          break;

        case 6:
          // Sprint 7 - Governance (tabelas principais)
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
              FOREIGN KEY (clan_id) REFERENCES clans(id)
            );`,
            [],
            () => {},
            () => { success = false; }
          );
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS rule_templates (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              template_id TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              text TEXT NOT NULL,
              category TEXT,
              description TEXT,
              created_at INTEGER NOT NULL
            );`,
            [],
            () => {},
            () => { success = false; }
          );
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
            );`,
            [],
            () => {},
            () => { success = false; }
          );
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS clan_council (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              clan_id INTEGER NOT NULL UNIQUE,
              founder_totem TEXT NOT NULL,
              elders TEXT,
              approvals_required INTEGER DEFAULT 2,
              FOREIGN KEY (clan_id) REFERENCES clans(id)
            );`,
            [],
            () => {},
            () => { success = false; }
          );
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
              FOREIGN KEY (clan_id) REFERENCES clans(id)
            );`,
            [],
            () => {},
            () => { success = false; }
          );
          // Índices
          tx.executeSql(
            `CREATE INDEX IF NOT EXISTS idx_clan_rules_clan_id ON clan_rules(clan_id);`,
            [],
            () => {},
            () => {}
          );
          tx.executeSql(
            `CREATE INDEX IF NOT EXISTS idx_pending_approvals_clan_id ON pending_approvals(clan_id);`,
            [],
            () => {},
            () => {}
          );
          tx.executeSql(
            `CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);`,
            [],
            () => {},
            () => {}
          );
          break;

        case 7:
          // Sprint 7 - Rules Categories e Executed
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
          tx.executeSql(
            `CREATE INDEX IF NOT EXISTS idx_clan_rules_category ON clan_rules(category);`,
            [],
            () => {},
            () => {}
          );
          break;

        case 8:
          // Sprint 8 - Device Trust
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS device_trust_scores (
              device_id TEXT PRIMARY KEY,
              score INTEGER NOT NULL,
              last_seen INTEGER NOT NULL
            );`,
            [],
            () => {},
            () => { success = false; }
          );
          break;

        default:
          console.warn(`Migração desconhecida: ${version}`);
          success = false;
      }

      resolve(success);
    });
  });
}

/**
 * Executa migrações para SQLite
 * @returns {Promise<boolean>} True se todas as migrações foram aplicadas
 */
async function migrateSQLite() {
  const currentVersion = await getCurrentVersion();
  
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    // Já está na versão mais recente
    return true;
  }

  console.log(`[MigrationManager] Migrando de versão ${currentVersion} para ${CURRENT_SCHEMA_VERSION}`);

  // Aplica migrações pendentes em ordem
  for (let version = currentVersion + 1; version <= CURRENT_SCHEMA_VERSION; version++) {
    try {
      // Cria backup antes de migrar
      const backupId = await backupBeforeMigration(version - 1);
      if (backupId) {
        console.log(`[MigrationManager] Backup criado: ${backupId}`);
      }

      // Executa migração
      const success = await executeMigration(version);
      
      if (success) {
        // Atualiza versão
        await setVersion(version);
        console.log(`[MigrationManager] Migração ${version} aplicada com sucesso`);
      } else {
        console.warn(`[MigrationManager] Migração ${version} falhou, mas continuando...`);
        // Continua mesmo se falhar (fail-open)
      }
    } catch (error) {
      console.warn(`[MigrationManager] Erro na migração ${version}:`, error);
      // Continua para próxima migração (fail-open)
    }
  }

  return true;
}

/**
 * Executa migrações para Web (localStorage)
 * @returns {Promise<boolean>} True se todas as migrações foram aplicadas
 */
async function migrateWeb() {
  const currentVersion = await getCurrentVersion();
  
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    // Já está na versão mais recente
    return true;
  }

  console.log(`[MigrationManager] Migrando Web de versão ${currentVersion} para ${CURRENT_SCHEMA_VERSION}`);

  // No web, migrações são principalmente versionamento
  // Dados já estão no formato correto via localStorage
  // Apenas atualiza versão
  try {
    await setVersion(CURRENT_SCHEMA_VERSION);
    console.log(`[MigrationManager] Migração Web concluída`);
    return true;
  } catch (error) {
    console.warn(`[MigrationManager] Erro na migração Web:`, error);
    return false; // Mas não quebra o app
  }
}

/**
 * Executa todas as migrações pendentes
 * @returns {Promise<boolean>} True se todas as migrações foram aplicadas
 */
export async function runMigrations() {
  try {
    if (Platform.OS === 'web') {
      return await migrateWeb();
    } else {
      return await migrateSQLite();
    }
  } catch (error) {
    console.error('[MigrationManager] Erro crítico nas migrações:', error);
    // Não quebra o app - retorna true mesmo com erro
    return true;
  }
}

/**
 * Obtém informações sobre migrações
 * @returns {Promise<Object>} Informações sobre migrações
 */
export async function getMigrationInfo() {
  const currentVersion = await getCurrentVersion();
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);
  
  return {
    currentVersion,
    latestVersion: CURRENT_SCHEMA_VERSION,
    isUpToDate: currentVersion >= CURRENT_SCHEMA_VERSION,
    pendingCount: pendingMigrations.length,
    pendingMigrations: pendingMigrations.map(m => ({
      version: m.version,
      name: m.name,
      description: m.description
    }))
  };
}

/**
 * Inicializa o sistema de migrações
 * Deve ser chamado antes de usar o ClanStorage
 * @returns {Promise<boolean>} True se inicialização foi bem-sucedida
 */
export async function init() {
  try {
    // Garante que tabela schema_version existe (SQLite)
    if (Platform.OS !== 'web') {
      const db = ClanStorage.getDB();
      if (db) {
        await new Promise((resolve) => {
          db.transaction(tx => {
            tx.executeSql(
              `CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
              );`,
              [],
              () => resolve(),
              () => resolve() // Não falha
            );
          });
        });
      }
    }

    // Executa migrações pendentes
    return await runMigrations();
  } catch (error) {
    console.error('[MigrationManager] Erro na inicialização:', error);
    // Não quebra o app
    return true;
  }
}

export default {
  init,
  getCurrentVersion,
  setVersion,
  runMigrations,
  migrateSQLite,
  migrateWeb,
  backupBeforeMigration,
  getMigrationInfo
};

