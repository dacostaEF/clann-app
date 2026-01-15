/**
 * GatewayConstants.js - CONSTANTES E DOCUMENTAÇÃO
 * 
 * ⚠️ LIMITAÇÕES ATUAIS DA ARQUITETURA CLANN - FASE 2
 * 
 * Estas limitações são CONSCIENTES e serão resolvidas nas fases seguintes.
 * Não tentar "resolver tudo agora" - seguir o plano evolutivo.
 */

/**
 * Limitações arquiteturais atuais (Fase 2)
 */
export const ARCHITECTURE_LIMITATIONS = {
  // 🔐 AUTENTICAÇÃO
  AUTHENTICATION: {
    CURRENT: 'Identificação por totemId + publicKey apenas',
    LIMITATION: 'Não há autenticação criptográfica (challenge-response)',
    RISK: 'Qualquer um com publicKey pode se passar pelo totemId',
    PHASE: 'Fase 3 - Autenticação forte com assinatura digital',
    NOTES: 'OK para MVP, não para produção em larga escala',
  },

  // 📨 COMUNICAÇÃO
  COMMUNICATION: {
    CURRENT: 'Apenas 1:1 (Totem → Totem)',
    LIMITATION: 'Não há broadcast para Clann inteiro',
    COMPLEXITY: 'Broadcast requer N criptografias (uma por membro)',
    PHASE: 'Fase 3 - Broadcast eficiente',
    NOTES: 'Para testes e validação da arquitetura base',
  },

  // 🏭 INSTÂNCIAS
  INSTANCES: {
    CURRENT: 'Factory pattern (múltiplas instâncias possíveis)',
    LIMITATION: 'App atual usa apenas uma instância',
    EVOLUTION: 'Suporte a múltiplos perfis/totems simultâneos',
    PHASE: 'Fase 3 - Multi-identity management',
  },

  // 🔒 SEGURANÇA
  SECURITY: {
    PRINCIPLE: 'Gateway Cego - nunca vê chaves de criptografia',
    ENFORCED: true,
    VALIDATION: 'Chaves sempre locais, validação em runtime',
    NOTES: 'Este princípio NUNCA deve ser violado',
  },
};

// Configurações padrão
export const DEFAULT_CONFIG = {
  GATEWAY_URL: process.env.EXPO_PUBLIC_GATEWAY_URL || 'ws://localhost:8080',
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 1000,
  PING_INTERVAL: 30000,
  MESSAGE_TIMEOUT: 10000,
};

// URL padrão do Gateway (compatibilidade)
export const DEFAULT_GATEWAY_URL = DEFAULT_CONFIG.GATEWAY_URL;

// Configurações de reconexão
export const RECONNECTION_CONFIG = {
  maxAttempts: DEFAULT_CONFIG.MAX_RECONNECT_ATTEMPTS,
  baseDelay: DEFAULT_CONFIG.RECONNECT_BASE_DELAY,
  maxDelay: 30000, // 30 segundos
};

// Intervalo de ping (keep-alive)
export const PING_INTERVAL = DEFAULT_CONFIG.PING_INTERVAL;

// Timeout de conexão
export const CONNECTION_TIMEOUT = DEFAULT_CONFIG.MESSAGE_TIMEOUT;

// Tipos de mensagem do protocolo
export const MESSAGE_TYPES = {
  AUTH: 'auth',
  AUTH_SUCCESS: 'auth_success',
  RELAY: 'relay',
  MESSAGE: 'message',
  STATUS: 'status',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',
  // MVP 1: Key Exchange
  JOIN_REQUEST: 'join_request',
  JOIN_ACCEPT: 'join_accept',
};

// Status de entrega
export const DELIVERY_STATUS = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

// Códigos de erro padronizados
export const ERROR_CODES = {
  // Erros do Gateway
  GATEWAY_NOT_CONNECTED: 'GATEWAY_001',
  GATEWAY_NOT_AUTHENTICATED: 'GATEWAY_002',
  GATEWAY_TIMEOUT: 'GATEWAY_003',

  // Erros de mensagem
  INVALID_RECIPIENT: 'MESSAGE_001',
  INVALID_CLANN_ID: 'MESSAGE_002',
  ENCRYPTION_REQUIRED: 'MESSAGE_003',

  // Erros de autenticação
  AUTH_MISSING_CREDENTIALS: 'AUTH_001',
  AUTH_INVALID_FORMAT: 'AUTH_002',

  // Erros de segurança
  SECURITY_KEY_VIOLATION: 'SECURITY_001',

  // Códigos numéricos (compatibilidade com Gateway)
  AUTH_REQUIRED: 4002,
  AUTH_INVALID: 4001,
  INVALID_FORMAT: 4000,
  CONNECTION_TIMEOUT_NUM: 4080,
  MAX_RECONNECTIONS: 4099,
};

// Eventos padronizados
export const GATEWAY_EVENTS = {
  CONNECTED: 'gateway:connected',
  DISCONNECTED: 'gateway:disconnected',
  AUTHENTICATED: 'gateway:authenticated',
  MESSAGE_RECEIVED: 'gateway:message:received',
  MESSAGE_SENT: 'gateway:message:sent',
  ERROR: 'gateway:error',
  RECONNECTING: 'gateway:reconnecting',
};

