/**
 * RuleEnforcement - Sistema de Aplicação de Regras
 * Sprint 7 - Governança - ETAPA 3 (Enforcement)
 * 
 * Verifica e aplica regras automaticamente antes de permitir ações
 * Bloqueia ações que violam regras ativas
 */

import { getActiveRules } from './RulesEngine';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { isElder } from './CouncilManager';
import ClanStorage from './ClanStorage';

/**
 * Tipos de ações que podem ser verificadas
 */
export const ACTION_TYPES = {
  // Mensagens
  SEND_MESSAGE: 'send_message',
  EDIT_MESSAGE: 'edit_message',
  DELETE_MESSAGE: 'delete_message',
  
  // Membros
  JOIN_CLAN: 'join_clan',
  LEAVE_CLAN: 'leave_clan',
  INVITE_MEMBER: 'invite_member',
  REMOVE_MEMBER: 'remove_member',
  PROMOTE_MEMBER: 'promote_member',
  
  // Regras
  CREATE_RULE: 'create_rule',
  EDIT_RULE: 'edit_rule',
  DELETE_RULE: 'delete_rule',
  
  // Conselho
  ADD_ELDER: 'add_elder',
  REMOVE_ELDER: 'remove_elder',
  
  // Configurações
  CHANGE_SETTINGS: 'change_settings',
  CHANGE_PRIVACY: 'change_privacy',
  
  // Outros
  UPLOAD_FILE: 'upload_file',
  CREATE_EVENT: 'create_event',
  CREATE_POLL: 'create_poll'
};

/**
 * Resultado da verificação de enforcement
 */
export class EnforcementResult {
  constructor(allowed, reason = null, violatedRules = []) {
    this.allowed = allowed;
    this.reason = reason;
    this.violatedRules = violatedRules;
  }

  static allow() {
    return new EnforcementResult(true);
  }

  static deny(reason, violatedRules = []) {
    return new EnforcementResult(false, reason, violatedRules);
  }
}

/**
 * Verifica se uma ação é permitida pelas regras ativas
 * @param {number} clanId - ID do CLANN
 * @param {string} actionType - Tipo de ação (ACTION_TYPES)
 * @param {Object} context - Contexto da ação (user, target, data, etc)
 * @returns {Promise<EnforcementResult>} Resultado da verificação
 */
export async function checkAction(clanId, actionType, context = {}) {
  try {
    const activeRules = await getActiveRules(clanId);
    
    if (!activeRules || activeRules.length === 0) {
      // Sem regras ativas, permite tudo
      return EnforcementResult.allow();
    }

    const violatedRules = [];
    const { userTotem, userRole, targetTotem, targetRole, data } = context;

    // Verifica cada regra ativa
    for (const rule of activeRules) {
      const violation = await checkRuleViolation(rule, actionType, context);
      if (violation) {
        violatedRules.push({
          ruleId: rule.rule_id,
          ruleText: rule.text,
          violation
        });
      }
    }

    // Se houver violações, nega a ação
    if (violatedRules.length > 0) {
      const reason = `Ação bloqueada por ${violatedRules.length} regra(s) ativa(s)`;
      
      // Log da violação
      await logSecurityEvent(
        SECURITY_EVENTS.CLAN_UPDATED,
        {
          type: 'rule_violation',
          clanId,
          actionType,
          violatedRules: violatedRules.map(v => v.ruleId),
          userTotem,
          context
        },
        userTotem
      );

      return EnforcementResult.deny(reason, violatedRules);
    }

    return EnforcementResult.allow();
  } catch (error) {
    console.error('Erro ao verificar enforcement:', error);
    // Em caso de erro, permite a ação (fail-open para não bloquear o sistema)
    return EnforcementResult.allow();
  }
}

/**
 * Verifica se uma regra específica é violada por uma ação
 * @param {Object} rule - Regra a verificar
 * @param {string} actionType - Tipo de ação
 * @param {Object} context - Contexto da ação
 * @returns {Promise<string|null>} Mensagem de violação ou null se não violar
 */
async function checkRuleViolation(rule, actionType, context) {
  const ruleText = rule.text.toLowerCase();
  const { userTotem, userRole, targetTotem, targetRole, data } = context;

  // Análise básica de palavras-chave na regra
  // Sistema pode ser expandido com parser mais sofisticado

  // Regras sobre mensagens
  if (actionType === ACTION_TYPES.SEND_MESSAGE) {
    if (ruleText.includes('proibido enviar mensagem') || 
        ruleText.includes('não pode enviar mensagem') ||
        ruleText.includes('bloqueado enviar')) {
      return 'Envio de mensagens está bloqueado por regra ativa';
    }

    // Verifica horário permitido
    if (ruleText.includes('horário') || ruleText.includes('horario')) {
      const now = new Date();
      const hour = now.getHours();
      // Exemplo: "mensagens apenas entre 9h e 18h"
      const hourMatch = ruleText.match(/(\d+)h.*(\d+)h/);
      if (hourMatch) {
        const startHour = parseInt(hourMatch[1]);
        const endHour = parseInt(hourMatch[2]);
        if (hour < startHour || hour > endHour) {
          return `Mensagens permitidas apenas entre ${startHour}h e ${endHour}h`;
        }
      }
    }

    // Verifica conteúdo proibido
    if (data?.messageText) {
      const messageLower = data.messageText.toLowerCase();
      if (ruleText.includes('palavras proibidas') || ruleText.includes('proibido usar')) {
        // Extrai palavras proibidas da regra (exemplo básico)
        const forbiddenWords = extractForbiddenWords(ruleText);
        for (const word of forbiddenWords) {
          if (messageLower.includes(word.toLowerCase())) {
            return `Palavra proibida detectada: "${word}"`;
          }
        }
      }
    }
  }

  // Regras sobre remoção de membros
  if (actionType === ACTION_TYPES.REMOVE_MEMBER) {
    if (ruleText.includes('proibido remover membro') ||
        ruleText.includes('não pode remover') ||
        ruleText.includes('proteção de membros')) {
      return 'Remoção de membros está bloqueada por regra ativa';
    }

    // Verifica se é ancião (proteção especial)
    if (targetTotem) {
      const isTargetElder = await isElder(context.clanId, targetTotem);
      if (isTargetElder && ruleText.includes('proteção anciões')) {
        return 'Anciões estão protegidos contra remoção';
      }
    }
  }

  // Regras sobre criação de regras
  if (actionType === ACTION_TYPES.CREATE_RULE) {
    if (ruleText.includes('apenas anciões podem criar regras') ||
        ruleText.includes('somente anciões criam regras')) {
      const isUserElder = await isElder(context.clanId, userTotem);
      if (!isUserElder && userRole !== 'founder') {
        return 'Apenas anciões podem criar regras';
      }
    }
  }

  // Regras sobre mudanças de configurações
  if (actionType === ACTION_TYPES.CHANGE_SETTINGS || 
      actionType === ACTION_TYPES.CHANGE_PRIVACY) {
    if (ruleText.includes('configurações bloqueadas') ||
        ruleText.includes('não pode alterar configurações')) {
      if (userRole !== 'founder') {
        return 'Alteração de configurações está bloqueada';
      }
    }
  }

  // Regras sobre upload de arquivos
  if (actionType === ACTION_TYPES.UPLOAD_FILE) {
    if (ruleText.includes('proibido upload') ||
        ruleText.includes('não pode enviar arquivo')) {
      return 'Upload de arquivos está bloqueado';
    }

    // Verifica tamanho máximo
    if (data?.fileSize && ruleText.includes('tamanho máximo')) {
      const sizeMatch = ruleText.match(/(\d+)\s*(mb|kb|gb)/i);
      if (sizeMatch) {
        const maxSize = parseInt(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        let maxBytes;
        if (unit === 'gb') maxBytes = maxSize * 1024 * 1024 * 1024;
        else if (unit === 'mb') maxBytes = maxSize * 1024 * 1024;
        else if (unit === 'kb') maxBytes = maxSize * 1024;
        
        if (data.fileSize > maxBytes) {
          return `Arquivo excede tamanho máximo permitido (${maxSize}${unit})`;
        }
      }
    }
  }

  // Regras baseadas em role
  if (ruleText.includes('apenas') || ruleText.includes('somente')) {
    if (ruleText.includes('fundador') && userRole !== 'founder') {
      return 'Ação restrita ao fundador';
    }
    if (ruleText.includes('admin') && userRole !== 'admin' && userRole !== 'founder') {
      return 'Ação restrita a administradores';
    }
    if (ruleText.includes('ancião') || ruleText.includes('elder')) {
      const isUserElder = await isElder(context.clanId, userTotem);
      if (!isUserElder && userRole !== 'founder') {
        return 'Ação restrita a anciões';
      }
    }
  }

  // Regras sobre frequência (rate limiting)
  if (ruleText.includes('limite') || ruleText.includes('máximo')) {
    // Pode ser implementado com cache de ações recentes
    // Por enquanto, apenas detecta a regra
  }

  return null; // Não violou a regra
}

/**
 * Extrai palavras proibidas de uma regra (parser básico)
 * @param {string} ruleText - Texto da regra
 * @returns {Array<string>} Lista de palavras proibidas
 */
function extractForbiddenWords(ruleText) {
  const words = [];
  
  // Procura por padrões como "palavras: X, Y, Z" ou "proibido: X Y Z"
  const patterns = [
    /palavras?\s*(proibidas?|bloqueadas?):\s*([^\.]+)/i,
    /proibido\s*(usar|dizer|escrever):\s*([^\.]+)/i,
    /não\s*(pode|pode-se)\s*(usar|dizer|escrever):\s*([^\.]+)/i
  ];

  for (const pattern of patterns) {
    const match = ruleText.match(pattern);
    if (match) {
      const wordsStr = match[match.length - 1];
      words.push(...wordsStr.split(/[,;]/).map(w => w.trim()).filter(w => w));
    }
  }

  return words;
}

/**
 * Aplica enforcement antes de uma ação (wrapper)
 * @param {number} clanId - ID do CLANN
 * @param {string} actionType - Tipo de ação
 * @param {Object} context - Contexto da ação
 * @param {Function} actionFn - Função da ação a executar
 * @returns {Promise<*>} Resultado da ação ou erro se bloqueado
 */
export async function enforceAndExecute(clanId, actionType, context, actionFn) {
  const result = await checkAction(clanId, actionType, context);
  
  if (!result.allowed) {
    const error = new Error(result.reason);
    error.violatedRules = result.violatedRules;
    error.enforcementBlocked = true;
    throw error;
  }

  // Se permitido, executa a ação
  return await actionFn();
}

/**
 * Obtém regras relevantes para um tipo de ação
 * @param {number} clanId - ID do CLANN
 * @param {string} actionType - Tipo de ação
 * @returns {Promise<Array>} Regras relevantes
 */
export async function getRelevantRules(clanId, actionType) {
  const activeRules = await getActiveRules(clanId);
  
  // Filtra regras que podem ser relevantes para a ação
  const relevantKeywords = {
    [ACTION_TYPES.SEND_MESSAGE]: ['mensagem', 'enviar', 'chat', 'comunicação'],
    [ACTION_TYPES.REMOVE_MEMBER]: ['membro', 'remover', 'expulsar', 'remover'],
    [ACTION_TYPES.CREATE_RULE]: ['regra', 'criar', 'governança'],
    [ACTION_TYPES.UPLOAD_FILE]: ['arquivo', 'upload', 'enviar arquivo'],
    [ACTION_TYPES.CHANGE_SETTINGS]: ['configuração', 'settings', 'alterar']
  };

  const keywords = relevantKeywords[actionType] || [];
  
  return activeRules.filter(rule => {
    const ruleText = rule.text.toLowerCase();
    return keywords.some(keyword => ruleText.includes(keyword));
  });
}

/**
 * Verifica se um usuário tem permissão baseada em regras
 * @param {number} clanId - ID do CLANN
 * @param {string} userTotem - Totem do usuário
 * @param {string} userRole - Role do usuário
 * @param {string} actionType - Tipo de ação
 * @returns {Promise<boolean>} Se tem permissão
 */
export async function hasPermission(clanId, userTotem, userRole, actionType) {
  const context = {
    userTotem,
    userRole,
    clanId
  };
  
  const result = await checkAction(clanId, actionType, context);
  return result.allowed;
}

