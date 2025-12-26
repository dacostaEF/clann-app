/**
 * GovernanceStats - Sistema de Estatísticas de Governança
 * Sprint 7 - Governança - ETAPA 6
 * 
 * Calcula métricas e estatísticas sobre a governança do CLANN
 */

import { Platform } from 'react-native';
import { getRules, getActiveRules } from './RulesEngine';
import { getPendingApprovals, APPROVAL_STATUS } from './ApprovalEngine';
import { getCouncil } from './CouncilManager';
import { getSecurityLogEvents } from '../security/SecurityLog';
import ClanStorage from './ClanStorage';
import { RULE_CATEGORIES } from './RuleTemplates';

/**
 * Obtém estatísticas completas de governança do CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Object>} Estatísticas completas
 */
export async function getGovernanceStats(clanId) {
  try {
    const [
      rulesStats,
      approvalsStats,
      councilStats,
      activityStats
    ] = await Promise.all([
      getRulesStats(clanId),
      getApprovalsStats(clanId),
      getCouncilStats(clanId),
      getActivityStats(clanId)
    ]);

    return {
      rules: rulesStats,
      approvals: approvalsStats,
      council: councilStats,
      activity: activityStats,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return {
      rules: {},
      approvals: {},
      council: {},
      activity: {},
      error: error.message
    };
  }
}

/**
 * Estatísticas de regras
 */
async function getRulesStats(clanId) {
  try {
    const allRules = await getRules(clanId);
    const activeRules = await getActiveRules(clanId);

    // Contagem por categoria
    const byCategory = {};
    Object.keys(RULE_CATEGORIES).forEach(cat => {
      byCategory[cat] = allRules.filter(r => r.category === cat).length;
    });

    // Regras pendentes de aprovação
    const pendingRules = allRules.filter(r => {
      const approvals = JSON.parse(r.approved_by || '[]');
      return (r.enabled === 0 || r.enabled === false) && approvals.length < 2;
    });

    // Versões médias
    const avgVersion = allRules.length > 0
      ? allRules.reduce((sum, r) => sum + (r.version || 1), 0) / allRules.length
      : 0;

    return {
      total: allRules.length,
      active: activeRules.length,
      pending: pendingRules.length,
      inactive: allRules.length - activeRules.length - pendingRules.length,
      byCategory,
      averageVersion: Math.round(avgVersion * 10) / 10,
      lastUpdated: allRules.length > 0
        ? Math.max(...allRules.map(r => r.created_at || 0))
        : null
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas de regras:', error);
    return {
      total: 0,
      active: 0,
      pending: 0,
      inactive: 0,
      byCategory: {},
      averageVersion: 0,
      lastUpdated: null
    };
  }
}

/**
 * Estatísticas de aprovações
 */
async function getApprovalsStats(clanId) {
  try {
    const allApprovals = await getPendingApprovals(clanId);
    
    const pending = allApprovals.filter(a => a.status === APPROVAL_STATUS.PENDING);
    const approved = allApprovals.filter(a => a.status === APPROVAL_STATUS.APPROVED);
    const rejected = allApprovals.filter(a => a.status === APPROVAL_STATUS.REJECTED);
    const executed = allApprovals.filter(a => a.executed === 1 || a.executed === true);

    // Taxa de aprovação
    const totalDecided = approved.length + rejected.length;
    const approvalRate = totalDecided > 0
      ? (approved.length / totalDecided) * 100
      : 0;

    // Tempo médio de aprovação (em horas)
    const approvedWithTime = approved.filter(a => a.created_at && a.executed_at);
    const avgApprovalTime = approvedWithTime.length > 0
      ? approvedWithTime.reduce((sum, a) => {
          const timeDiff = a.executed_at - a.created_at;
          return sum + (timeDiff / (1000 * 60 * 60)); // Converter para horas
        }, 0) / approvedWithTime.length
      : 0;

    // Distribuição por tipo de ação
    const byActionType = {};
    allApprovals.forEach(a => {
      byActionType[a.action_type] = (byActionType[a.action_type] || 0) + 1;
    });

    // Aprovações recentes (últimas 7 dias)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentApprovals = allApprovals.filter(
      a => a.created_at && a.created_at >= sevenDaysAgo
    );

    return {
      total: allApprovals.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      executed: executed.length,
      approvalRate: Math.round(approvalRate * 10) / 10,
      averageApprovalTimeHours: Math.round(avgApprovalTime * 10) / 10,
      byActionType,
      recent: recentApprovals.length,
      lastApproval: approved.length > 0
        ? Math.max(...approved.map(a => a.created_at || 0))
        : null
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas de aprovações:', error);
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      executed: 0,
      approvalRate: 0,
      averageApprovalTimeHours: 0,
      byActionType: {},
      recent: 0,
      lastApproval: null
    };
  }
}

/**
 * Estatísticas do conselho
 */
async function getCouncilStats(clanId) {
  try {
    const council = await getCouncil(clanId);
    
    if (!council) {
      return {
        exists: false,
        totalElders: 0,
        approvalsRequired: 0,
        distribution: {}
      };
    }

    const elders = council.elders || [];
    const members = await getClanMembers(clanId);
    const totalMembers = members.length;

    // Distribuição de poder (percentual de anciões)
    const elderPercentage = totalMembers > 0
      ? (elders.length / totalMembers) * 100
      : 0;

    // Verifica se fundador está no conselho
    const founderInCouncil = elders.includes(council.founder_totem);

    return {
      exists: true,
      totalElders: elders.length,
      approvalsRequired: council.approvals_required || 2,
      elderPercentage: Math.round(elderPercentage * 10) / 10,
      founderInCouncil,
      totalMembers,
      councilSize: elders.length
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas do conselho:', error);
    return {
      exists: false,
      totalElders: 0,
      approvalsRequired: 0,
      distribution: {}
    };
  }
}

/**
 * Estatísticas de atividade
 */
async function getActivityStats(clanId) {
  try {
    // Busca eventos recentes do Security Log relacionados ao CLANN
    const allEvents = await getSecurityLogEvents(500, 0);
    
    // Filtra eventos relacionados à governança
    const governanceEvents = allEvents.filter(e => {
      const details = e.details ? (typeof e.details === 'string' ? JSON.parse(e.details) : e.details) : {};
      return details.clanId === parseInt(clanId) || 
             details.clan_id === parseInt(clanId) ||
             e.event.includes('clan') ||
             e.event.includes('approval') ||
             e.event.includes('rule') ||
             e.event.includes('council');
    });

    // Eventos por tipo
    const byEventType = {};
    governanceEvents.forEach(e => {
      byEventType[e.event] = (byEventType[e.event] || 0) + 1;
    });

    // Atividade recente (últimos 7 dias)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentActivity = governanceEvents.filter(
      e => e.timestamp && e.timestamp >= sevenDaysAgo
    );

    // Atividade por dia (últimos 7 dias)
    const activityByDay = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      activityByDay[dayKey] = governanceEvents.filter(e => {
        if (!e.timestamp) return false;
        const eventDate = new Date(e.timestamp);
        return eventDate.toISOString().split('T')[0] === dayKey;
      }).length;
    }

    return {
      totalEvents: governanceEvents.length,
      recentEvents: recentActivity.length,
      byEventType,
      activityByDay,
      lastEvent: governanceEvents.length > 0
        ? Math.max(...governanceEvents.map(e => e.timestamp || 0))
        : null
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas de atividade:', error);
    return {
      totalEvents: 0,
      recentEvents: 0,
      byEventType: {},
      activityByDay: {},
      lastEvent: null
    };
  }
}

/**
 * Obtém membros do CLANN (helper)
 */
async function getClanMembers(clanId) {
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const members = ClanStorage.getWebMembers();
    return members.filter(m => m.clan_id === parseInt(clanId));
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT totem_id, role, joined_at FROM clan_members WHERE clan_id = ?;`,
        [clanId],
        (_, { rows }) => resolve(rows._array),
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém resumo rápido de estatísticas (para exibição em cards)
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Object>} Resumo das estatísticas
 */
export async function getQuickStats(clanId) {
  try {
    const stats = await getGovernanceStats(clanId);
    
    return {
      rules: {
        total: stats.rules.total,
        active: stats.rules.active,
        pending: stats.rules.pending
      },
      approvals: {
        total: stats.approvals.total,
        pending: stats.approvals.pending,
        approvalRate: stats.approvals.approvalRate
      },
      council: {
        elders: stats.council.totalElders,
        exists: stats.council.exists
      },
      activity: {
        recent: stats.activity.recentEvents,
        total: stats.activity.totalEvents
      }
    };
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    return {
      rules: { total: 0, active: 0, pending: 0 },
      approvals: { total: 0, pending: 0, approvalRate: 0 },
      council: { elders: 0, exists: false },
      activity: { recent: 0, total: 0 }
    };
  }
}

