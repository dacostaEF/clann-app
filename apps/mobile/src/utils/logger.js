/**
 * Logger Estruturado para Ambiente DEV
 * 
 * Sistema leve de logging com tags por domínio (UI, Gateway, DB, Security)
 * Funciona apenas em __DEV__, não impacta produção
 * 
 * Uso:
 *   import logger from './utils/logger';
 *   logger.ui('Mensagem', { dados });
 *   logger.gateway('Evento', { payload });
 *   logger.db('Query', { params });
 *   logger.security('Evento', { details });
 */

// Domínios disponíveis
const DOMAINS = {
  UI: 'UI',
  GATEWAY: 'Gateway',
  DB: 'DB',
  SECURITY: 'Security',
};

// Cores por domínio (para console colorido)
const DOMAIN_COLORS = {
  [DOMAINS.UI]: '#4a90e2',        // Azul
  [DOMAINS.GATEWAY]: '#27ae60',   // Verde
  [DOMAINS.DB]: '#f39c12',        // Laranja
  [DOMAINS.SECURITY]: '#e74c3c',  // Vermelho
};

// Emojis por domínio (para identificação visual rápida)
const DOMAIN_EMOJIS = {
  [DOMAINS.UI]: '🎨',
  [DOMAINS.GATEWAY]: '🌐',
  [DOMAINS.DB]: '💾',
  [DOMAINS.SECURITY]: '🔐',
};

/**
 * Formata timestamp para logs
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
}

/**
 * Formata mensagem de log estruturada
 */
function formatLog(domain, level, message, data = null) {
  if (!__DEV__) return; // Não executa em produção

  const emoji = DOMAIN_EMOJIS[domain] || '📝';
  const timestamp = formatTimestamp();
  const tag = `[${domain}]`;
  
  // Mensagem base
  const baseMessage = `${emoji} ${tag} ${message}`;
  
  // Se houver dados, formatar
  if (data !== null && data !== undefined) {
    // Filtrar dados sensíveis (não logar chaves privadas, etc)
    const safeData = sanitizeData(data);
    
    if (typeof safeData === 'object') {
      try {
        console.log(`${baseMessage} (${timestamp})`, safeData);
      } catch (e) {
        // Fallback se JSON.stringify falhar
        console.log(`${baseMessage} (${timestamp})`, String(safeData));
      }
    } else {
      console.log(`${baseMessage} (${timestamp})`, safeData);
    }
  } else {
    console.log(`${baseMessage} (${timestamp})`);
  }
}

/**
 * Remove dados sensíveis dos logs
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'privateKey',
    'private_key',
    'secret',
    'password',
    'pin',
    'recoveryPhrase',
    'seed',
    'mnemonic',
  ];

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized = { ...data };
  
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Recursivamente sanitizar objetos aninhados
  for (const key in sanitized) {
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Logger principal
 */
const logger = {
  /**
   * Log para domínio UI (interfaces, navegação, renderização)
   */
  ui: (message, data = null) => {
    formatLog(DOMAINS.UI, 'info', message, data);
  },

  /**
   * Log para domínio Gateway (WebSocket, conexões, mensagens)
   */
  gateway: (message, data = null) => {
    formatLog(DOMAINS.GATEWAY, 'info', message, data);
  },

  /**
   * Log para domínio DB (SQLite, queries, persistência)
   */
  db: (message, data = null) => {
    formatLog(DOMAINS.DB, 'info', message, data);
  },

  /**
   * Log para domínio Security (criptografia, autenticação, eventos de segurança)
   */
  security: (message, data = null) => {
    formatLog(DOMAINS.SECURITY, 'info', message, data);
  },

  /**
   * Log de erro (qualquer domínio)
   */
  error: (domain, message, error = null) => {
    if (!__DEV__) return;
    
    const emoji = DOMAIN_EMOJIS[domain] || '❌';
    const timestamp = formatTimestamp();
    const tag = `[${domain}]`;
    
    if (error) {
      console.error(`${emoji} ${tag} ERROR: ${message} (${timestamp})`, error);
    } else {
      console.error(`${emoji} ${tag} ERROR: ${message} (${timestamp})`);
    }
  },

  /**
   * Log de warning (qualquer domínio)
   */
  warn: (domain, message, data = null) => {
    if (!__DEV__) return;
    
    const emoji = DOMAIN_EMOJIS[domain] || '⚠️';
    const timestamp = formatTimestamp();
    const tag = `[${domain}]`;
    
    if (data) {
      console.warn(`${emoji} ${tag} WARN: ${message} (${timestamp})`, data);
    } else {
      console.warn(`${emoji} ${tag} WARN: ${message} (${timestamp})`);
    }
  },
};

export default logger;
