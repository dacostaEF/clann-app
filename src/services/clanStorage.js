/**
 * Serviço de armazenamento de CLANNs usando SQLite
 * Gerencia persistência de CLANNs e membros
 * 
 * NÃO implementa níveis, reputação, tribunal ou votação.
 */

import { Platform } from 'react-native';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null;
} else {
  SQLite = require('expo-sqlite');
}

let db = null;
let initialized = false;

/**
 * Inicializa o banco de dados SQLite
 * @returns {Promise<void>}
 */
export async function init() {
  if (Platform.OS === 'web') {
    // No web, não há banco de dados
    initialized = true;
    return;
  }
  
  if (initialized && db) {
    return;
  }

  try {
    if (!SQLite) {
      throw new Error('SQLite não disponível no web');
    }
    db = await SQLite.openDatabaseAsync('clann.db');
    
    // Cria tabela de CLANNs
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS clans (
        clanId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        inviteCode TEXT UNIQUE NOT NULL,
        creatorTotemId TEXT NOT NULL,
        maxMembers INTEGER NOT NULL DEFAULT 10,
        isPrivate INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    // Cria tabela de membros
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS clan_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clanId TEXT NOT NULL,
        totemId TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joinedAt INTEGER NOT NULL,
        UNIQUE(clanId, totemId),
        FOREIGN KEY (clanId) REFERENCES clans(clanId) ON DELETE CASCADE
      );
    `);

    // Cria índices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_clans_inviteCode ON clans(inviteCode);
      CREATE INDEX IF NOT EXISTS idx_clans_creatorTotemId ON clans(creatorTotemId);
      CREATE INDEX IF NOT EXISTS idx_members_clanId ON clan_members(clanId);
      CREATE INDEX IF NOT EXISTS idx_members_totemId ON clan_members(totemId);
    `);

    initialized = true;
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    throw new Error(`Erro ao inicializar banco de dados: ${error.message}`);
  }
}

/**
 * Salva um CLANN no banco de dados
 * @param {Object} clan - Objeto CLANN
 * @returns {Promise<void>}
 */
export async function saveClan(clan) {
  if (Platform.OS === 'web') {
    return; // No web, não salva
  }
  
  if (!initialized) {
    await init();
  }

  try {
    // Salva CLANN
    await db.runAsync(
      `INSERT OR REPLACE INTO clans (clanId, name, description, inviteCode, creatorTotemId, maxMembers, isPrivate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clan.clanId,
        clan.name,
        clan.description || '',
        clan.inviteCode,
        clan.creatorTotemId,
        clan.maxMembers,
        clan.isPrivate ? 1 : 0,
        clan.createdAt,
        clan.updatedAt,
      ]
    );

    // Salva membros
    if (clan.members && clan.members.length > 0) {
      // Remove membros antigos
      await db.runAsync('DELETE FROM clan_members WHERE clanId = ?', [clan.clanId]);

      // Insere novos membros
      for (const member of clan.members) {
        await db.runAsync(
          `INSERT INTO clan_members (clanId, totemId, role, joinedAt)
           VALUES (?, ?, ?, ?)`,
          [clan.clanId, member.totemId, member.role || 'member', member.joinedAt || Date.now()]
        );
      }
    }
  } catch (error) {
    console.error('Erro ao salvar CLANN:', error);
    throw new Error(`Erro ao salvar CLANN: ${error.message}`);
  }
}

/**
 * Busca CLANNs do usuário
 * @param {string} totemId - ID do Totem do usuário
 * @returns {Promise<Array>} Lista de CLANNs
 */
export async function getMyClans(totemId) {
  if (Platform.OS === 'web') {
    return []; // No web, retorna vazio
  }
  
  if (!initialized) {
    await init();
  }

  if (!totemId) {
    return [];
  }

  try {
    // Busca CLANNs onde o usuário é membro
    const result = await db.getAllAsync(
      `SELECT DISTINCT c.*, 
              COUNT(cm.totemId) as memberCount
       FROM clans c
       INNER JOIN clan_members cm ON c.clanId = cm.clanId
       WHERE cm.totemId = ?
       GROUP BY c.clanId
       ORDER BY c.updatedAt DESC`,
      [totemId]
    );

    // Busca membros de cada CLANN
    const clans = [];
    for (const row of result) {
      const members = await db.getAllAsync(
        'SELECT * FROM clan_members WHERE clanId = ? ORDER BY joinedAt ASC',
        [row.clanId]
      );

      clans.push({
        clanId: row.clanId,
        name: row.name,
        description: row.description,
        inviteCode: row.inviteCode,
        creatorTotemId: row.creatorTotemId,
        maxMembers: row.maxMembers,
        isPrivate: row.isPrivate === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        memberCount: row.memberCount || members.length,
        members: members.map((m) => ({
          totemId: m.totemId,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    }

    return clans;
  } catch (error) {
    console.error('Erro ao buscar CLANNs:', error);
    return [];
  }
}

/**
 * Busca CLANN por código de convite
 * @param {string} code - Código de convite
 * @returns {Promise<Object|null>} CLANN encontrado ou null
 */
export async function getClanByInviteCode(code) {
  if (Platform.OS === 'web') {
    return null; // No web, retorna null
  }
  
  if (!initialized) {
    await init();
  }

  if (!code) {
    return null;
  }

  try {
    const result = await db.getFirstAsync(
      'SELECT * FROM clans WHERE inviteCode = ?',
      [code.toUpperCase()]
    );

    if (!result) {
      return null;
    }

    // Busca membros
    const members = await db.getAllAsync(
      'SELECT * FROM clan_members WHERE clanId = ? ORDER BY joinedAt ASC',
      [result.clanId]
    );

    return {
      clanId: result.clanId,
      name: result.name,
      description: result.description,
      inviteCode: result.inviteCode,
      creatorTotemId: result.creatorTotemId,
      maxMembers: result.maxMembers,
      isPrivate: result.isPrivate === 1,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: members.length,
      members: members.map((m) => ({
        totemId: m.totemId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  } catch (error) {
    console.error('Erro ao buscar CLANN por código:', error);
    return null;
  }
}

/**
 * Adiciona um membro a um CLANN
 * @param {string} clanId - ID do CLANN
 * @param {string} totemId - ID do Totem do membro
 * @param {string} role - Papel do membro (default: 'member')
 * @returns {Promise<void>}
 */
export async function addMember(clanId, totemId, role = 'member') {
  if (Platform.OS === 'web') {
    return; // No web, não adiciona
  }
  
  if (!initialized) {
    await init();
  }

  try {
    // Verifica se já é membro
    const existing = await db.getFirstAsync(
      'SELECT * FROM clan_members WHERE clanId = ? AND totemId = ?',
      [clanId, totemId]
    );

    if (existing) {
      throw new Error('Usuário já é membro deste CLANN');
    }

    // Adiciona membro
    await db.runAsync(
      `INSERT INTO clan_members (clanId, totemId, role, joinedAt)
       VALUES (?, ?, ?, ?)`,
      [clanId, totemId, role, Date.now()]
    );

    // Atualiza updatedAt do CLANN
    await db.runAsync(
      'UPDATE clans SET updatedAt = ? WHERE clanId = ?',
      [Date.now(), clanId]
    );
  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    throw new Error(`Erro ao adicionar membro: ${error.message}`);
  }
}

/**
 * Remove um membro de um CLANN
 * @param {string} clanId - ID do CLANN
 * @param {string} totemId - ID do Totem do membro
 * @returns {Promise<void>}
 */
export async function removeMember(clanId, totemId) {
  if (Platform.OS === 'web') {
    return; // No web, não remove
  }
  
  if (!initialized) {
    await init();
  }

  try {
    await db.runAsync(
      'DELETE FROM clan_members WHERE clanId = ? AND totemId = ?',
      [clanId, totemId]
    );

    // Atualiza updatedAt do CLANN
    await db.runAsync(
      'UPDATE clans SET updatedAt = ? WHERE clanId = ?',
      [Date.now(), clanId]
    );
  } catch (error) {
    console.error('Erro ao remover membro:', error);
    throw new Error(`Erro ao remover membro: ${error.message}`);
  }
}

/**
 * Busca um CLANN por ID
 * @param {string} clanId - ID do CLANN
 * @returns {Promise<Object|null>} CLANN encontrado ou null
 */
export async function getClanById(clanId) {
  if (Platform.OS === 'web') {
    return null; // No web, retorna null
  }
  
  if (!initialized) {
    await init();
  }

  if (!clanId) {
    return null;
  }

  try {
    const result = await db.getFirstAsync(
      'SELECT * FROM clans WHERE clanId = ?',
      [clanId]
    );

    if (!result) {
      return null;
    }

    // Busca membros
    const members = await db.getAllAsync(
      'SELECT * FROM clan_members WHERE clanId = ? ORDER BY joinedAt ASC',
      [clanId]
    );

    return {
      clanId: result.clanId,
      name: result.name,
      description: result.description,
      inviteCode: result.inviteCode,
      creatorTotemId: result.creatorTotemId,
      maxMembers: result.maxMembers,
      isPrivate: result.isPrivate === 1,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: members.length,
      members: members.map((m) => ({
        totemId: m.totemId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  } catch (error) {
    console.error('Erro ao buscar CLANN por ID:', error);
    return null;
  }
}

