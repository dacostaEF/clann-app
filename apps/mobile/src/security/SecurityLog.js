/**
 * SecurityLog - Sistema de Auditoria Hash-Chain
 * Sprint 7 - ETAPA 3: Auditoria Hash-Chain (Security Log)
 * 
 * Cria um log de segurança imutável estilo blockchain interno
 * Cada ação no CLANN deixa rastro assinado e imutável
 */

import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';

/**
 * Tipos de eventos que podem ser registrados
 */
export const SECURITY_EVENTS = {
  // CLANN Events
  CLAN_CREATED: 'clan_created',
  CLAN_UPDATED: 'clan_updated',
  CLAN_DELETED: 'clan_deleted',
  
  // Member Events
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  MEMBER_ROLE_CHANGED: 'member_role_changed',
  MEMBER_REMOVED: 'member_removed',
  
  // Message Events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  
  // Security Events
  DEVICE_LINKED: 'device_linked',
  DEVICE_UNLINKED: 'device_unlinked',
  PANIC_MODE_ACTIVATED: 'panic_mode_activated',
  KEY_REGENERATED: 'key_regenerated',
  
  // Admin Events
  ADMIN_PROMOTED: 'admin_promoted',
  ADMIN_DEMOTED: 'admin_demoted',
};

/**
 * Calcula hash do evento usando hash-chain
 * Fórmula: hash = SHA256(event + timestamp + actor + prev_hash)
 * @param {string} event - Tipo de evento
 * @param {number} timestamp - Timestamp do evento
 * @param {string} actorTotem - Totem que executou a ação
 * @param {string|null} prevHash - Hash do evento anterior
 * @returns {string} Hash em hexadecimal
 */
function calculateEventHash(event, timestamp, actorTotem, prevHash = null) {
  // Constrói string para hash
  const hashInput = `${event}:${timestamp}:${actorTotem}:${prevHash || ''}`;
  
  // Calcula SHA256
  const hashBytes = sha256(new TextEncoder().encode(hashInput));
  
  // Retorna em hexadecimal
  return Buffer.from(hashBytes).toString('hex');
}

/**
 * Registra um evento de segurança no log com hash-chain
 * @param {string} event - Tipo de evento (use SECURITY_EVENTS)
 * @param {Object} details - Detalhes adicionais do evento (será convertido para JSON)
 * @param {string|null} actorTotem - Totem que executou a ação (null = usa totem atual)
 * @returns {Promise<Object>} Evento registrado com hash
 */
export async function logSecurityEvent(event, details = {}, actorTotem = null) {
  try {
    // Obtém totem atual se não fornecido
    if (!actorTotem) {
      actorTotem = await getCurrentTotemId();
      if (!actorTotem) {
        throw new Error('Totem não encontrado');
      }
    }

    // Obtém último evento para pegar prev_hash
    const lastEvent = await ClanStorage.getLastSecurityLogEvent();
    const prevHash = lastEvent ? lastEvent.hash : null;

    // Calcula timestamp
    const timestamp = Date.now();

    // Calcula hash do evento
    const hash = calculateEventHash(event, timestamp, actorTotem, prevHash);

    // Converte details para JSON string
    const detailsJson = details ? JSON.stringify(details) : null;

    // Salva no banco
    const eventId = await ClanStorage.addSecurityLogEvent(
      event,
      actorTotem,
      hash,
      prevHash,
      detailsJson
    );

    return {
      id: eventId,
      event,
      actorTotem,
      timestamp,
      prevHash,
      hash,
      details
    };
  } catch (error) {
    console.error('Erro ao registrar evento de segurança:', error);
    throw new Error(`Erro ao registrar evento: ${error.message}`);
  }
}

/**
 * Busca eventos do log de segurança
 * @param {number} limit - Limite de eventos (padrão: 100)
 * @param {number} offset - Offset para paginação
 * @returns {Promise<Array>} Lista de eventos
 */
export async function getSecurityLogEvents(limit = 100, offset = 0) {
  try {
    const events = await ClanStorage.getSecurityLogEvents(limit, offset);
    
    // Parse details JSON
    return events.map(event => ({
      ...event,
      details: event.details ? JSON.parse(event.details) : null
    }));
  } catch (error) {
    console.error('Erro ao buscar eventos de segurança:', error);
    return [];
  }
}

/**
 * Verifica integridade da hash-chain
 * @returns {Promise<Object>} Resultado da verificação
 */
export async function verifyLogIntegrity() {
  try {
    return await ClanStorage.verifySecurityLogIntegrity();
  } catch (error) {
    console.error('Erro ao verificar integridade:', error);
    return {
      valid: false,
      errors: [{ message: `Erro: ${error.message}` }],
      totalEvents: 0
    };
  }
}

/**
 * Busca eventos por tipo
 * @param {string} eventType - Tipo de evento
 * @param {number} limit - Limite de eventos
 * @returns {Promise<Array>} Lista de eventos filtrados
 */
export async function getEventsByType(eventType, limit = 50) {
  try {
    const allEvents = await getSecurityLogEvents(1000, 0);
    return allEvents
      .filter(event => event.event === eventType)
      .slice(0, limit);
  } catch (error) {
    console.error('Erro ao buscar eventos por tipo:', error);
    return [];
  }
}

/**
 * Busca eventos por Totem
 * @param {string} totemId - ID do Totem
 * @param {number} limit - Limite de eventos
 * @returns {Promise<Array>} Lista de eventos do Totem
 */
export async function getEventsByTotem(totemId, limit = 50) {
  try {
    const allEvents = await getSecurityLogEvents(1000, 0);
    return allEvents
      .filter(event => event.actor_totem === totemId)
      .slice(0, limit);
  } catch (error) {
    console.error('Erro ao buscar eventos por Totem:', error);
    return [];
  }
}

/**
 * Obtém estatísticas do log
 * @returns {Promise<Object>} Estatísticas do log
 */
export async function getLogStatistics() {
  try {
    const events = await getSecurityLogEvents(10000, 0);
    
    // Conta eventos por tipo
    const eventsByType = {};
    events.forEach(event => {
      eventsByType[event.event] = (eventsByType[event.event] || 0) + 1;
    });

    // Conta eventos por Totem
    const eventsByTotem = {};
    events.forEach(event => {
      eventsByTotem[event.actor_totem] = (eventsByTotem[event.actor_totem] || 0) + 1;
    });

    // Evento mais recente
    const lastEvent = events.length > 0 ? events[0] : null;

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByTotem,
      lastEvent,
      firstEvent: events.length > 0 ? events[events.length - 1] : null
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsByTotem: {},
      lastEvent: null,
      firstEvent: null
    };
  }
}

