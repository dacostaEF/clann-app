/**
 * Serviço de lógica de negócio para CLANNs
 * Validações e criação de CLANNs
 * 
 * NÃO implementa chat, tribunal, votação ou níveis.
 */

import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '../utils/randomBytes';

/**
 * Gera um ID único para o CLANN
 * @returns {string} ID do CLANN (16 caracteres hex)
 */
function generateClanId() {
  const random = randomBytes(16);
  const hash = sha256(random);
  return Buffer.from(hash).toString('hex').substring(0, 16);
}

/**
 * Gera um código de convite único (6 caracteres alfanuméricos)
 * @returns {string} Código de convite
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const random = randomBytes(6);
  
  for (let i = 0; i < 6; i++) {
    code += chars[random[i] % chars.length];
  }
  
  return code;
}

/**
 * Valida dados de criação de CLANN
 * @param {Object} data - Dados do CLANN
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateClan(data) {
  const errors = [];

  // Verifica campos obrigatórios
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Nome do CLANN é obrigatório');
  } else {
    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) {
      errors.push('Nome do CLANN não pode estar vazio');
    } else if (trimmedName.length > 50) {
      errors.push('Nome do CLANN não pode ter mais de 50 caracteres');
    }
  }

  // Valida máximo de membros
  if (typeof data.maxMembers !== 'number') {
    errors.push('Máximo de membros deve ser um número');
  } else if (data.maxMembers < 2) {
    errors.push('Máximo de membros deve ser pelo menos 2');
  } else if (data.maxMembers > 100) {
    errors.push('Máximo de membros não pode ser maior que 100');
  }

  // Valida privacidade
  if (data.isPrivate !== undefined && typeof data.isPrivate !== 'boolean') {
    errors.push('Privacidade deve ser um booleano');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Cria um novo objeto CLANN
 * @param {Object} data - Dados do CLANN
 * @param {string} creatorTotemId - ID do Totem do criador
 * @returns {Object} Objeto CLANN completo
 */
export function createClan(data, creatorTotemId) {
  // Valida dados
  const validation = validateClan(data);
  if (!validation.valid) {
    throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
  }

  // Gera ID e código de convite
  const clanId = generateClanId();
  const inviteCode = generateInviteCode();

  // Cria objeto CLANN
  const clan = {
    clanId,
    name: data.name.trim(),
    description: data.description || '',
    inviteCode,
    creatorTotemId,
    maxMembers: data.maxMembers || 10,
    isPrivate: data.isPrivate !== undefined ? data.isPrivate : false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    members: [
      {
        totemId: creatorTotemId,
        role: 'founder',
        joinedAt: Date.now(),
      },
    ],
    memberCount: 1,
  };

  return clan;
}

/**
 * Valida código de convite
 * @param {string} code - Código de convite
 * @returns {boolean} True se válido
 */
export function validateInviteCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Código deve ter exatamente 6 caracteres alfanuméricos
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
}

/**
 * Tenta juntar-se a um CLANN usando código de convite
 * @param {string} code - Código de convite
 * @param {string} totemId - ID do Totem do usuário
 * @returns {Promise<Object>} CLANN encontrado ou erro
 */
export async function joinClan(code, totemId) {
  // Valida código
  if (!validateInviteCode(code)) {
    throw new Error('Código de convite inválido');
  }

  if (!totemId) {
    throw new Error('ID do Totem é obrigatório');
  }

  // Busca CLANN no storage
  const { getClanByInviteCode } = await import('./clanStorage');
  const clan = await getClanByInviteCode(code.toUpperCase());

  if (!clan) {
    throw new Error('CLANN não encontrado com este código de convite');
  }

  // Verifica se já é membro
  const isMember = clan.members.some((m) => m.totemId === totemId);
  if (isMember) {
    throw new Error('Você já é membro deste CLANN');
  }

  // Verifica se há espaço
  if (clan.memberCount >= clan.maxMembers) {
    throw new Error('CLANN está cheio');
  }

  return clan;
}

