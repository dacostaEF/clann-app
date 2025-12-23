/**
 * index.js - PONTO DE ENTRADA ÚNICO
 * 
 * 📦 MÓDULO GATEWAY CLANN - FASE 2
 * 
 * Arquitetura refatorada com:
 * - Factory pattern (não singleton rígido)
 * - Documentação explícita de limitações
 * - Validações de segurança em runtime
 * - Preparação para evolução (Fase 3+)
 */

import { GatewayClient } from './GatewayClient';
import { gatewayFactory } from './gatewayFactory';
import {
  ARCHITECTURE_LIMITATIONS,
  DEFAULT_CONFIG,
  ERROR_CODES,
  GATEWAY_EVENTS,
  DEFAULT_GATEWAY_URL,
  RECONNECTION_CONFIG,
  PING_INTERVAL,
  CONNECTION_TIMEOUT,
  MESSAGE_TYPES,
  DELIVERY_STATUS,
} from './gatewayConstants';
import { GatewayValidators, SECURITY_PRINCIPLES } from './GatewayValidators';

// Exportar tudo com nomes claros
export {
  // Classe principal
  GatewayClient,

  // Factory para gerenciamento
  gatewayFactory,

  // Constantes e documentação
  ARCHITECTURE_LIMITATIONS,
  DEFAULT_CONFIG,
  ERROR_CODES,
  GATEWAY_EVENTS,
  DEFAULT_GATEWAY_URL,
  RECONNECTION_CONFIG,
  PING_INTERVAL,
  CONNECTION_TIMEOUT,
  MESSAGE_TYPES,
  DELIVERY_STATUS,

  // Validações de segurança
  GatewayValidators,
  SECURITY_PRINCIPLES,
};

// Helper para uso comum (transição)
export function createGatewayClient(options = {}) {
  console.log('🔧 Criando GatewayClient com factory...');
  const client = gatewayFactory.createClient(options);
  return client;
}

// Helper para compatibilidade (DEPRECIADO - migrar para createGatewayClient)
export function getDefaultGatewayClient() {
  console.warn('⚠️ getDefaultGatewayClient() é depreciado - use createGatewayClient()');
  return gatewayFactory.getDefaultInstance();
}

// Log dos princípios de segurança ao importar
console.log(SECURITY_PRINCIPLES);
console.log('📦 Módulo Gateway CLANN carregado com validações de segurança');

