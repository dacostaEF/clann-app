/**
 * ApprovalEngine - Sistema de Aprovações Pendentes
 * Sprint 7 - Governança - ETAPA 3
 * 
 * Gerencia solicitações de aprovação para ações importantes do CLANN
 * Requer aprovação de múltiplos anciões antes de executar ações críticas
 */

import { Platform } from 'react-native';
import ClanStorage from './ClanStorage';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { executeApprovedAction } from './ApprovalExecutor';

// Tipos de ações que requerem aprovação
export const APPROVAL_ACTIONS = {
  RULE_CREATE: 'rule_create',
  RULE_EDIT: 'rule_edit',
  RULE_DELETE: 'rule_delete',
  MEMBER_PROMOTE: 'member_promote',
  MEMBER_DEMOTE: 'member_demote',
  MEMBER_REMOVE: 'member_remove',
  CLAN_SETTINGS_CHANGE: 'clan_settings_change',
  COUNCIL_ELDER_ADD: 'council_elder_add',
  COUNCIL_ELDER_REMOVE: 'council_elder_remove',
  CUSTOM: 'custom'
};

export const APPROVAL_ACTION_LABELS = {
  [APPROVAL_ACTIONS.RULE_CREATE]: 'Criar Regra',
  [APPROVAL_ACTIONS.RULE_EDIT]: 'Editar Regra',
  [APPROVAL_ACTIONS.RULE_DELETE]: 'Excluir Regra',
  [APPROVAL_ACTIONS.MEMBER_PROMOTE]: 'Promover Membro',
  [APPROVAL_ACTIONS.MEMBER_DEMOTE]: 'Rebaixar Membro',
  [APPROVAL_ACTIONS.MEMBER_REMOVE]: 'Remover Membro',
  [APPROVAL_ACTIONS.CLAN_SETTINGS_CHANGE]: 'Alterar Configurações',
  [APPROVAL_ACTIONS.COUNCIL_ELDER_ADD]: 'Adicionar Ancião',
  [APPROVAL_ACTIONS.COUNCIL_ELDER_REMOVE]: 'Remover Ancião',
  [APPROVAL_ACTIONS.CUSTOM]: 'Ação Personalizada'
};

// Status das aprovações
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

/**
 * Cria uma nova solicitação de aprovação
 * @param {number} clanId - ID do CLANN
 * @param {string} actionType - Tipo de ação (APPROVAL_ACTIONS)
 * @param {Object} actionData - Dados da ação (será serializado como JSON)
 * @param {string} requestedBy - Totem que solicitou
 * @param {number} approvalsRequired - Número de aprovações necessárias (padrão: 2)
 * @returns {Promise<Object>} Solicitação criada
 */
export async function createApprovalRequest(
  clanId,
  actionType,
  actionData,
  requestedBy,
  approvalsRequired = 2
) {
  const db = ClanStorage.getDB();
  const timestamp = Date.now();

  if (Platform.OS === 'web' || !db) {
    // Na Web, salva no localStorage
    const approvals = getWebPendingApprovals();
    const newApproval = {
      id: Date.now(),
      clan_id: parseInt(clanId),
      action_type: actionType,
      action_data: JSON.stringify(actionData),
      requested_by: requestedBy,
      approvals: JSON.stringify([]),
      rejections: JSON.stringify([]),
      status: APPROVAL_STATUS.PENDING,
      created_at: timestamp,
    };
    approvals.push(newApproval);
    saveWebPendingApprovals(approvals);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_requested',
        actionType,
        clanId,
        requestedBy
      },
      requestedBy
    );

    return Promise.resolve(newApproval);
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO pending_approvals 
         (clan_id, action_type, action_data, requested_by, approvals, rejections, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          clanId,
          actionType,
          JSON.stringify(actionData),
          requestedBy,
          JSON.stringify([]),
          JSON.stringify([]),
          APPROVAL_STATUS.PENDING,
          timestamp
        ],
        async (_, result) => {
          const newApproval = {
            id: result.insertId,
            clan_id: clanId,
            action_type: actionType,
            action_data: JSON.stringify(actionData),
            requested_by: requestedBy,
            approvals: JSON.stringify([]),
            rejections: JSON.stringify([]),
            status: APPROVAL_STATUS.PENDING,
            created_at: timestamp
          };

          // Log no Security Log
          await logSecurityEvent(
            SECURITY_EVENTS.CLAN_UPDATED,
            {
              type: 'approval_requested',
              actionType,
              clanId,
              requestedBy
            },
            requestedBy
          );

          resolve(newApproval);
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém aprovações pendentes de um CLANN
 * @param {number} clanId - ID do CLANN
 * @param {string} status - Status para filtrar (opcional)
 * @returns {Promise<Array>} Lista de aprovações
 */
export async function getPendingApprovals(clanId, status = null) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const approvals = getWebPendingApprovals();
    let filtered = approvals.filter(a => a.clan_id === parseInt(clanId));
    
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }
    
    // Parse JSON fields
    return Promise.resolve(filtered.map(a => ({
      ...a,
      action_data: a.action_data ? JSON.parse(a.action_data) : null,
      approvals: a.approvals ? JSON.parse(a.approvals) : [],
      rejections: a.rejections ? JSON.parse(a.rejections) : []
    })).sort((a, b) => b.created_at - a.created_at));
  }

  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM pending_approvals WHERE clan_id = ?`;
    let params = [clanId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC;`;

    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, { rows }) => {
          const approvals = rows._array.map(a => ({
            ...a,
            action_data: a.action_data ? JSON.parse(a.action_data) : null,
            approvals: a.approvals ? JSON.parse(a.approvals) : [],
            rejections: a.rejections ? JSON.parse(a.rejections) : []
          }));
          resolve(approvals);
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Aprova uma solicitação
 * @param {number} approvalId - ID da aprovação
 * @param {string} approverTotem - Totem que está aprovando
 * @returns {Promise<Object>} Aprovação atualizada
 */
export async function approveRequest(approvalId, approverTotem) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const approvals = getWebPendingApprovals();
    const index = approvals.findIndex(a => a.id === approvalId);
    
    if (index === -1) {
      throw new Error('Aprovação não encontrada');
    }

    const approval = approvals[index];
    const currentApprovals = JSON.parse(approval.approvals || '[]');
    const currentRejections = JSON.parse(approval.rejections || '[]');

    // Verifica se já aprovou
    if (currentApprovals.includes(approverTotem)) {
      throw new Error('Você já aprovou esta solicitação');
    }

    // Remove de rejeições se estiver lá
    const newRejections = currentRejections.filter(t => t !== approverTotem);
    
    // Adiciona aprovação
    currentApprovals.push(approverTotem);

    // Verifica se atingiu o número necessário de aprovações (padrão: 2)
    const approvalsRequired = 2;
    const newStatus = currentApprovals.length >= approvalsRequired 
      ? APPROVAL_STATUS.APPROVED 
      : APPROVAL_STATUS.PENDING;

    approvals[index] = {
      ...approval,
      approvals: JSON.stringify(currentApprovals),
      rejections: JSON.stringify(newRejections),
      status: newStatus
    };
    saveWebPendingApprovals(approvals);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_given',
        approvalId,
        approverTotem,
        newStatus
      },
      approverTotem
    );

    const updatedApproval = {
      ...approvals[index],
      action_data: approvals[index].action_data ? JSON.parse(approvals[index].action_data) : null,
      approvals: currentApprovals,
      rejections: newRejections,
      status: newStatus
    };

    // Se foi aprovado, executa automaticamente
    if (newStatus === APPROVAL_STATUS.APPROVED) {
      try {
        await executeApprovedAction(updatedApproval);
      } catch (error) {
        console.error('Erro ao executar ação aprovada:', error);
        // Não rejeita a aprovação, apenas loga o erro
      }
    }

    return Promise.resolve(updatedApproval);
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Busca aprovação atual
      tx.executeSql(
        `SELECT * FROM pending_approvals WHERE id = ?;`,
        [approvalId],
        async (_, { rows }) => {
          if (rows.length === 0) {
            reject(new Error('Aprovação não encontrada'));
            return;
          }

          const approval = rows.item(0);
          const currentApprovals = JSON.parse(approval.approvals || '[]');
          const currentRejections = JSON.parse(approval.rejections || '[]');

          // Verifica se já aprovou
          if (currentApprovals.includes(approverTotem)) {
            reject(new Error('Você já aprovou esta solicitação'));
            return;
          }

          // Remove de rejeições se estiver lá
          const newRejections = currentRejections.filter(t => t !== approverTotem);
          
          // Adiciona aprovação
          currentApprovals.push(approverTotem);

          // Verifica se atingiu o número necessário (padrão: 2)
          const approvalsRequired = 2; // Pode ser configurável no futuro
          const newStatus = currentApprovals.length >= approvalsRequired 
            ? APPROVAL_STATUS.APPROVED 
            : APPROVAL_STATUS.PENDING;

          // Atualiza aprovação
          tx.executeSql(
            `UPDATE pending_approvals 
             SET approvals = ?, rejections = ?, status = ?
             WHERE id = ?;`,
            [
              JSON.stringify(currentApprovals),
              JSON.stringify(newRejections),
              newStatus,
              approvalId
            ],
            async () => {
              // Log no Security Log
              await logSecurityEvent(
                SECURITY_EVENTS.CLAN_UPDATED,
                {
                  type: 'approval_given',
                  approvalId,
                  approverTotem,
                  newStatus
                },
                approverTotem
              );

              const updatedApproval = {
                ...approval,
                action_data: approval.action_data ? JSON.parse(approval.action_data) : null,
                approvals: currentApprovals,
                rejections: newRejections,
                status: newStatus
              };

              // Se foi aprovado, executa automaticamente
              if (newStatus === APPROVAL_STATUS.APPROVED) {
                try {
                  await executeApprovedAction(updatedApproval);
                } catch (error) {
                  console.error('Erro ao executar ação aprovada:', error);
                  // Não rejeita a aprovação, apenas loga o erro
                }
              }

              resolve(updatedApproval);
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
 * Rejeita uma solicitação
 * @param {number} approvalId - ID da aprovação
 * @param {string} rejectorTotem - Totem que está rejeitando
 * @returns {Promise<Object>} Aprovação atualizada
 */
export async function rejectRequest(approvalId, rejectorTotem) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const approvals = getWebPendingApprovals();
    const index = approvals.findIndex(a => a.id === approvalId);
    
    if (index === -1) {
      throw new Error('Aprovação não encontrada');
    }

    const approval = approvals[index];
    const currentApprovals = JSON.parse(approval.approvals || '[]');
    const currentRejections = JSON.parse(approval.rejections || '[]');

    // Verifica se já rejeitou
    if (currentRejections.includes(rejectorTotem)) {
      throw new Error('Você já rejeitou esta solicitação');
    }

    // Remove de aprovações se estiver lá
    const newApprovals = currentApprovals.filter(t => t !== rejectorTotem);
    
    // Adiciona rejeição
    currentRejections.push(rejectorTotem);

    // Se tiver 2+ rejeições, marca como rejeitada
    const newStatus = currentRejections.length >= 2 
      ? APPROVAL_STATUS.REJECTED 
      : APPROVAL_STATUS.PENDING;

    approvals[index] = {
      ...approval,
      approvals: JSON.stringify(newApprovals),
      rejections: JSON.stringify(currentRejections),
      status: newStatus
    };
    saveWebPendingApprovals(approvals);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_rejected',
        approvalId,
        rejectorTotem,
        newStatus
      },
      rejectorTotem
    );

    return Promise.resolve({
      ...approvals[index],
      action_data: approvals[index].action_data ? JSON.parse(approvals[index].action_data) : null,
      approvals: newApprovals,
      rejections: currentRejections
    });
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Busca aprovação atual
      tx.executeSql(
        `SELECT * FROM pending_approvals WHERE id = ?;`,
        [approvalId],
        async (_, { rows }) => {
          if (rows.length === 0) {
            reject(new Error('Aprovação não encontrada'));
            return;
          }

          const approval = rows.item(0);
          const currentApprovals = JSON.parse(approval.approvals || '[]');
          const currentRejections = JSON.parse(approval.rejections || '[]');

          // Verifica se já rejeitou
          if (currentRejections.includes(rejectorTotem)) {
            reject(new Error('Você já rejeitou esta solicitação'));
            return;
          }

          // Remove de aprovações se estiver lá
          const newApprovals = currentApprovals.filter(t => t !== rejectorTotem);
          
          // Adiciona rejeição
          currentRejections.push(rejectorTotem);

          // Se tiver 2+ rejeições, marca como rejeitada
          const newStatus = currentRejections.length >= 2 
            ? APPROVAL_STATUS.REJECTED 
            : APPROVAL_STATUS.PENDING;

          // Atualiza aprovação
          tx.executeSql(
            `UPDATE pending_approvals 
             SET approvals = ?, rejections = ?, status = ?
             WHERE id = ?;`,
            [
              JSON.stringify(newApprovals),
              JSON.stringify(currentRejections),
              newStatus,
              approvalId
            ],
            async () => {
              // Log no Security Log
              await logSecurityEvent(
                SECURITY_EVENTS.CLAN_UPDATED,
                {
                  type: 'approval_rejected',
                  approvalId,
                  rejectorTotem,
                  newStatus
                },
                rejectorTotem
              );

              resolve({
                ...approval,
                action_data: approval.action_data ? JSON.parse(approval.action_data) : null,
                approvals: newApprovals,
                rejections: currentRejections,
                status: newStatus
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
 * Cancela uma solicitação (apenas quem criou pode cancelar)
 * @param {number} approvalId - ID da aprovação
 * @param {string} requesterTotem - Totem que criou a solicitação
 * @returns {Promise<void>}
 */
export async function cancelRequest(approvalId, requesterTotem) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const approvals = getWebPendingApprovals();
    const index = approvals.findIndex(a => a.id === approvalId);
    
    if (index === -1) {
      throw new Error('Aprovação não encontrada');
    }

    if (approvals[index].requested_by !== requesterTotem) {
      throw new Error('Apenas quem criou a solicitação pode cancelá-la');
    }

    approvals.splice(index, 1);
    saveWebPendingApprovals(approvals);

    // Log no Security Log
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_cancelled',
        approvalId,
        requesterTotem
      },
      requesterTotem
    );

    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Verifica se é o criador
      tx.executeSql(
        `SELECT * FROM pending_approvals WHERE id = ?;`,
        [approvalId],
        async (_, { rows }) => {
          if (rows.length === 0) {
            reject(new Error('Aprovação não encontrada'));
            return;
          }

          const approval = rows.item(0);
          if (approval.requested_by !== requesterTotem) {
            reject(new Error('Apenas quem criou a solicitação pode cancelá-la'));
            return;
          }

          // Deleta aprovação
          tx.executeSql(
            `DELETE FROM pending_approvals WHERE id = ?;`,
            [approvalId],
            async () => {
              // Log no Security Log
              await logSecurityEvent(
                SECURITY_EVENTS.CLAN_UPDATED,
                {
                  type: 'approval_cancelled',
                  approvalId,
                  requesterTotem
                },
                requesterTotem
              );

              resolve();
            },
            (_, err) => reject(err)
          );
        },
        (_, err) => reject(err)
      );
    });
  });
}

// Helpers para localStorage na Web
const WEB_PENDING_APPROVALS_KEY = 'clann_pending_approvals';

function getWebPendingApprovals() {
  if (Platform.OS !== 'web') return [];
  try {
    const data = localStorage.getItem(WEB_PENDING_APPROVALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveWebPendingApprovals(approvals) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(WEB_PENDING_APPROVALS_KEY, JSON.stringify(approvals));
  } catch (error) {
    console.error('Erro ao salvar aprovações pendentes no localStorage:', error);
  }
}

