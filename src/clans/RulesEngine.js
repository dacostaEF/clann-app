/**
 * RulesEngine - Sistema de Regras do CLANN
 * Sprint 7 - Governança - ETAPA 1 e ETAPA 2
 * 
 * Gerencia regras do CLANN com hash de validação
 * Cada regra pode ser criada, editada, aprovada e ativada/desativada
 * ETAPA 2: Adiciona suporte a categorias, templates e histórico de versões
 */

import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';
import ClanStorage from './ClanStorage';

// Polyfill para web - SQLite não funciona no navegador
let SQLite;
if (Platform.OS === 'web') {
  SQLite = null;
} else {
  SQLite = require('expo-sqlite');
}

// Chave para localStorage na Web
const WEB_RULES_KEY = 'clann_clan_rules';

/**
 * Gera ID único para uma regra
 * @returns {string} Rule ID
 */
function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calcula hash das regras ativas
 * @param {Array} activeRules - Array de regras ativas
 * @returns {string} Hash em hexadecimal
 */
export function calculateRulesHash(activeRules) {
  if (!activeRules || activeRules.length === 0) {
    return '';
  }

  // Ordena regras por ID para garantir consistência
  const sortedRules = [...activeRules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  
  // Cria string única com todas as regras ativas
  const rulesString = sortedRules
    .map(rule => `${rule.rule_id}:${rule.text}:${rule.version}:${rule.enabled ? '1' : '0'}`)
    .join('|');

  // Calcula SHA256
  const hashBytes = sha256(new TextEncoder().encode(rulesString));
  return Buffer.from(hashBytes).toString('hex');
}

/**
 * Obtém regras de um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Array>} Lista de regras
 */
export async function getRules(clanId) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, busca no localStorage
    const rules = ClanStorage.getWebRules();
    return Promise.resolve(rules.filter(r => r.clan_id === parseInt(clanId)));
  }

  return new Promise((resolve, reject) => {

    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM clan_rules WHERE clan_id = ? ORDER BY created_at DESC;`,
        [clanId],
        (_, { rows }) => resolve(rows._array),
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém regras ativas de um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Array>} Lista de regras ativas
 */
export async function getActiveRules(clanId) {
  const allRules = await getRules(clanId);
  return allRules.filter(rule => rule.enabled === 1 || rule.enabled === true);
}

/**
 * Obtém hash das regras ativas
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<string>} Hash das regras
 */
export async function getRulesHash(clanId) {
  const activeRules = await getActiveRules(clanId);
  return calculateRulesHash(activeRules);
}

/**
 * Cria uma nova regra
 * @param {number} clanId - ID do CLANN
 * @param {string} text - Texto da regra
 * @param {string} approvedBy - Totem que aprovou (pode ser null se pendente)
 * @param {string} category - Categoria da regra (opcional)
 * @param {string} templateId - ID do template usado (opcional)
 * @returns {Promise<Object>} Regra criada
 */
export async function createRule(clanId, text, approvedBy = null, category = null, templateId = null) {
  const ruleId = generateRuleId();
  const timestamp = Date.now();
  const approvedByArray = approvedBy ? [approvedBy] : [];

  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, salva no localStorage
    const rules = ClanStorage.getWebRules();
    const newRule = {
      id: Date.now(),
      clan_id: parseInt(clanId),
      rule_id: ruleId,
      text: text.trim(),
      enabled: approvedBy ? 1 : 0,
      version: 1,
      created_at: timestamp,
      approved_by: JSON.stringify(approvedByArray),
      category: category || null,
      template_id: templateId || null
    };
    rules.push(newRule);
    ClanStorage.saveWebRules(rules);
    
    // Salva histórico
    await saveRuleHistory(ruleId, 1, text.trim(), approvedBy, 'created');
    
    return Promise.resolve(newRule);
  }

  return new Promise((resolve, reject) => {

      db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO clan_rules (clan_id, rule_id, text, enabled, version, created_at, approved_by, category, template_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            clanId,
            ruleId,
            text.trim(),
            approvedBy ? 1 : 0,
            1,
            timestamp,
            JSON.stringify(approvedByArray),
            category || null,
            templateId || null
          ],
          async (_, result) => {
            const newRule = {
              id: result.insertId,
              clan_id: clanId,
              rule_id: ruleId,
              text: text.trim(),
              enabled: approvedBy ? 1 : 0,
              version: 1,
              created_at: timestamp,
              approved_by: JSON.stringify(approvedByArray),
              category: category || null,
              template_id: templateId || null
            };
            
            // Salva histórico
            await saveRuleHistory(ruleId, 1, text.trim(), approvedBy, 'created');
            
            resolve(newRule);
          },
          (_, err) => reject(err)
        );
      });
  });
}

/**
 * Edita uma regra existente
 * @param {string} ruleId - ID da regra
 * @param {string} newText - Novo texto da regra
 * @param {string} changedBy - Totem que fez a alteração
 * @returns {Promise<Object>} Regra atualizada
 */
export async function editRule(ruleId, newText, changedBy = null) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, atualiza no localStorage
    const rules = ClanStorage.getWebRules();
    const index = rules.findIndex(r => r.rule_id === ruleId);
    if (index === -1) {
      throw new Error('Regra não encontrada');
    }
    
    const oldRule = rules[index];
    const newVersion = (oldRule.version || 1) + 1;
    
    rules[index] = {
      ...oldRule,
      text: newText.trim(),
      version: newVersion,
      enabled: 0, // Desativa ao editar (precisa re-aprovação)
      approved_by: JSON.stringify([])
    };
    ClanStorage.saveWebRules(rules);
    
    // Salva histórico
    await saveRuleHistory(ruleId, newVersion, newText.trim(), changedBy, 'edited', oldRule.text);
    
    return Promise.resolve(rules[index]);
  }

  return new Promise((resolve, reject) => {

    db.transaction(tx => {
      // Busca regra atual
      tx.executeSql(
        `SELECT * FROM clan_rules WHERE rule_id = ?;`,
        [ruleId],
        (_, { rows }) => {
          if (rows.length === 0) {
            reject(new Error('Regra não encontrada'));
            return;
          }

          const currentRule = rows.item(0);
          const newVersion = (currentRule.version || 1) + 1;
          const oldText = currentRule.text;

          // Atualiza regra
          tx.executeSql(
            `UPDATE clan_rules 
             SET text = ?, version = ?, enabled = 0, approved_by = ?
             WHERE rule_id = ?;`,
            [newText.trim(), newVersion, JSON.stringify([]), ruleId],
            async () => {
              const updatedRule = {
                ...currentRule,
                text: newText.trim(),
                version: newVersion,
                enabled: 0,
                approved_by: JSON.stringify([])
              };
              
              // Salva histórico
              await saveRuleHistory(ruleId, newVersion, newText.trim(), changedBy, 'edited', oldText);
              
              resolve(updatedRule);
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
 * Aprova uma regra (requer 2 anciões)
 * @param {string} ruleId - ID da regra
 * @param {string} approverTotem - Totem que está aprovando
 * @returns {Promise<Object>} Regra atualizada
 */
export async function approveRule(ruleId, approverTotem) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, atualiza no localStorage
    const rules = ClanStorage.getWebRules();
    const index = rules.findIndex(r => r.rule_id === ruleId);
    if (index === -1) {
      throw new Error('Regra não encontrada');
    }

    const currentApprovals = JSON.parse(rules[index].approved_by || '[]');
    if (!currentApprovals.includes(approverTotem)) {
      currentApprovals.push(approverTotem);
    }

    // Ativa se tiver 2+ aprovações
    const enabled = currentApprovals.length >= 2 ? 1 : 0;

    rules[index] = {
      ...rules[index],
      enabled,
      approved_by: JSON.stringify(currentApprovals)
    };
    ClanStorage.saveWebRules(rules);
    return Promise.resolve(rules[index]);
  }

  return new Promise((resolve, reject) => {

    db.transaction(tx => {
      // Busca regra atual
      tx.executeSql(
        `SELECT * FROM clan_rules WHERE rule_id = ?;`,
        [ruleId],
        (_, { rows }) => {
          if (rows.length === 0) {
            reject(new Error('Regra não encontrada'));
            return;
          }

          const currentRule = rows.item(0);
          const currentApprovals = JSON.parse(currentRule.approved_by || '[]');
          
          if (!currentApprovals.includes(approverTotem)) {
            currentApprovals.push(approverTotem);
          }

          // Ativa se tiver 2+ aprovações
          const enabled = currentApprovals.length >= 2 ? 1 : 0;

          // Atualiza regra
          tx.executeSql(
            `UPDATE clan_rules 
             SET enabled = ?, approved_by = ?
             WHERE rule_id = ?;`,
            [enabled, JSON.stringify(currentApprovals), ruleId],
            () => {
              resolve({
                ...currentRule,
                enabled,
                approved_by: JSON.stringify(currentApprovals)
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
 * Ativa/desativa uma regra
 * @param {string} ruleId - ID da regra
 * @param {boolean} enabled - Status desejado
 * @returns {Promise<Object>} Regra atualizada
 */
export async function toggleRule(ruleId, enabled) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, atualiza no localStorage
    const rules = ClanStorage.getWebRules();
    const index = rules.findIndex(r => r.rule_id === ruleId);
    if (index === -1) {
      throw new Error('Regra não encontrada');
    }
    rules[index] = {
      ...rules[index],
      enabled: enabled ? 1 : 0
    };
    ClanStorage.saveWebRules(rules);
    return Promise.resolve(rules[index]);
  }

  return new Promise((resolve, reject) => {

    db.transaction(tx => {
      tx.executeSql(
        `UPDATE clan_rules SET enabled = ? WHERE rule_id = ?;`,
        [enabled ? 1 : 0, ruleId],
        () => {
          // Busca regra atualizada
          tx.executeSql(
            `SELECT * FROM clan_rules WHERE rule_id = ?;`,
            [ruleId],
            (_, { rows }) => {
              if (rows.length > 0) {
                resolve(rows.item(0));
              } else {
                reject(new Error('Regra não encontrada'));
              }
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
 * Deleta uma regra
 * @param {string} ruleId - ID da regra
 * @param {string} deletedBy - Totem que deletou
 * @returns {Promise<void>}
 */
export async function deleteRule(ruleId, deletedBy = null) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, remove do localStorage
    const rules = ClanStorage.getWebRules();
    const rule = rules.find(r => r.rule_id === ruleId);
    if (rule) {
      await saveRuleHistory(ruleId, rule.version || 1, rule.text, deletedBy, 'deleted');
    }
    const filtered = rules.filter(r => r.rule_id !== ruleId);
    ClanStorage.saveWebRules(filtered);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Busca regra antes de deletar para salvar histórico
      tx.executeSql(
        `SELECT * FROM clan_rules WHERE rule_id = ?;`,
        [ruleId],
        async (_, { rows }) => {
          if (rows.length > 0) {
            const rule = rows.item(0);
            await saveRuleHistory(ruleId, rule.version || 1, rule.text, deletedBy, 'deleted');
          }
          
          tx.executeSql(
            `DELETE FROM clan_rules WHERE rule_id = ?;`,
            [ruleId],
            () => resolve(),
            (_, err) => reject(err)
          );
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém regras por categoria
 * @param {number} clanId - ID do CLANN
 * @param {string} category - Categoria
 * @returns {Promise<Array>} Lista de regras
 */
export async function getRulesByCategory(clanId, category) {
  const allRules = await getRules(clanId);
  return allRules.filter(rule => rule.category === category);
}

/**
 * Salva histórico de versão de uma regra
 * @param {string} ruleId - ID da regra
 * @param {number} version - Versão
 * @param {string} text - Texto da regra
 * @param {string} changedBy - Totem que fez a mudança
 * @param {string} changeType - Tipo de mudança (created, edited, deleted, approved)
 * @param {string} oldText - Texto anterior (para edições)
 */
async function saveRuleHistory(ruleId, version, text, changedBy, changeType, oldText = null) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, salva no localStorage
    const history = getWebRuleHistory();
    history.push({
      id: Date.now(),
      rule_id: ruleId,
      version,
      text,
      changed_by: changedBy,
      changed_at: Date.now(),
      change_type: changeType,
      old_text: oldText
    });
    saveWebRuleHistory(history);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO rule_history (rule_id, version, text, changed_by, changed_at, change_type)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [ruleId, version, text, changedBy, Date.now(), changeType],
        () => resolve(),
        (_, err) => {
          console.error('Erro ao salvar histórico:', err);
          resolve(); // Não falha se histórico não salvar
        }
      );
    });
  });
}

/**
 * Obtém histórico de versões de uma regra
 * @param {string} ruleId - ID da regra
 * @returns {Promise<Array>} Lista de versões
 */
export async function getRuleHistory(ruleId) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    const history = getWebRuleHistory();
    return Promise.resolve(history.filter(h => h.rule_id === ruleId).sort((a, b) => b.version - a.version));
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM rule_history WHERE rule_id = ? ORDER BY version DESC;`,
        [ruleId],
        (_, { rows }) => resolve(rows._array),
        (_, err) => reject(err)
      );
    });
  });
}

// Helpers para localStorage na Web - Histórico
const WEB_RULE_HISTORY_KEY = 'clann_rule_history';

function getWebRuleHistory() {
  if (Platform.OS !== 'web') return [];
  try {
    const data = localStorage.getItem(WEB_RULE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveWebRuleHistory(history) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(WEB_RULE_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Erro ao salvar histórico no localStorage:', error);
  }
}

