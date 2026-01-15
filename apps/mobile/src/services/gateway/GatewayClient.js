/**
 * GatewayClient - Cliente WebSocket para comunicação com Gateway CLANN
 * 
 * ⚠️ PRINCÍPIOS FUNDAMENTAIS:
 * - Gateway Cego: Gateway não descriptografa, não valida conteúdo
 * - Autenticação Temporária: Por identificação apenas (Fase 2)
 * - Comunicação 1:1: Broadcast virá na Fase 3
 * 
 * @class GatewayClient
 */

import {
  DEFAULT_GATEWAY_URL,
  RECONNECTION_CONFIG,
  PING_INTERVAL,
  CONNECTION_TIMEOUT,
  MESSAGE_TYPES,
  DELIVERY_STATUS,
} from './gatewayConstants';
import { GatewayValidators } from './GatewayValidators';

export class GatewayClient {
  constructor(options = {}) {
    // Configuração injetável
    this.config = {
      gatewayUrl: options.gatewayUrl || process.env.EXPO_PUBLIC_GATEWAY_URL || DEFAULT_GATEWAY_URL,
      maxReconnectAttempts: options.maxReconnectAttempts || RECONNECTION_CONFIG.maxAttempts,
      reconnectBaseDelay: options.reconnectBaseDelay || RECONNECTION_CONFIG.baseDelay,
      pingInterval: options.pingInterval || PING_INTERVAL,
    };

    // Estado interno
    this.totemId = null;
    this.publicKey = null;
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.isAuthenticatedBeforeClose = false;

    // Handlers organizados
    this.messageHandlers = new Map(); // clannId → handler
    this.statusHandlers = new Set(); // handlers de status
    this.errorHandlers = new Set(); // handlers de erro

    // Métricas
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      connectionTime: null,
      lastActivity: null,
    };

    // Intervalos
    this.pingInterval = null;
  }

  // ==================== CONEXÃO E AUTENTICAÇÃO ====================

  /**
   * Conecta ao Gateway e autentica com credenciais do Totem
   * 
   * ⚠️ LIMITAÇÃO ATUAL: Autenticação por identificação apenas
   *    (não há challenge-response criptográfico ainda)
   *    TODO Fase 3: Implementar challenge-response com assinatura digital
   * 
   * @param {string} totemId - ID do Totem
   * @param {string} publicKey - Chave pública do Totem
   * @param {string} clannId - ID do CLANN (opcional, para conexão específica)
   * @returns {Promise<void>}
   */
  async connect(totemId, publicKey, clannId = null) {
    // Validações básicas
    if (!totemId || !publicKey) {
      throw new Error('totemId e publicKey são obrigatórios');
    }

    this.totemId = totemId;
    this.publicKey = publicKey;
    this.currentClannId = clannId;

    return new Promise((resolve, reject) => {
      // Construir URL com clannId e deviceId na query string (se fornecido)
      let wsUrl = this.config.gatewayUrl;
      if (clannId) {
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl = `${wsUrl}${separator}clannId=${encodeURIComponent(clannId)}&deviceId=${encodeURIComponent(totemId)}`;
      }

      console.log(`🔗 Conectando ao Gateway: ${wsUrl}`);

      // React Native: WebSocket é global, não precisa importar
      console.log('[GatewayClient] gatewayUrl =', wsUrl);
      this.ws = new WebSocket(wsUrl);

      // ==================== EVENT HANDLERS ====================

      this.ws.onopen = () => {
        console.log('✅ WebSocket conectado. Autenticando...');
        this.isConnected = true;
        this.metrics.connectionTime = Date.now();

        // Enviar autenticação
        const authMessage = {
          type: MESSAGE_TYPES.AUTH,
          payload: { totemId, publicKey },
        };

        this.ws.send(JSON.stringify(authMessage));
        console.log('🔑 Credenciais enviadas para autenticação');

        // Iniciar ping (keep-alive)
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        this.metrics.lastActivity = Date.now();
        this.handleIncomingMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('❌ Erro WebSocket:', error);
        this.notifyErrorHandlers(error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 Conexão fechada: ${event.code} - ${event.reason || 'Sem razão'}`);
        this.isConnected = false;
        this.isAuthenticated = false;
        this.stopPingInterval();

        // Reconexão automática se foi autenticado antes
        if (this.isAuthenticatedBeforeClose) {
          this.handleReconnection();
        }

        this.isAuthenticatedBeforeClose = this.isAuthenticated;
      };

      // Timeout de conexão
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Timeout de conexão com o Gateway'));
        }
      }, CONNECTION_TIMEOUT);
    });
  }

  // ==================== ENVIO DE MENSAGENS ====================

  /**
   * Envia mensagem para UM destinatário específico
   * 
   * ⚠️ LIMITAÇÃO ATUAL: Apenas comunicação 1:1
   *    Broadcast para Clann inteiro virá na Fase 3
   *    TODO Fase 3: Suportar broadcast para CLANN
   *      - Opção A: Gateway roteia para todos os membros do clannId
   *      - Opção B: Cliente envia N mensagens (uma por membro)
   * 
   * @param {string} clannId - ID do CLANN
   * @param {string} recipientTotemId - ID do Totem destinatário
   * @param {string} encryptedPayload - Payload criptografado (opaco para Gateway)
   * @returns {string} messageId gerado
   */
  sendMessage(clannId, recipientTotemId, encryptedPayload) {
    // Validações básicas
    if (!this.isConnected || !this.isAuthenticated) {
      throw new Error('Gateway não está conectado/autenticado');
    }

    if (!clannId || !recipientTotemId || !encryptedPayload) {
      throw new Error('clannId, recipientTotemId e encryptedPayload são obrigatórios');
    }

    // Validar que é comunicação 1:1 (limitação atual)
    if (typeof recipientTotemId !== 'string') {
      throw new Error('Apenas um destinatário suportado (1:1)');
    }

    // 🔒 VALIDAÇÕES DE SEGURANÇA
    const payload = { clannId, recipientTotemId, encryptedPayload };
    
    // Validar que payload parece criptografado (não texto plano)
    GatewayValidators.validateOutgoingPayload(payload);
    
    // Validar que não há chaves sendo enviadas ao Gateway
    GatewayValidators.validateNoKeysInGatewayData(payload);

    const messageId = this.generateMessageId();

    const message = {
      type: MESSAGE_TYPES.RELAY,
      payload: {
        clannId,
        recipientTotemId,
        encryptedPayload,
        messageId,
        timestamp: Date.now(),
      },
    };

    console.log(`📤 Enviando mensagem ${messageId} para ${recipientTotemId.substring(0, 10)}...`);

    this.ws.send(JSON.stringify(message));
    this.metrics.messagesSent++;

    return messageId;
  }

  // ==================== HANDLERS E EVENTOS ====================

  handleIncomingMessage(rawData) {
    try {
      const message = JSON.parse(rawData);

      switch (message.type) {
        case MESSAGE_TYPES.AUTH_SUCCESS:
          this.handleAuthSuccess(message.payload);
          break;

        case MESSAGE_TYPES.MESSAGE:
          this.handleClannMessage(message.payload);
          break;

        case MESSAGE_TYPES.STATUS:
          this.handleDeliveryStatus(message.payload);
          break;

        case MESSAGE_TYPES.ERROR:
          this.handleGatewayError(message.payload);
          break;

        case MESSAGE_TYPES.PONG:
          // Resposta ao ping, apenas logar se necessário
          break;

        // MVP 1: Key Exchange
        case MESSAGE_TYPES.JOIN_REQUEST:
          this.handleJoinRequest(message.payload);
          break;

        case MESSAGE_TYPES.JOIN_ACCEPT:
          this.handleJoinAccept(message.payload);
          break;

        default:
          console.warn(`⚠️ Tipo de mensagem desconhecido: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      this.notifyErrorHandlers(error);
    }
  }

  handleAuthSuccess(payload) {
    console.log(`🎉 Autenticado como Totem: ${this.totemId.substring(0, 15)}...`);
    this.isAuthenticated = true;
    this.reconnectAttempts = 0;

    // Notificar handlers de status
    this.statusHandlers.forEach((handler) => {
      try {
        handler({ type: 'connected', totemId: this.totemId });
      } catch (error) {
        console.error('Erro no status handler:', error);
      }
    });
  }

  handleClannMessage(payload) {
    this.metrics.messagesReceived++;

    console.log(`📬 Mensagem recebida para Clann ${payload.clannId}`);
    console.log(`   De: ${payload.senderTotemId?.substring(0, 10)}...`);
    console.log(`   ID: ${payload.messageId}`);

    // Buscar handler específico para este Clann
    const handler = this.messageHandlers.get(payload.clannId);

    if (handler) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`❌ Erro no handler do Clann ${payload.clannId}:`, error);
      }
    } else {
      console.warn(`⚠️ Nenhum handler registrado para Clann ${payload.clannId}`);
      // Opcional: armazenar para processamento posterior
      this.queueUndeliveredMessage(payload);
    }
  }

  handleDeliveryStatus(payload) {
    const { messageId, status, recipient } = payload;

    console.log(`📊 Status de entrega: ${messageId} → ${status}`);

    // Notificar handlers de status
    this.statusHandlers.forEach((handler) => {
      try {
        handler({ type: 'delivery_status', messageId, status, recipient });
      } catch (error) {
        console.error('Erro no status handler:', error);
      }
    });
  }

  handleGatewayError(payload) {
    console.error(`❌ Erro do Gateway:`, payload);

    const error = new Error(payload.error || 'Erro desconhecido do Gateway');
    error.code = payload.code;
    error.messageId = payload.messageId;

    this.notifyErrorHandlers(error);
  }

  // ==================== MVP 1: KEY EXCHANGE ====================

  /**
   * Handler para JOIN_REQUEST recebido (sou fundador/admin)
   * @param {Object} payload - { inviteCode, joinerTotemId, joinerPublicKey, requestId, clannId }
   */
  handleJoinRequest(payload) {
    console.log(`🔑 JOIN_REQUEST recebido de ${payload.joinerTotemId?.substring(0, 10)}...`);
    
    // Notificar handlers de status para que o app processe
    this.statusHandlers.forEach((handler) => {
      try {
        handler({ 
          type: 'join_request', 
          ...payload 
        });
      } catch (error) {
        console.error('Erro no handler de JOIN_REQUEST:', error);
      }
    });
  }

  /**
   * Handler para JOIN_ACCEPT recebido (sou joiner)
   * @param {Object} payload - { clannId, toTotemId, fromTotemId, encryptedGroupKey, requestId }
   */
  handleJoinAccept(payload) {
    // Verificar se é para mim
    if (payload.toTotemId !== this.totemId) {
      // Não é para mim, ignorar silenciosamente
      return;
    }

    console.log(`🔑 JOIN_ACCEPT recebido de ${payload.fromTotemId?.substring(0, 10)}...`);
    
    // Notificar handlers de status para que o app processe
    this.statusHandlers.forEach((handler) => {
      try {
        handler({ 
          type: 'join_accept', 
          ...payload 
        });
      } catch (error) {
        console.error('Erro no handler de JOIN_ACCEPT:', error);
      }
    });
  }

  /**
   * Envia JOIN_REQUEST para o CLANN (joiner)
   * @param {Object} params - { inviteCode, joinerTotemId, joinerPublicKey, requestId, clannId }
   */
  sendJoinRequest({ inviteCode, joinerTotemId, joinerPublicKey, requestId, clannId }) {
    if (!this.isConnected || !this.isAuthenticated) {
      throw new Error('Gateway não está conectado/autenticado');
    }

    const message = {
      type: MESSAGE_TYPES.JOIN_REQUEST,
      payload: {
        inviteCode,
        joinerTotemId,
        joinerPublicKey,
        requestId,
        clannId
      }
    };

    console.log(`📤 Enviando JOIN_REQUEST para CLANN ${clannId}`);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Envia JOIN_ACCEPT para o joiner (fundador/admin)
   * @param {Object} params - { clannId, toTotemId, fromTotemId, encryptedGroupKey, requestId }
   */
  sendJoinAccept({ clannId, toTotemId, fromTotemId, encryptedGroupKey, requestId }) {
    if (!this.isConnected || !this.isAuthenticated) {
      throw new Error('Gateway não está conectado/autenticado');
    }

    const message = {
      type: MESSAGE_TYPES.JOIN_ACCEPT,
      payload: {
        clannId,
        toTotemId,
        fromTotemId,
        encryptedGroupKey,
        requestId
      }
    };

    console.log(`📤 Enviando JOIN_ACCEPT para ${toTotemId?.substring(0, 10)}...`);
    this.ws.send(JSON.stringify(message));
  }

  // ==================== GERENCIAMENTO DE HANDLERS ====================

  /**
   * Registra handler para mensagens de um Clann específico
   * 
   * @param {string} clannId - ID do CLANN
   * @param {Function} handler - Função que recebe payload da mensagem
   * @returns {Function} Função para remover handler
   */
  registerClannHandler(clannId, handler) {
    if (this.messageHandlers.has(clannId)) {
      console.warn(`⚠️ Substituindo handler existente para Clann ${clannId}`);
    }

    this.messageHandlers.set(clannId, handler);

    // Retorna função para remover handler
    return () => {
      this.messageHandlers.delete(clannId);
    };
  }

  registerStatusHandler(handler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  registerErrorHandler(handler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  notifyErrorHandlers(error) {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Erro no error handler:', handlerError);
      }
    });
  }

  // ==================== RECONEXÃO E HEALTH CHECK ====================

  startPingInterval() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: MESSAGE_TYPES.PING }));
      }
    }, this.config.pingInterval);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  handleReconnection() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('🚫 Máximo de tentativas de reconexão atingido');
      this.notifyErrorHandlers(new Error('Máximo de reconexões atingido'));
      return;
    }

    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      RECONNECTION_CONFIG.maxDelay
    );
    this.reconnectAttempts++;

    console.log(
      `🔄 Reconectando em ${delay / 1000} segundos... (tentativa ${this.reconnectAttempts})`
    );

    setTimeout(async () => {
      if (this.totemId && this.publicKey) {
        try {
          await this.connect(this.totemId, this.publicKey);
        } catch (error) {
          console.error('❌ Falha na reconexão:', error);
        }
      }
    }, delay);
  }

  // ==================== UTILITÁRIOS ====================

  generateMessageId() {
    return `${this.totemId ? this.totemId.substring(0, 8) : 'unknown'}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  queueUndeliveredMessage(payload) {
    // TODO: Implementar fila local para mensagens não entregues
    // Por enquanto, apenas logar
    console.warn(`⚠️ Mensagem não entregue (sem handler): Clann ${payload.clannId}`);
  }

  getMetrics() {
    return {
      ...this.metrics,
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      registeredClanns: Array.from(this.messageHandlers.keys()),
    };
  }

  disconnect() {
    console.log('👋 Desconectando do Gateway...');

    this.stopPingInterval();
    this.isAuthenticatedBeforeClose = false;

    if (this.ws) {
      this.ws.close(1000, 'Desconexão solicitada pelo cliente');
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.messageHandlers.clear();
    this.statusHandlers.clear();

    console.log('✅ Desconectado do Gateway');
  }
}

