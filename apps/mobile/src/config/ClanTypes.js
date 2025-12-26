/**
 * Tipos e constantes para CLANNs
 * Dose 1 - Sprint 3
 */

// Tipos e constantes para CLANNs

export const CLAN_ROLES = {
  FOUNDER: 'founder',
  ADMIN: 'admin',
  MEMBER: 'member'
};

export const DEFAULT_CLAN_ICONS = [
  '🛡️', '⚔️', '🏹', '🐺', '🦅', '🐉', '🦂', '🌙',
  '☀️', '🔥', '💧', '🌪️', '🌳', '⚡', '❄️', '💀'
];

export const CLAN_PRIVACY = {
  PRIVATE: 'private',
  PUBLIC: 'public'
};

// Validações

export const validateClanName = (name) => {
  if (!name || name.trim().length < 3) {
    return 'Nome muito curto (mínimo 3 caracteres)';
  }
  if (name.length > 30) {
    return 'Nome muito longo (máximo 30 caracteres)';
  }
  return null;
};

export const validateClanDescription = (desc) => {
  if (desc && desc.length > 200) {
    return 'Descrição muito longa (máximo 200 caracteres)';
  }
  return null;
};

