/**
 * CouncilManager - Sistema de Conselho de Anciões
 * Sprint 7 - Governança - ETAPA 4
 * 
 * Gerencia o conselho de anciões do CLANN
 * Anciões são membros com poder de aprovação para decisões importantes
 */

import { Platform } from 'react-native';
import ClanStorage from './ClanStorage';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { createApprovalRequest, APPROVAL_ACTIONS } from './ApprovalEngine';

/**
 * Inicializa o conselho de anciões para um CLANN
 * @param {number} clanId - ID do CLANN
 * @param {string} founderTotem - Totem do fundador
 * @returns {Promise<Object>} Conselho criado
 */
export async function initCouncil(clanId, founderTotem) {
  const db = ClanStorage.getDB();
  const elders = [founderTotem]; // Fundador é automaticamente ancião

  if (Platform.OS === 'web' || !db) {
    // Na Web, salva no localStorage
    const councils = getWebCouncils();
    const existing = councils.find(c => c.clan_id === parseInt(clanId));
    
    if (existing) {
      return Promise.resolve({
        ...existing,
        elders: existing.elders ? JSON.parse(existing.elders) : []
      });
    }

    const newCouncil = {
      id: Date.now(),
      clan_id: parseInt(clanId),
      founder_totem: founderTotem,
      elders: JSON.stringify(elders),
      approvals_required: 2
    };
    councils.push(newCouncil);
    saveWebCouncils(councils);

    return Promise.resolve({
      ...newCouncil,
      elders
    });
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Verifica se já existe
      tx.executeSql(
        `SELECT * FROM clan_council WHERE clan_id = ?;`,
        [clanId],
        (_, { rows }) => {
          if (rows.length > 0) {
            const existing = rows.item(0);
            resolve({
              ...existing,
              elders: existing.elders ? JSON.parse(existing.elders) : []
            });
            return;
          }

          // Cria novo conselho
          tx.executeSql(
            `INSERT INTO clan_council (clan_id, founder_totem, elders, approvals_required)
             VALUES (?, ?, ?, ?);`,
            [clanId, founderTotem, JSON.stringify(elders), 2],
            (_, result) => {
              resolve({
                id: result.insertId,
                clan_id: clanId,
                founder_totem: founderTotem,
                elders: elders,
                approvals_required: 2
              });
            },
            (_, err) => reject(err)
          );
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém o conselho de anciões de um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Object|null>} Conselho ou null
 */
export async function getCouncil(clanId) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const councils = getWebCouncils();
    const council = councils.find(c => c.clan_id === parseInt(clanId));
    
    if (!council) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      ...council,
      elders: council.elders ? JSON.parse(council.elders) : []
    });
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM clan_council WHERE clan_id = ?;`,
        [clanId],
        (_, { rows }) => {
          if (rows.length > 0) {
            const council = rows.item(0);
            resolve({
              ...council,
              elders: council.elders ? JSON.parse(council.elders) : []
            });
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
 * Verifica se um Totem é ancião
 * @param {number} clanId - ID do CLANN
 * @param {string} totemId - ID do Totem
 * @returns {Promise<boolean>}
 */
export async function isElder(clanId, totemId) {
  const council = await getCouncil(clanId);
  if (!council) return false;
  
  return council.elders.includes(totemId);
}

/**
 * Adiciona um ancião ao conselho (requer aprovação)
 * @param {number} clanId - ID do CLANN
 * @param {string} newElderTotem - Totem do novo ancião
 * @param {string} requestedBy - Totem que solicitou
 * @param {boolean} requireApproval - Se true, cria solicitação de aprovação
 * @returns {Promise<Object>} Conselho atualizado ou solicitação criada
 */
export async function addElder(clanId, newElderTotem, requestedBy, requireApproval = true) {
  const council = await getCouncil(clanId);
  if (!council) {
    throw new Error('Conselho não encontrado. O CLANN precisa ter um conselho inicializado.');
  }

  // Verifica se já é ancião
  if (council.elders.includes(newElderTotem)) {
    throw new Error('Este membro já é ancião');
  }

  // Verifica se quem está solicitando é ancião ou fundador
  const isRequesterElder = council.elders.includes(requestedBy) || council.founder_totem === requestedBy;
  if (!isRequesterElder && requireApproval) {
    throw new Error('Apenas anciões podem adicionar novos anciões');
  }

  // Se requer aprovação e não é fundador, cria solicitação
  if (requireApproval && council.founder_totem !== requestedBy) {
    return await createApprovalRequest(
      clanId,
      APPROVAL_ACTIONS.COUNCIL_ELDER_ADD,
      { newElderTotem, requestedBy },
      requestedBy
    );
  }

  // Adiciona diretamente (fundador ou aprovação não necessária)
  const updatedElders = [...council.elders, newElderTotem];
  return await updateCouncilElders(clanId, updatedElders, requestedBy);
}

/**
 * Remove um ancião do conselho (requer aprovação)
 * @param {number} clanId - ID do CLANN
 * @param {string} elderTotem - Totem do ancião a remover
 * @param {string} requestedBy - Totem que solicitou
 * @param {boolean} requireApproval - Se true, cria solicitação de aprovação
 * @returns {Promise<Object>} Conselho atualizado ou solicitação criada
 */
export async function removeElder(clanId, elderTotem, requestedBy, requireApproval = true) {
  const council = await getCouncil(clanId);
  if (!council) {
    throw new Error('Conselho não encontrado');
  }

  // Não pode remover o fundador
  if (elderTotem === council.founder_totem) {
    throw new Error('O fundador não pode ser removido do conselho');
  }

  // Verifica se é ancião
  if (!council.elders.includes(elderTotem)) {
    throw new Error('Este membro não é ancião');
  }

  // Verifica se quem está solicitando é ancião ou fundador
  const isRequesterElder = council.elders.includes(requestedBy) || council.founder_totem === requestedBy;
  if (!isRequesterElder && requireApproval) {
    throw new Error('Apenas anciões podem remover anciões');
  }

  // Se requer aprovação e não é fundador, cria solicitação
  if (requireApproval && council.founder_totem !== requestedBy) {
    return await createApprovalRequest(
      clanId,
      APPROVAL_ACTIONS.COUNCIL_ELDER_REMOVE,
      { elderTotem, requestedBy },
      requestedBy
    );
  }

  // Remove diretamente (fundador ou aprovação não necessária)
  const updatedElders = council.elders.filter(t => t !== elderTotem);
  return await updateCouncilElders(clanId, updatedElders, requestedBy);
}

/**
 * Atualiza a lista de anciões
 * @param {number} clanId - ID do CLANN
 * @param {Array<string>} elders - Nova lista de anciões
 * @param {string} updatedBy - Totem que atualizou
 * @returns {Promise<Object>} Conselho atualizado
 */
async function updateCouncilElders(clanId, elders, updatedBy) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const councils = getWebCouncils();
    const index = councils.findIndex(c => c.clan_id === parseInt(clanId));
    
    if (index === -1) {
      throw new Error('Conselho não encontrado');
    }

    councils[index] = {
      ...councils[index],
      elders: JSON.stringify(elders)
    };
    saveWebCouncils(councils);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'council_elders_updated',
        clanId,
        elders,
        updatedBy
      },
      updatedBy
    );

    return Promise.resolve({
      ...councils[index],
      elders
    });
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE clan_council SET elders = ? WHERE clan_id = ?;`,
        [JSON.stringify(elders), clanId],
        async () => {
          // Busca conselho atualizado
          tx.executeSql(
            `SELECT * FROM clan_council WHERE clan_id = ?;`,
            [clanId],
            async (_, { rows }) => {
              const updatedCouncil = {
                ...rows.item(0),
                elders
              };

              // Log no Security Log
              await logSecurityEvent(
                SECURITY_EVENTS.CLAN_UPDATED,
                {
                  type: 'council_elders_updated',
                  clanId,
                  elders,
                  updatedBy
                },
                updatedBy
              );

              resolve(updatedCouncil);
            },
            (_, err) => reject(err)
          );
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Configura o número de aprovações necessárias
 * @param {number} clanId - ID do CLANN
 * @param {number} approvalsRequired - Número de aprovações necessárias
 * @param {string} updatedBy - Totem que atualizou
 * @returns {Promise<Object>} Conselho atualizado
 */
export async function setApprovalsRequired(clanId, approvalsRequired, updatedBy) {
  if (approvalsRequired < 1 || approvalsRequired > 10) {
    throw new Error('Número de aprovações deve estar entre 1 e 10');
  }

  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const councils = getWebCouncils();
    const index = councils.findIndex(c => c.clan_id === parseInt(clanId));
    
    if (index === -1) {
      throw new Error('Conselho não encontrado');
    }

    councils[index] = {
      ...councils[index],
      approvals_required: approvalsRequired
    };
    saveWebCouncils(councils);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'council_approvals_required_updated',
        clanId,
        approvalsRequired,
        updatedBy
      },
      updatedBy
    );

    return Promise.resolve(councils[index]);
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE clan_council SET approvals_required = ? WHERE clan_id = ?;`,
        [approvalsRequired, clanId],
        async () => {
          // Busca conselho atualizado
          tx.executeSql(
            `SELECT * FROM clan_council WHERE clan_id = ?;`,
            [clanId],
            async (_, { rows }) => {
              const updatedCouncil = rows.item(0);

              // Log no Security Log
              await logSecurityEvent(
                SECURITY_EVENTS.CLAN_UPDATED,
                {
                  type: 'council_approvals_required_updated',
                  clanId,
                  approvalsRequired,
                  updatedBy
                },
                updatedBy
              );

              resolve(updatedCouncil);
            },
            (_, err) => reject(err)
          );
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém lista de membros do CLANN para seleção de anciões
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Array>} Lista de membros
 */
export async function getClanMembers(clanId) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const members = ClanStorage._getWebMembers();
    return Promise.resolve(
      members
        .filter(m => m.clan_id === parseInt(clanId))
        .map(m => ({
          totem_id: m.totem_id,
          role: m.role,
          joined_at: m.joined_at
        }))
    );
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT totem_id, role, joined_at FROM clan_members WHERE clan_id = ? ORDER BY joined_at ASC;`,
        [clanId],
        (_, { rows }) => resolve(rows._array),
        (_, err) => reject(err)
      );
    });
  });
}

// Helpers para localStorage na Web
const WEB_COUNCILS_KEY = 'clann_clan_council';

function getWebCouncils() {
  if (Platform.OS !== 'web') return [];
  try {
    const data = localStorage.getItem(WEB_COUNCILS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveWebCouncils(councils) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(WEB_COUNCILS_KEY, JSON.stringify(councils));
  } catch (error) {
    console.error('Erro ao salvar conselhos no localStorage:', error);
  }
}

