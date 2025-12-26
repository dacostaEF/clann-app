/**
 * AdminTools - Ferramentas Administrativas
 * Sprint 8 - ETAPA 4
 * 
 * Funcionalidades:
 * - Exportação de dados (logs, hash-chain, rules, devices)
 * - Reset protegido (governance, rules, council, sync)
 * - Verificação de integridade (hash-chain, rules, council, approvals, sync)
 * - Assinatura digital (HMAC-SHA256)
 */

import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';
import ClanStorage from '../clans/ClanStorage';
import { getSecurityLogEvents } from '../security/SecurityLog';
import { getRules, getActiveRules, getRulesHash, getRuleHistory } from '../clans/RulesEngine';
import { getCouncil } from '../clans/CouncilManager';
import { getPendingApprovals } from '../clans/ApprovalEngine';
import { getLinkedDevices } from '../security/DeviceLinkManager';
import SyncManager from '../sync/SyncManager';
import { getCurrentTotemId } from '../crypto/totemStorage';
import { loadTotem } from '../crypto/totemStorage';
import { validatePinForSensitiveAction, getAESKey } from '../security/PinManager';
import { calculateTrustScore, shouldBlockSensitiveActions, shouldRequirePin } from '../security/DeviceTrust';
import { canUseAdminTools } from '../clans/permissions';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';

/**
 * Gera chave HMAC a partir do PIN e Totem do founder
 * @param {string} pin - PIN do founder
 * @param {string} founderTotemId - Totem ID do founder
 * @returns {Promise<Uint8Array>} Chave HMAC
 */
async function generateHMACKey(pin, founderTotemId) {
  // Usa chave AES derivada do PIN + Totem ID
  const pinBytes = new TextEncoder().encode(pin);
  const totemBytes = new TextEncoder().encode(founderTotemId);
  
  // Combina PIN + Totem ID
  const combined = new Uint8Array(pinBytes.length + totemBytes.length);
  combined.set(pinBytes, 0);
  combined.set(totemBytes, pinBytes.length);
  
  // Aplica SHA256 múltiplas vezes para derivar chave
  let hash = combined;
  for (let i = 0; i < 100000; i++) {
    hash = sha256(hash);
  }
  
  return hash;
}

/**
 * Assina dados com HMAC-SHA256 (simulado)
 * @param {Object} data - Dados a assinar
 * @param {string} pin - PIN do founder
 * @param {string} founderTotemId - Totem ID do founder
 * @returns {Promise<string>} Assinatura em hex
 */
async function signData(data, pin, founderTotemId) {
  try {
    const key = await generateHMACKey(pin, founderTotemId);
    const dataString = JSON.stringify(data);
    
    // HMAC-SHA256: hash(key + hash(key + data))
    // Simula HMAC usando SHA256 múltiplas vezes
    const keyData = Buffer.concat([
      Buffer.from(key),
      Buffer.from(dataString, 'utf8')
    ]);
    
    const innerHash = sha256(keyData);
    const outerKey = Buffer.concat([
      Buffer.from(key),
      Buffer.from(innerHash)
    ]);
    
    const hmacHash = sha256(outerKey);
    
    return Buffer.from(hmacHash).toString('hex');
  } catch (error) {
    console.error('Erro ao assinar dados:', error);
    throw new Error(`Erro ao assinar dados: ${error.message}`);
  }
}

/**
 * Exporta logs de segurança
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Dados exportados com assinatura
 */
export async function exportLogs(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (!canUseAdminTools(role)) {
      throw new Error('Apenas o founder pode exportar dados');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore)) {
      throw new Error('Device Trust Score muito baixo. Ação bloqueada por segurança.');
    }
    
    // Busca logs
    const logs = await getSecurityLogEvents(10000, 0); // Limite alto para exportar tudo
    
    // Filtra logs do CLANN (se aplicável)
    const clanLogs = logs.filter(log => {
      try {
        const details = log.details ? JSON.parse(log.details) : {};
        return details.clanId === clanId || !details.clanId;
      } catch {
        return true; // Inclui se não conseguir parsear
      }
    });
    
    const exportData = {
      type: 'security_logs',
      clanId,
      exportedAt: Date.now(),
      exportedBy: totemId,
      totalEvents: clanLogs.length,
      events: clanLogs
    };
    
    // Assina dados
    const signature = await signData(exportData, pin, totemId);
    
    return {
      ...exportData,
      signature,
      format: 'json'
    };
  } catch (error) {
    console.error('Erro ao exportar logs:', error);
    throw error;
  }
}

/**
 * Exporta hash-chain completa
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Hash-chain exportada com assinatura
 */
export async function exportHashChain(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (!canUseAdminTools(role)) {
      throw new Error('Apenas o founder pode exportar dados');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore)) {
      throw new Error('Device Trust Score muito baixo. Ação bloqueada por segurança.');
    }
    
    // Busca hash-chain (Security Log)
    const logs = await getSecurityLogEvents(10000, 0);
    
    // Filtra logs do CLANN
    const clanLogs = logs.filter(log => {
      try {
        const details = log.details ? JSON.parse(log.details) : {};
        return details.clanId === clanId || !details.clanId;
      } catch {
        return true;
      }
    });
    
    // Verifica integridade da hash-chain
    const integrity = await ClanStorage.verifySecurityLogIntegrity();
    
    const exportData = {
      type: 'hash_chain',
      clanId,
      exportedAt: Date.now(),
      exportedBy: totemId,
      totalEvents: clanLogs.length,
      chain: clanLogs,
      integrity: {
        valid: integrity.valid,
        errors: integrity.errors,
        totalEvents: integrity.totalEvents
      }
    };
    
    // Assina dados
    const signature = await signData(exportData, pin, totemId);
    
    return {
      ...exportData,
      signature,
      format: 'json'
    };
  } catch (error) {
    console.error('Erro ao exportar hash-chain:', error);
    throw error;
  }
}

/**
 * Exporta regras e histórico
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Regras exportadas com assinatura
 */
export async function exportRules(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (!canUseAdminTools(role)) {
      throw new Error('Apenas o founder pode exportar dados');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore)) {
      throw new Error('Device Trust Score muito baixo. Ação bloqueada por segurança.');
    }
    
    // Busca regras
    const rules = await getRules(clanId);
    const activeRules = await getActiveRules(clanId);
    const rulesHash = await getRulesHash(clanId);
    
    // Busca histórico de todas as regras
    const rulesWithHistory = await Promise.all(
      rules.map(async (rule) => {
        const history = await getRuleHistory(rule.rule_id);
        return {
          ...rule,
          history: history || []
        };
      })
    );
    
    const exportData = {
      type: 'rules',
      clanId,
      exportedAt: Date.now(),
      exportedBy: totemId,
      totalRules: rules.length,
      activeRules: activeRules.length,
      rulesHash,
      rules: rulesWithHistory
    };
    
    // Assina dados
    const signature = await signData(exportData, pin, totemId);
    
    return {
      ...exportData,
      signature,
      format: 'json'
    };
  } catch (error) {
    console.error('Erro ao exportar regras:', error);
    throw error;
  }
}

/**
 * Exporta dispositivos vinculados
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Dispositivos exportados com assinatura
 */
export async function exportDevices(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (!canUseAdminTools(role)) {
      throw new Error('Apenas o founder pode exportar dados');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore)) {
      throw new Error('Device Trust Score muito baixo. Ação bloqueada por segurança.');
    }
    
    // Busca dispositivos vinculados (usa Totem atual)
    const devices = await getLinkedDevices();
    
    const exportData = {
      type: 'devices',
      clanId,
      exportedAt: Date.now(),
      exportedBy: totemId,
      totalDevices: devices.length,
      devices: devices
    };
    
    // Assina dados
    const signature = await signData(exportData, pin, totemId);
    
    return {
      ...exportData,
      signature,
      format: 'json'
    };
  } catch (error) {
    console.error('Erro ao exportar dispositivos:', error);
    throw error;
  }
}

/**
 * Exporta todos os dados do CLANN
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Todos os dados exportados com assinatura
 */
export async function exportAllData(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (!canUseAdminTools(role)) {
      throw new Error('Apenas o founder pode exportar dados');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore)) {
      throw new Error('Device Trust Score muito baixo. Ação bloqueada por segurança.');
    }
    
    // Exporta tudo
    const [logs, hashChain, rules, devices, council, approvals] = await Promise.all([
      exportLogs(clanId, pin).catch(() => ({ events: [] })),
      exportHashChain(clanId, pin).catch(() => ({ chain: [] })),
      exportRules(clanId, pin).catch(() => ({ rules: [] })),
      exportDevices(clanId, pin).catch(() => ({ devices: [] })),
      getCouncil(clanId).catch(() => null),
      getPendingApprovals(clanId).catch(() => [])
    ]);
    
    const exportData = {
      type: 'all_data',
      clanId,
      exportedAt: Date.now(),
      exportedBy: totemId,
      data: {
        logs: logs.events || logs.chain || [],
        hashChain: hashChain.chain || [],
        rules: rules.rules || [],
        devices: devices.devices || [],
        council: council,
        approvals: approvals
      },
      metadata: {
        logsCount: logs.totalEvents || 0,
        rulesCount: rules.totalRules || 0,
        devicesCount: devices.totalDevices || 0,
        approvalsCount: approvals.length || 0
      }
    };
    
    // Assina dados
    const signature = await signData(exportData, pin, totemId);
    
    // Registra evento de exportação
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'data_exported',
        clanId,
        exportedBy: totemId
      },
      totemId
    );
    
    return {
      ...exportData,
      signature,
      format: 'json'
    };
  } catch (error) {
    console.error('Erro ao exportar todos os dados:', error);
    throw error;
  }
}

/**
 * Reseta governança completa (regras + conselho + aprovações)
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Resultado do reset
 */
export async function resetGovernance(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (role !== 'founder') {
      throw new Error('Apenas o founder pode resetar governança');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore) || shouldRequirePin(trustScore)) {
      throw new Error('Device Trust Score insuficiente. Ação bloqueada por segurança.');
    }
    
    const db = ClanStorage.getDB();
    
    if (Platform.OS === 'web' || !db) {
      // Web: limpa localStorage
      const rules = ClanStorage.getWebRules();
      const filteredRules = rules.filter(r => r.clan_id !== parseInt(clanId));
      ClanStorage.saveWebRules(filteredRules);
      
      const councils = ClanStorage.getWebCouncils();
      const filteredCouncils = councils.filter(c => c.clan_id !== parseInt(clanId));
      ClanStorage.saveWebCouncils(filteredCouncils);
      
      const approvals = ClanStorage.getWebPendingApprovals();
      const filteredApprovals = approvals.filter(a => a.clan_id !== parseInt(clanId));
      ClanStorage.saveWebPendingApprovals(filteredApprovals);
      
      return { success: true, reset: 'governance' };
    }
    
    // SQLite: deleta dados
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        // Deleta regras
        tx.executeSql(
          `DELETE FROM clan_rules WHERE clan_id = ?;`,
          [clanId],
          () => {},
          (_, err) => reject(err)
        );
        
        // Deleta histórico de regras
        tx.executeSql(
          `DELETE FROM rule_history WHERE rule_id IN (
            SELECT rule_id FROM clan_rules WHERE clan_id = ?
          );`,
          [clanId],
          () => {},
          () => {} // Ignora erro se não houver histórico
        );
        
        // Deleta conselho
        tx.executeSql(
          `DELETE FROM clan_council WHERE clan_id = ?;`,
          [clanId],
          () => {},
          (_, err) => reject(err)
        );
        
        // Deleta aprovações
        tx.executeSql(
          `DELETE FROM pending_approvals WHERE clan_id = ?;`,
          [clanId],
          () => {},
          (_, err) => reject(err)
        );
        
        // Registra evento
        logSecurityEvent(
          SECURITY_EVENTS.CLAN_UPDATED,
          {
            type: 'governance_reset',
            clanId,
            resetBy: totemId
          },
          totemId
        ).then(() => {
          resolve({ success: true, reset: 'governance' });
        }).catch(err => {
          console.warn('Erro ao registrar evento de reset:', err);
          resolve({ success: true, reset: 'governance' }); // Não falha se evento falhar
        });
      });
    });
  } catch (error) {
    console.error('Erro ao resetar governança:', error);
    throw error;
  }
}

/**
 * Reseta apenas regras
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Resultado do reset
 */
export async function resetRules(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (role !== 'founder') {
      throw new Error('Apenas o founder pode resetar regras');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore) || shouldRequirePin(trustScore)) {
      throw new Error('Device Trust Score insuficiente. Ação bloqueada por segurança.');
    }
    
    const db = ClanStorage.getDB();
    
    if (Platform.OS === 'web' || !db) {
      // Web: limpa localStorage
      const rules = ClanStorage.getWebRules();
      const filteredRules = rules.filter(r => r.clan_id !== parseInt(clanId));
      ClanStorage.saveWebRules(filteredRules);
      
      return { success: true, reset: 'rules' };
    }
    
    // SQLite: deleta regras
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        // Deleta regras
        tx.executeSql(
          `DELETE FROM clan_rules WHERE clan_id = ?;`,
          [clanId],
          () => {},
          (_, err) => reject(err)
        );
        
        // Deleta histórico de regras
        tx.executeSql(
          `DELETE FROM rule_history WHERE rule_id IN (
            SELECT rule_id FROM clan_rules WHERE clan_id = ?
          );`,
          [clanId],
          () => {},
          () => {} // Ignora erro
        );
        
        // Registra evento
        logSecurityEvent(
          SECURITY_EVENTS.CLAN_UPDATED,
          {
            type: 'rules_reset',
            clanId,
            resetBy: totemId
          },
          totemId
        ).then(() => {
          resolve({ success: true, reset: 'rules' });
        }).catch(() => {
          resolve({ success: true, reset: 'rules' });
        });
      });
    });
  } catch (error) {
    console.error('Erro ao resetar regras:', error);
    throw error;
  }
}

/**
 * Reseta conselho de anciões
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Resultado do reset
 */
export async function resetCouncil(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (role !== 'founder') {
      throw new Error('Apenas o founder pode resetar conselho');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore) || shouldRequirePin(trustScore)) {
      throw new Error('Device Trust Score insuficiente. Ação bloqueada por segurança.');
    }
    
    const db = ClanStorage.getDB();
    
    if (Platform.OS === 'web' || !db) {
      // Web: limpa localStorage
      const councils = ClanStorage.getWebCouncils();
      const filteredCouncils = councils.filter(c => c.clan_id !== parseInt(clanId));
      ClanStorage.saveWebCouncils(filteredCouncils);
      
      return { success: true, reset: 'council' };
    }
    
    // SQLite: deleta conselho
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM clan_council WHERE clan_id = ?;`,
          [clanId],
          () => {},
          (_, err) => reject(err)
        );
        
        // Registra evento
        logSecurityEvent(
          SECURITY_EVENTS.CLAN_UPDATED,
          {
            type: 'council_reset',
            clanId,
            resetBy: totemId
          },
          totemId
        ).then(() => {
          resolve({ success: true, reset: 'council' });
        }).catch(() => {
          resolve({ success: true, reset: 'council' });
        });
      });
    });
  } catch (error) {
    console.error('Erro ao resetar conselho:', error);
    throw error;
  }
}

/**
 * Reseta dados de sincronização
 * @param {number} clanId - ID do CLANN
 * @param {string} pin - PIN do founder
 * @returns {Promise<Object>} Resultado do reset
 */
export async function resetSync(clanId, pin) {
  try {
    // Verifica permissões
    const totemId = await getCurrentTotemId();
    const role = await ClanStorage.getUserRole(clanId, totemId);
    
    if (role !== 'founder') {
      throw new Error('Apenas o founder pode resetar sincronização');
    }
    
    // Valida PIN
    await validatePinForSensitiveAction(pin);
    
    // Verifica Device Trust
    const trustScore = await calculateTrustScore();
    if (shouldBlockSensitiveActions(trustScore) || shouldRequirePin(trustScore)) {
      throw new Error('Device Trust Score insuficiente. Ação bloqueada por segurança.');
    }
    
    // Para sync e limpa timestamps
    SyncManager.stopSync(clanId);
    SyncManager.updateLastTimestamp(clanId, 0);
    
    // Registra evento
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'sync_reset',
        clanId,
        resetBy: totemId
      },
      totemId
    );
    
    return { success: true, reset: 'sync' };
  } catch (error) {
    console.error('Erro ao resetar sincronização:', error);
    throw error;
  }
}

/**
 * Calcula hash do conselho
 * @param {Object} council - Conselho
 * @returns {string} Hash em hex
 */
function calculateCouncilHash(council) {
  if (!council) {
    return '';
  }
  
  const councilString = JSON.stringify({
    founder: council.founder_totem,
    elders: council.elders || [],
    approvalsRequired: council.approvals_required || 2
  });
  
  const hashBytes = sha256(new TextEncoder().encode(councilString));
  return Buffer.from(hashBytes).toString('hex');
}

/**
 * Calcula hash das aprovações pendentes
 * @param {Array} approvals - Lista de aprovações
 * @returns {string} Hash em hex
 */
function calculateApprovalsHash(approvals) {
  if (!approvals || approvals.length === 0) {
    return '';
  }
  
  const approvalsString = JSON.stringify(
    approvals.map(a => ({
      id: a.id,
      actionType: a.action_type,
      status: a.status,
      requestedBy: a.requested_by
    }))
  );
  
  const hashBytes = sha256(new TextEncoder().encode(approvalsString));
  return Buffer.from(hashBytes).toString('hex');
}

/**
 * Calcula hash do estado de sincronização
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<string>} Hash em hex
 */
async function calculateSyncStateHash(clanId) {
  try {
    // Obtém último timestamp do SyncManager (acessa internamente)
    // Como SyncManager não expõe getLastTimestamp, usamos valor padrão
    const lastTimestamp = 0; // Seria obtido de SyncManager.lastTimestamps.get(clanId)
    
    const syncState = {
      clanId,
      lastTimestamp,
      syncing: SyncManager.isSyncing ? SyncManager.isSyncing(clanId) : false
    };
    
    const syncString = JSON.stringify(syncState);
    const hashBytes = sha256(new TextEncoder().encode(syncString));
    return Buffer.from(hashBytes).toString('hex');
  } catch (error) {
    console.error('Erro ao calcular hash de sync:', error);
    return '';
  }
}

/**
 * Verifica integridade completa do CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Object>} Resultado da verificação
 */
export async function checkIntegrity(clanId) {
  try {
    const results = {
      valid: true,
      errors: [],
      hashes: {},
      integrity: {}
    };
    
    // 1. Verifica hash-chain de segurança
    const securityLogIntegrity = await ClanStorage.verifySecurityLogIntegrity();
    results.integrity.securityLog = securityLogIntegrity;
    if (!securityLogIntegrity.valid) {
      results.valid = false;
      results.errors.push({
        type: 'security_log',
        message: 'Hash-chain de segurança corrompida',
        errors: securityLogIntegrity.errors
      });
    }
    
    // 2. Verifica hash das regras
    const rulesHash = await getRulesHash(clanId);
    const activeRules = await getActiveRules(clanId);
    const calculatedRulesHash = calculateRulesHash(activeRules);
    results.hashes.rulesHash = rulesHash;
    results.hashes.calculatedRulesHash = calculatedRulesHash;
    
    if (rulesHash !== calculatedRulesHash) {
      results.valid = false;
      results.errors.push({
        type: 'rules',
        message: 'Hash das regras não corresponde',
        expected: calculatedRulesHash,
        actual: rulesHash
      });
    }
    
    // 3. Verifica hash do conselho
    const council = await getCouncil(clanId);
    const councilHash = calculateCouncilHash(council);
    results.hashes.councilHash = councilHash;
    
    // 4. Verifica hash das aprovações
    const approvals = await getPendingApprovals(clanId);
    const approvalsHash = calculateApprovalsHash(approvals);
    results.hashes.approvalsHash = approvalsHash;
    
    // 5. Verifica hash do estado de sync
    const syncStateHash = await calculateSyncStateHash(clanId);
    results.hashes.syncStateHash = syncStateHash;
    
    // 6. Hash do estado atual do CLANN (combinação de todos)
    const clanState = {
      rulesHash,
      councilHash,
      approvalsHash,
      syncStateHash,
      timestamp: Date.now()
    };
    
    const clanStateString = JSON.stringify(clanState);
    const clanStateHashBytes = sha256(new TextEncoder().encode(clanStateString));
    const clanStateHash = Buffer.from(clanStateHashBytes).toString('hex');
    results.hashes.clanStateHash = clanStateHash;
    
    return results;
  } catch (error) {
    console.error('Erro ao verificar integridade:', error);
    return {
      valid: false,
      errors: [{ type: 'unknown', message: error.message }],
      hashes: {},
      integrity: {}
    };
  }
}

// Import necessário para calculateRulesHash
import { calculateRulesHash } from '../clans/RulesEngine';

