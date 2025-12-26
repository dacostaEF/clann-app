/**
 * ApprovalExecutor - Sistema de Execução Automática de Ações Aprovadas
 * Sprint 7 - Governança - ETAPA 5
 * 
 * Executa automaticamente ações quando recebem aprovações suficientes
 * Integra com RulesEngine, CouncilManager e outros módulos
 */

import { Platform } from 'react-native';
import { APPROVAL_ACTIONS, APPROVAL_STATUS } from './ApprovalEngine';
import { createRule, editRule, deleteRule } from './RulesEngine';
import { addElder, removeElder } from './CouncilManager';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import ClanStorage from './ClanStorage';

/**
 * Executa uma ação aprovada
 * @param {Object} approval - Objeto de aprovação completo
 * @returns {Promise<Object>} Resultado da execução
 */
export async function executeApprovedAction(approval) {
  if (!approval || approval.status !== APPROVAL_STATUS.APPROVED) {
    throw new Error('Aprovação não está aprovada ou não existe');
  }

  const { clan_id, action_type, action_data, requested_by } = approval;
  const actionData = typeof action_data === 'string' 
    ? JSON.parse(action_data) 
    : action_data;

  try {
    let result;

    switch (action_type) {
      case APPROVAL_ACTIONS.RULE_CREATE:
        result = await executeRuleCreate(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.RULE_EDIT:
        result = await executeRuleEdit(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.RULE_DELETE:
        result = await executeRuleDelete(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.COUNCIL_ELDER_ADD:
        result = await executeElderAdd(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.COUNCIL_ELDER_REMOVE:
        result = await executeElderRemove(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.MEMBER_PROMOTE:
        result = await executeMemberPromote(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.MEMBER_DEMOTE:
        result = await executeMemberDemote(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.MEMBER_REMOVE:
        result = await executeMemberRemove(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.CLAN_SETTINGS_CHANGE:
        result = await executeClanSettingsChange(clan_id, actionData, requested_by);
        break;

      case APPROVAL_ACTIONS.CUSTOM:
        result = await executeCustomAction(clan_id, actionData, requested_by);
        break;

      default:
        throw new Error(`Tipo de ação não suportado: ${action_type}`);
    }

    // Log da execução no SecurityLog (Sprint 8 - ETAPA 5)
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_executed',
        approvalId: approval.id,
        actionType: action_type,
        clanId: clan_id,
        executedBy: 'system',
        executedAt: Date.now(),
        result
      },
      requested_by
    );

    // Marca como executado no banco (Sprint 8 - ETAPA 5)
    const db = ClanStorage.getDB();
    const executedAt = Date.now();
    
    if (Platform.OS === 'web' || !db) {
      // Web: atualiza localStorage
      const WEB_PENDING_APPROVALS_KEY = 'clann_pending_approvals';
      try {
        const data = localStorage.getItem(WEB_PENDING_APPROVALS_KEY);
        const approvals = data ? JSON.parse(data) : [];
        const index = approvals.findIndex(a => a.id === approval.id);
        if (index !== -1) {
          approvals[index].executed = true;
          approvals[index].executed_at = executedAt;
          approvals[index].status = APPROVAL_STATUS.APPROVED; // Garante status correto
          localStorage.setItem(WEB_PENDING_APPROVALS_KEY, JSON.stringify(approvals));
        }
      } catch (error) {
        console.error('Erro ao marcar aprovação como executada (web):', error);
      }
    } else {
      // SQLite: atualiza banco
      return new Promise((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            `UPDATE pending_approvals 
             SET executed = 1, executed_at = ?, status = ? 
             WHERE id = ?;`,
            [executedAt, APPROVAL_STATUS.APPROVED, approval.id],
            () => {
              resolve({
                success: true,
                actionType: action_type,
                result,
                executedAt
              });
            },
            (_, err) => {
              console.error('Erro ao marcar aprovação como executada:', err);
              // Ainda retorna sucesso, pois a ação foi executada
              resolve({
                success: true,
                actionType: action_type,
                result,
                executedAt
              });
            }
          );
        });
      });
    }

    return {
      success: true,
      actionType: action_type,
      result,
      executedAt
    };
  } catch (error) {
    console.error('Erro ao executar ação aprovada:', error);

    // Log do erro
    await logSecurityEvent(
      SECURITY_EVENTS.CLAN_UPDATED,
      {
        type: 'approval_execution_failed',
        approvalId: approval.id,
        actionType: action_type,
        clanId: clan_id,
        error: error.message
      },
      requested_by
    );

    throw error;
  }
}

/**
 * Executa criação de regra
 */
async function executeRuleCreate(clanId, actionData, requestedBy) {
  const { text, category, templateId } = actionData;
  
  if (!text) {
    throw new Error('Texto da regra é obrigatório');
  }

  const rule = await createRule(
    clanId,
    text,
    category || null,
    templateId || null,
    requestedBy
  );

  return {
    ruleId: rule.rule_id,
    message: 'Regra criada com sucesso'
  };
}

/**
 * Executa edição de regra
 */
async function executeRuleEdit(clanId, actionData, requestedBy) {
  const { ruleId, newText } = actionData;
  
  if (!ruleId || !newText) {
    throw new Error('ID da regra e novo texto são obrigatórios');
  }

  const rule = await editRule(ruleId, newText, requestedBy);

  return {
    ruleId: rule.rule_id,
    message: 'Regra editada com sucesso'
  };
}

/**
 * Executa exclusão de regra
 */
async function executeRuleDelete(clanId, actionData, requestedBy) {
  const { ruleId } = actionData;
  
  if (!ruleId) {
    throw new Error('ID da regra é obrigatório');
  }

  await deleteRule(ruleId, requestedBy);

  return {
    ruleId,
    message: 'Regra excluída com sucesso'
  };
}

/**
 * Executa adição de ancião
 */
async function executeElderAdd(clanId, actionData, requestedBy) {
  const { newElderTotem } = actionData;
  
  if (!newElderTotem) {
    throw new Error('Totem do novo ancião é obrigatório');
  }

  // Adiciona sem requerer aprovação (já foi aprovado)
  const council = await addElder(clanId, newElderTotem, requestedBy, false);

  return {
    elderTotem: newElderTotem,
    message: 'Ancião adicionado com sucesso'
  };
}

/**
 * Executa remoção de ancião
 */
async function executeElderRemove(clanId, actionData, requestedBy) {
  const { elderTotem } = actionData;
  
  if (!elderTotem) {
    throw new Error('Totem do ancião é obrigatório');
  }

  // Remove sem requerer aprovação (já foi aprovado)
  const council = await removeElder(clanId, elderTotem, requestedBy, false);

  return {
    elderTotem,
    message: 'Ancião removido com sucesso'
  };
}

/**
 * Executa promoção de membro
 */
async function executeMemberPromote(clanId, actionData, requestedBy) {
  const { memberTotem, newRole } = actionData;
  
  if (!memberTotem || !newRole) {
    throw new Error('Totem do membro e novo role são obrigatórios');
  }

  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const members = ClanStorage.getWebMembers();
    const index = members.findIndex(
      m => m.clan_id === parseInt(clanId) && m.totem_id === memberTotem
    );

    if (index === -1) {
      throw new Error('Membro não encontrado');
    }

    members[index].role = newRole;
    ClanStorage.saveWebMembers(members);

    return {
      memberTotem,
      newRole,
      message: 'Membro promovido com sucesso'
    };
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE clan_members SET role = ? WHERE clan_id = ? AND totem_id = ?;`,
        [newRole, clanId, memberTotem],
        () => {
          resolve({
            memberTotem,
            newRole,
            message: 'Membro promovido com sucesso'
          });
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Executa rebaixamento de membro
 */
async function executeMemberDemote(clanId, actionData, requestedBy) {
  const { memberTotem, newRole } = actionData;
  
  if (!memberTotem || !newRole) {
    throw new Error('Totem do membro e novo role são obrigatórios');
  }

  return await executeMemberPromote(clanId, { memberTotem, newRole }, requestedBy);
}

/**
 * Executa remoção de membro
 */
async function executeMemberRemove(clanId, actionData, requestedBy) {
  const { memberTotem } = actionData;
  
  if (!memberTotem) {
    throw new Error('Totem do membro é obrigatório');
  }

  await ClanStorage.leaveClan(clanId, memberTotem);

  return {
    memberTotem,
    message: 'Membro removido com sucesso'
  };
}

/**
 * Executa alteração de configurações do CLANN
 */
async function executeClanSettingsChange(clanId, actionData, requestedBy) {
  const { settings } = actionData;
  
  if (!settings || typeof settings !== 'object') {
    throw new Error('Configurações são obrigatórias');
  }

  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const clans = ClanStorage.getWebClans();
    const index = clans.findIndex(c => c.id === parseInt(clanId));

    if (index === -1) {
      throw new Error('CLANN não encontrado');
    }

    clans[index] = {
      ...clans[index],
      ...settings
    };
    ClanStorage.saveWebClans(clans);

    return {
      settings,
      message: 'Configurações atualizadas com sucesso'
    };
  }

  // Para SQLite, atualiza campos específicos
  const updateFields = [];
  const updateValues = [];

  if (settings.name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(settings.name);
  }
  if (settings.description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(settings.description);
  }
  if (settings.privacy !== undefined) {
    updateFields.push('privacy = ?');
    updateValues.push(settings.privacy);
  }

  if (updateFields.length === 0) {
    throw new Error('Nenhuma configuração válida fornecida');
  }

  updateValues.push(clanId);

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE clans SET ${updateFields.join(', ')} WHERE id = ?;`,
        updateValues,
        () => {
          resolve({
            settings,
            message: 'Configurações atualizadas com sucesso'
          });
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Executa ação personalizada
 */
async function executeCustomAction(clanId, actionData, requestedBy) {
  // Ações personalizadas podem ser implementadas conforme necessário
  // Por enquanto, apenas loga
  return {
    actionData,
    message: 'Ação personalizada executada'
  };
}

/**
 * Verifica e executa aprovações pendentes que foram aprovadas
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Array>} Lista de ações executadas
 */
export async function checkAndExecuteApprovedActions(clanId) {
  const { getPendingApprovals } = await import('./ApprovalEngine');
  const db = ClanStorage.getDB();
  const executed = [];

  // Busca aprovações aprovadas que ainda não foram executadas
  const allApprovals = await getPendingApprovals(clanId);
  const approved = allApprovals.filter(
      a => a.status === APPROVAL_STATUS.APPROVED &&
           !a.executed
    );

  if (Platform.OS === 'web' || !db) {
    // Na Web, usa localStorage diretamente
    const WEB_PENDING_APPROVALS_KEY = 'clann_pending_approvals';
    let approvals = [];
    try {
      const data = localStorage.getItem(WEB_PENDING_APPROVALS_KEY);
      approvals = data ? JSON.parse(data) : [];
    } catch {
      approvals = [];
    }
    
    for (const approval of approved) {
      try {
        await executeApprovedAction(approval);
        
        // Marca como executado
        const index = approvals.findIndex(a => a.id === approval.id);
        if (index !== -1) {
          approvals[index].executed = true;
          approvals[index].executed_at = Date.now();
        }
        
        executed.push(approval);
      } catch (error) {
        console.error(`Erro ao executar aprovação ${approval.id}:`, error);
      }
    }

    // Salva de volta
    try {
      localStorage.setItem(WEB_PENDING_APPROVALS_KEY, JSON.stringify(approvals));
    } catch (error) {
      console.error('Erro ao salvar aprovações:', error);
    }
    
    return executed;
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM pending_approvals 
         WHERE clan_id = ? AND status = ? AND executed = 0;`,
        [clanId, APPROVAL_STATUS.APPROVED],
        async (_, { rows }) => {
          const approvals = rows._array;

          for (const approval of approvals) {
            try {
              const parsedApproval = {
                ...approval,
                action_data: approval.action_data ? JSON.parse(approval.action_data) : null,
                approvals: approval.approvals ? JSON.parse(approval.approvals) : [],
                rejections: approval.rejections ? JSON.parse(approval.rejections) : []
              };

              const executionResult = await executeApprovedAction(parsedApproval);
              
              // Marca como executado (já feito dentro de executeApprovedAction, mas garante aqui também)
              const executedAt = Date.now();
              tx.executeSql(
                `UPDATE pending_approvals SET executed = 1, executed_at = ?, status = ? WHERE id = ?;`,
                [executedAt, APPROVAL_STATUS.APPROVED, approval.id],
                () => {},
                (_, err) => console.error('Erro ao marcar como executado:', err)
              );

              executed.push({
                ...approval,
                executed: true,
                executed_at: executedAt
              });
            } catch (error) {
              console.error(`Erro ao executar aprovação ${approval.id}:`, error);
            }
          }

          resolve(executed);
        },
        (_, err) => reject(err)
      );
    });
  });
}


