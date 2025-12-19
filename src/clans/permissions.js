/**
 * Sistema de Permissões - CLANN
 * Sprint 8 - ETAPA 2
 * 
 * Define e verifica permissões baseadas em roles
 * Matriz de permissões centralizada
 */

import { CLAN_ROLES } from '../config/ClanTypes';

/**
 * Constantes de permissões disponíveis
 */
export const PERMISSIONS = {
  // Regras
  MANAGE_RULES: 'manage_rules',           // Criar, editar, deletar regras
  APPROVE_RULES: 'approve_rules',         // Aprovar regras pendentes
  
  // Mensagens
  DELETE_MESSAGE: 'delete_message',        // Deletar mensagens (próprias ou de outros)
  DELETE_ANY_MESSAGE: 'delete_any_message', // Deletar qualquer mensagem (admin)
  
  // Conselho
  MANAGE_COUNCIL: 'manage_council',       // Adicionar/remover anciões
  VIEW_COUNCIL: 'view_council',           // Ver conselho
  
  // Governança
  VIEW_GOVERNANCE: 'view_governance',      // Acessar tela de governança
  APPROVE_ACTIONS: 'approve_actions',      // Aprovar ações pendentes
  
  // Admin
  ADMIN_TOOLS: 'admin_tools',             // Acessar ferramentas administrativas
  EXPORT_DATA: 'export_data',             // Exportar dados
  RESET_CLAN: 'reset_clan',               // Resetar CLANN
  
  // Membros
  INVITE_MEMBER: 'invite_member',         // Convidar membros
  REMOVE_MEMBER: 'remove_member',          // Remover membros
  PROMOTE_MEMBER: 'promote_member',       // Promover membros
};

/**
 * Matriz de permissões por role
 * FOUNDER tem todas as permissões
 * ADMIN tem permissões administrativas
 * MEMBER tem permissões básicas
 */
const PERMISSION_MATRIX = {
  [CLAN_ROLES.FOUNDER]: [
    // Todas as permissões
    PERMISSIONS.MANAGE_RULES,
    PERMISSIONS.APPROVE_RULES,
    PERMISSIONS.DELETE_MESSAGE,
    PERMISSIONS.DELETE_ANY_MESSAGE,
    PERMISSIONS.MANAGE_COUNCIL,
    PERMISSIONS.VIEW_COUNCIL,
    PERMISSIONS.VIEW_GOVERNANCE,
    PERMISSIONS.APPROVE_ACTIONS,
    PERMISSIONS.ADMIN_TOOLS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.RESET_CLAN,
    PERMISSIONS.INVITE_MEMBER,
    PERMISSIONS.REMOVE_MEMBER,
    PERMISSIONS.PROMOTE_MEMBER,
  ],
  
  [CLAN_ROLES.ADMIN]: [
    // Permissões administrativas (sem reset e algumas restrições)
    PERMISSIONS.MANAGE_RULES,
    PERMISSIONS.APPROVE_RULES,
    PERMISSIONS.DELETE_MESSAGE,
    PERMISSIONS.DELETE_ANY_MESSAGE,
    PERMISSIONS.VIEW_COUNCIL,
    PERMISSIONS.VIEW_GOVERNANCE,
    PERMISSIONS.APPROVE_ACTIONS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.INVITE_MEMBER,
    PERMISSIONS.REMOVE_MEMBER,
    PERMISSIONS.PROMOTE_MEMBER,
    // NÃO tem: MANAGE_COUNCIL, ADMIN_TOOLS, RESET_CLAN
  ],
  
  [CLAN_ROLES.MEMBER]: [
    // Permissões básicas
    PERMISSIONS.DELETE_MESSAGE, // Apenas próprias mensagens
    PERMISSIONS.VIEW_COUNCIL,
    PERMISSIONS.INVITE_MEMBER, // Pode convidar
    // NÃO tem: VIEW_GOVERNANCE, MANAGE_RULES, etc.
  ],
};

/**
 * Verifica se um role tem uma permissão específica
 * @param {string} role - Role do usuário (FOUNDER, ADMIN, MEMBER)
 * @param {string} permission - Permissão a verificar (PERMISSIONS.*)
 * @returns {boolean} True se tem permissão
 */
export function can(role, permission) {
  if (!role || !permission) {
    return false;
  }

  // FOUNDER tem todas as permissões
  if (role === CLAN_ROLES.FOUNDER) {
    return true;
  }

  // Busca permissões do role
  const rolePermissions = PERMISSION_MATRIX[role] || [];
  
  return rolePermissions.includes(permission);
}

/**
 * Verifica se é fundador
 * @param {string} role - Role do usuário
 * @returns {boolean} True se é fundador
 */
export function isFounder(role) {
  return role === CLAN_ROLES.FOUNDER;
}

/**
 * Verifica se é admin
 * @param {string} role - Role do usuário
 * @returns {boolean} True se é admin
 */
export function isAdmin(role) {
  return role === CLAN_ROLES.ADMIN;
}

/**
 * Verifica se é membro (qualquer role válido)
 * @param {string} role - Role do usuário
 * @returns {boolean} True se é membro
 */
export function isMember(role) {
  return role === CLAN_ROLES.FOUNDER || 
         role === CLAN_ROLES.ADMIN || 
         role === CLAN_ROLES.MEMBER;
}

/**
 * Verifica se pode deletar uma mensagem específica
 * @param {string} role - Role do usuário
 * @param {string} messageAuthorTotem - Totem do autor da mensagem
 * @param {string} currentTotemId - Totem do usuário atual
 * @returns {boolean} True se pode deletar
 */
export function canDeleteMessage(role, messageAuthorTotem, currentTotemId) {
  // Pode deletar se:
  // 1. É o autor da mensagem (qualquer role)
  // 2. É ADMIN ou FOUNDER (pode deletar qualquer mensagem)
  
  if (messageAuthorTotem === currentTotemId) {
    return true; // Pode deletar própria mensagem
  }
  
  return can(role, PERMISSIONS.DELETE_ANY_MESSAGE);
}

/**
 * Verifica se pode acessar governança
 * @param {string} role - Role do usuário
 * @returns {boolean} True se pode acessar
 */
export function canViewGovernance(role) {
  return can(role, PERMISSIONS.VIEW_GOVERNANCE);
}

/**
 * Verifica se pode gerenciar regras
 * @param {string} role - Role do usuário
 * @returns {boolean} True se pode gerenciar
 */
export function canManageRules(role) {
  return can(role, PERMISSIONS.MANAGE_RULES);
}

/**
 * Verifica se pode aprovar regras
 * @param {string} role - Role do usuário
 * @returns {boolean} True se pode aprovar
 */
export function canApproveRules(role) {
  return can(role, PERMISSIONS.APPROVE_RULES);
}

/**
 * Verifica se pode gerenciar conselho
 * @param {string} role - Role do usuário
 * @returns {boolean} True se pode gerenciar
 */
export function canManageCouncil(role) {
  return can(role, PERMISSIONS.MANAGE_COUNCIL);
}

/**
 * Verifica se pode usar ferramentas administrativas
 * @param {string} role - Role do usuário
 * @returns {boolean} True se pode usar
 */
export function canUseAdminTools(role) {
  return can(role, PERMISSIONS.ADMIN_TOOLS);
}

/**
 * Obtém todas as permissões de um role
 * @param {string} role - Role do usuário
 * @returns {Array<string>} Lista de permissões
 */
export function getRolePermissions(role) {
  if (!role) {
    return [];
  }
  
  return PERMISSION_MATRIX[role] || [];
}

/**
 * Verifica se role tem pelo menos uma das permissões
 * @param {string} role - Role do usuário
 * @param {Array<string>} permissions - Lista de permissões a verificar
 * @returns {boolean} True se tem pelo menos uma
 */
export function canAny(role, permissions) {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  
  return permissions.some(permission => can(role, permission));
}

/**
 * Verifica se role tem todas as permissões
 * @param {string} role - Role do usuário
 * @param {Array<string>} permissions - Lista de permissões a verificar
 * @returns {boolean} True se tem todas
 */
export function canAll(role, permissions) {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  
  return permissions.every(permission => can(role, permission));
}

