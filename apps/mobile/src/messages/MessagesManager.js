import MessagesStorage from './MessagesStorage';
import ClanStorage from '../clans/ClanStorage';
import { encryptMessage, decryptMessage, initE2E } from '../security/e2e';
import ReactionsManager, { AVAILABLE_REACTIONS } from './ReactionsManager';
import DeliveryManager from './DeliveryManager';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { updateLastMessage } from './MessageCache';
import { compressText, decompressText } from '../utils/compression';
import { createGatewayClient } from '../services/gateway';
import { loadTotemSecure } from '../storage/secureStore';

/**
 * Lógica de negócio para mensagens dos CLANNs
 * Encapsula validações e operações do MessagesStorage
 * 
 * Sprint 4: Chat básico funcional
 * Sprint 6: Criptografia E2E integrada
 */
class MessagesManager {
  constructor() {
    this.storage = MessagesStorage;
    this.initialized = false;
    this.e2eInitialized = false;
    
    // Gateway integration (Fase 3)
    this.gatewayClient = null;
    this.isGatewayConnected = false;
    
    // ✅ Sistema de callbacks simples (clannId → Set de callbacks)
    this.messageCallbacks = new Map(); // clannId → Set<callback>
    
    // ✅ Set de handlers registrados no Gateway (evita duplicatas)
    this.registeredGatewayHandlers = new Set(); // clannId strings
  }

  // ---------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------
  async init() {
    if (this.initialized) {
      return Promise.resolve(true);
    }
    
    try {
      await this.storage.init();
      
      // Inicializar sistema E2E
      if (!this.e2eInitialized) {
        await initE2E();
        this.e2eInitialized = true;
      }
      
      this.initialized = true;
      return Promise.resolve(true);
    } catch (error) {
      console.error('Erro ao inicializar MessagesManager:', error);
      throw error;
    }
  }

  // ========== GATEWAY INTEGRATION (FASE 3) ==========

  /**
   * Inicializar conexão com o Gateway após criação do Totem
   * @param {string|number} clannId - ID do CLANN (opcional, para conexão específica)
   */
  async initializeGateway(clannId = null) {
    try {
      console.log('🚀 Inicializando Gateway CLANN...');

      // 1. Obter dados do Totem
      const totemData = await loadTotemSecure();
      if (!totemData || !totemData.totemId || !totemData.publicKey) {
        throw new Error('Totem não encontrado ou incompleto');
      }

      // 2. Criar cliente usando a factory
      this.gatewayClient = createGatewayClient({
        gatewayUrl: process.env.EXPO_PUBLIC_GATEWAY_URL || 'ws://localhost:8080',
      });

      // 3. Conectar com credenciais do Totem e clannId (se fornecido)
      await this.gatewayClient.connect(totemData.totemId, totemData.publicKey, clannId);

      console.log('✅ Gateway conectado e autenticado');

      // 4. Configurar handler para mensagens recebidas
      this.setupGatewayHandlers();

      this.isGatewayConnected = true;
    } catch (error) {
      console.error('❌ Falha ao inicializar Gateway:', error);
      this.isGatewayConnected = false;
      // Não lança erro - Gateway é opcional por enquanto
    }
  }

  /**
   * Configurar handlers do Gateway
   */
  setupGatewayHandlers() {
    if (!this.gatewayClient) return;

    // Handler para status da conexão
    this.gatewayClient.registerStatusHandler((status) => {
      console.log('📡 Status Gateway:', status);

      if (status.type === 'connected') {
        this.onGatewayConnected();
      } else if (status.type === 'disconnected') {
        this.onGatewayDisconnected();
      }
    });

    // Handler de erros
    this.gatewayClient.registerErrorHandler((error) => {
      console.error('💥 Erro no Gateway:', error);
      this.onGatewayError(error);
    });
  }

  // ✅ NOVO: Sistema de callbacks para notificar UI

  /**
   * Registrar callback para ser chamado quando uma nova mensagem
   * for recebida para um CLANN específico
   * 
   * @param {string|number} clanId - ID do CLANN
   * @param {Function} callback - Função: (messageData) => void
   * @returns {Function} Função para remover o callback (unregister)
   */
  onNewMessage(clanId, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback deve ser uma função');
    }

    const normalizedClanId = clanId.toString();
    
    if (!this.messageCallbacks.has(normalizedClanId)) {
      this.messageCallbacks.set(normalizedClanId, new Set());
    }
    
    this.messageCallbacks.get(normalizedClanId).add(callback);
    
    console.log(`📡 Callback registrado para CLANN ${normalizedClanId}`);
    
    // Retornar função para remover callback
    return () => {
      this.offNewMessage(clanId, callback);
    };
  }

  /**
   * Remover callback registrado
   * 
   * @param {string|number} clanId - ID do CLANN
   * @param {Function} callback - Função a ser removida
   */
  offNewMessage(clanId, callback) {
    const normalizedClanId = clanId.toString();
    const callbacks = this.messageCallbacks.get(normalizedClanId);
    
    if (callbacks) {
      callbacks.delete(callback);
      
      // Limpar Set vazio
      if (callbacks.size === 0) {
        this.messageCallbacks.delete(normalizedClanId);
      }
      
      console.log(`📡 Callback removido para CLANN ${normalizedClanId}`);
    }
  }

  /**
   * Notifica todos os callbacks registrados para um CLANN
   * (chamado internamente quando mensagem é processada)
   * 
   * @param {string|number} clanId - ID do CLANN
   * @param {Object} messageData - Dados da mensagem processada
   */
  notifyNewMessage(clanId, messageData) {
    const normalizedClanId = clanId.toString();
    const callbacks = this.messageCallbacks.get(normalizedClanId);
    
    if (callbacks && callbacks.size > 0) {
      console.log(`📢 Notificando ${callbacks.size} callback(s) para CLANN ${normalizedClanId}`);
      
      callbacks.forEach(callback => {
        try {
          callback(messageData);
        } catch (error) {
          console.error(`❌ Erro ao executar callback para CLANN ${normalizedClanId}:`, error);
        }
      });
    }
  }

  /**
   * Callbacks de status do Gateway
   */
  onGatewayConnected() {
    this.isGatewayConnected = true;
    console.log('✅ Gateway conectado');
  }

  onGatewayDisconnected() {
    this.isGatewayConnected = false;
    // ✅ Limpar handlers registrados ao desconectar
    this.registeredGatewayHandlers.clear();
    console.log('⚠️ Gateway desconectado');
  }

  onGatewayError(error) {
    console.error('💥 Erro no Gateway:', error);
    // ✅ Limpar estado de conexão em caso de erro
    this.isGatewayConnected = false;
    // Pode implementar notificação ao usuário aqui
  }

  /**
   * Registrar handler para mensagens de um Clann específico
   * ✅ Evita múltiplos registros para o mesmo clannId
   * ✅ Garante que Gateway está conectado com clannId correto
   */
  async registerClannGatewayHandler(clanId) {
    const normalizedClanId = clanId.toString();

    // ✅ Verificar se já está registrado (evita duplicatas)
    if (this.registeredGatewayHandlers.has(normalizedClanId)) {
      console.log(`📡 Handler já registrado para CLANN ${normalizedClanId}`);
      return null;
    }

    // Se Gateway não está disponível, inicializar com clannId
    if (!this.isGatewayAvailable()) {
      try {
        await this.initializeGateway(normalizedClanId);
      } catch (error) {
        console.warn('⚠️ Gateway não disponível, não é possível registrar handler:', error.message);
        return null;
      }
    }

    // Registrar handler no GatewayClient
    this.gatewayClient.registerClannHandler(normalizedClanId, async (payload) => {
      await this.processIncomingGatewayMessage(payload);
    });

    // Marcar como registrado
    this.registeredGatewayHandlers.add(normalizedClanId);
    console.log(`📡 Handler registrado para CLANN ${normalizedClanId}`);

    return true;
  }

  /**
   * Processar mensagem recebida do Gateway
   * TODA a lógica de descriptografia, validação e persistência fica aqui
   */
  async processIncomingGatewayMessage(payload) {
    try {
      console.log(`📬 Mensagem recebida do Gateway para Clann ${payload.clannId}`);

      // 1. Verificar se o Clann existe localmente
      const clan = await ClanStorage.getClanById(parseInt(payload.clannId));
      if (!clan) {
        console.warn(`⚠️ Clann ${payload.clannId} não encontrado localmente`);
        return;
      }

      // 2. Descriptografar LOCALMENTE usando a função existente
      const decryptedContent = await decryptMessage(
        parseInt(payload.clannId),
        payload.encryptedPayload
      );

      // 3. Descomprimir texto
      const decompressedText = decompressText(decryptedContent);

      // 4. Salvar localmente (persistência)
      const savedMessage = await this.storage.addMessage(
        parseInt(payload.clannId),
        payload.senderTotemId,
        payload.encryptedPayload, // Salvar criptografado
        {
          messageId: payload.messageId,
          timestamp: payload.timestamp || Date.now(),
          viaGateway: true
        }
      );

      // 5. ✅ Notificar callbacks (UI será atualizada)
      this.notifyNewMessage(payload.clannId, {
        clanId: payload.clannId,
        messageId: payload.messageId || savedMessage.id,
        senderTotemId: payload.senderTotemId,
        timestamp: payload.timestamp || savedMessage.timestamp,
        // Não enviar conteúdo descriptografado - UI vai buscar do storage
      });

      console.log(`✅ Mensagem ${payload.messageId || savedMessage.id} processada e notificada`);
    } catch (error) {
      console.error('❌ Erro ao processar mensagem do Gateway:', error);
      // Não notificar callbacks em caso de erro
    }
  }

  /**
   * Enviar mensagem via Gateway (método alternativo ao addMessage)
   * ⚠️ LIMITAÇÃO: Apenas 1:1 (recipientTotemId obrigatório)
   */
  async sendClannMessageViaGateway(clanId, content, recipientTotemId, options = {}) {
    if (!this.isGatewayAvailable()) {
      throw new Error('Gateway não está disponível');
    }

    // 1. Obter dados do Clann localmente
    const clan = await ClanStorage.getClanById(parseInt(clanId));
    if (!clan) {
      throw new Error(`Clann ${clanId} não encontrado`);
    }

    // 2. Validar destinatário (atualmente apenas 1:1)
    if (!recipientTotemId) {
      throw new Error('recipientTotemId é obrigatório (apenas 1:1)');
    }

    // 3. Criptografar localmente (função existente)
    const compressedText = compressText(content);
    const encryptedPayload = await encryptMessage(parseInt(clanId), compressedText);

    // 4. Enviar via Gateway
    const messageId = this.gatewayClient.sendMessage(
      clanId.toString(),
      recipientTotemId,
      encryptedPayload
    );

    // 5. Salvar localmente como "enviando"
    await this.storage.addMessage(
      parseInt(clanId),
      (await loadTotemSecure()).totemId,
      encryptedPayload,
      { ...options, status: 'sending', viaGateway: true }
    );

    console.log(`📤 Mensagem ${messageId} enviada via Gateway`);

    return messageId;
  }

  /**
   * Verificar se Gateway está disponível
   * ✅ Retorna true apenas quando WebSocket está realmente conectado
   */
  isGatewayAvailable() {
    return (
      this.gatewayClient &&
      this.isGatewayConnected === true
    );
  }

  /**
   * Obter métricas do Gateway
   */
  getGatewayMetrics() {
    return this.gatewayClient ? this.gatewayClient.getMetrics() : null;
  }

  /**
   * Desconectar Gateway
   */
  disconnectGateway() {
    if (this.gatewayClient) {
      this.gatewayClient.disconnect();
      this.isGatewayConnected = false;
      // ✅ Limpar handlers registrados ao desconectar
      this.registeredGatewayHandlers.clear();
    }
  }

  /**
   * Gerar ID único para mensagem
   * @returns {string} messageId
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ---------------------------------------------------------
  // Adicionar mensagem com validação
  // ---------------------------------------------------------
  async addMessage(clanId, authorTotem, text, options = {}) {
    const { selfDestructAt = null, burnAfterRead = false } = options;
    
    // Validações básicas primeiro
    if (!clanId) {
      throw new Error('clanId é obrigatório');
    }

    if (!authorTotem || typeof authorTotem !== 'string' || authorTotem.trim() === '') {
      throw new Error('authorTotem é obrigatório e deve ser uma string válida');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('text é obrigatório e deve ser uma string');
    }

    const trimmedText = text.trim();
    
    if (trimmedText === '') {
      throw new Error('Mensagem não pode estar vazia');
    }

    if (trimmedText.length > 5000) {
      throw new Error('Mensagem não pode exceder 5000 caracteres');
    }

    // Enforcement: Verifica regras antes de enviar mensagem (Sprint 7 - ETAPA 3)
    try {
      const { checkAction, ACTION_TYPES } = await import('../clans/RuleEnforcement');
      const userRole = await ClanStorage.getUserRole(clanId, authorTotem);
      
      const enforcementResult = await checkAction(clanId, ACTION_TYPES.SEND_MESSAGE, {
        userTotem: authorTotem,
        userRole: userRole,
        clanId: clanId,
        data: {
          messageText: trimmedText
        }
      });
      
      if (!enforcementResult.allowed) {
        const error = new Error(enforcementResult.reason || 'Ação bloqueada por regra ativa');
        error.violatedRules = enforcementResult.violatedRules;
        error.enforcementBlocked = true;
        throw error;
      }
    } catch (error) {
      // Se enforcement falhar, verifica se é erro de bloqueio
      if (error.enforcementBlocked || error.message.includes('bloqueada') || error.message.includes('proibido')) {
        throw error; // Re-lança erro de enforcement
      }
      // Se for outro erro (ex: módulo não encontrado), continua normalmente
      console.warn('Enforcement não disponível, continuando sem verificação:', error.message);
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    // ✅ DOSE 1D: Garantir que o banco está pronto ANTES de chamar addMessage
    console.log('[FLOW] MessagesManager.addMessage() iniciado');
    if (this.storage && typeof this.storage.ensureDb === 'function') {
      console.log('[FLOW] Aguardando ensureDb() antes do envio');
      await this.storage.ensureDb();
      console.log('[FLOW] Banco garantido, chamando addMessage');
    } else {
      console.warn('[FLOW] ensureDb() não disponível, continuando sem garantia de inicialização');
    }

    // Criptografar mensagem antes de salvar (Sprint 6)
    try {
      // Comprimir texto antes de criptografar (Sprint 7 - ETAPA 6)
      const compressedText = compressText(trimmedText);
      const encryptedText = await encryptMessage(parseInt(clanId), compressedText);
      
      // PASSO 3: Persistir imediatamente com status='sending' (antes de tentar Gateway)
      const message = await this.storage.addMessage(
        parseInt(clanId),
        authorTotem.trim(),
        encryptedText,
        { 
          selfDestructAt, 
          burnAfterRead,
          status: 'sending' // PASSO 3: Status inicial sempre 'sending'
        }
      );
      
      // ✅ NOVO: Tentar enviar via Gateway se disponível (após persistir)
      let messageId = null;
      let sentViaGateway = false;
      let finalStatus = 'sending'; // Inicialmente 'sending'
      
      if (this.isGatewayAvailable()) {
        try {
          // Obter lista de membros do CLANN (exceto o remetente)
          const clan = await ClanStorage.getClanById(parseInt(clanId));
          if (clan && clan.members) {
            const otherMembers = clan.members
              .filter(m => m.totemId !== authorTotem)
              .map(m => m.totemId);
            
            if (otherMembers.length > 0) {
              // Enviar para cada membro (broadcast 1:N - Opção A)
              const sendPromises = otherMembers.map(recipientTotemId => {
                try {
                  return this.gatewayClient.sendMessage(
                    clanId.toString(),
                    recipientTotemId,
                    encryptedText // Já criptografado
                  );
                } catch (error) {
                  console.warn(`⚠️ Erro ao enviar para ${recipientTotemId}:`, error);
                  return null;
                }
              });
              
              const messageIds = await Promise.all(sendPromises);
              messageId = messageIds.find(id => id !== null) || this.generateMessageId();
              sentViaGateway = true;
              finalStatus = 'sent'; // PASSO 3: Atualizar para 'sent' se enviado
              console.log(`📤 Mensagem enviada via Gateway para ${otherMembers.length} membros`);
            } else {
              finalStatus = 'pending_sync'; // PASSO 3: Sem membros, aguardar sync
            }
          } else {
            finalStatus = 'pending_sync'; // PASSO 3: CLANN não encontrado, aguardar sync
          }
        } catch (error) {
          console.warn('⚠️ Erro ao enviar via Gateway, mantendo status pending_sync:', error);
          finalStatus = 'pending_sync'; // PASSO 3: Erro, aguardar retry
        }
      } else {
        finalStatus = 'pending_sync'; // PASSO 3: Gateway não disponível, aguardar sync
      }
      
      // PASSO 3: Atualizar status após tentativa de envio
      // CORREÇÃO: Não aguardar resultado - status é metadata, não crítico
      // Se falhar, não deve quebrar o fluxo de envio
      if (finalStatus !== 'sending') {
        this.updateMessageStatus(message.id, finalStatus).catch(err => {
          // Logar mas não propagar erro - envio local não pode falhar por erro de status
          console.warn('[MessagesManager] Falha ao atualizar status (não crítico):', err?.message || err);
        });
      }
      
      // Atualizar cache de última mensagem (Sprint 7 - ETAPA 6)
      try {
        await updateLastMessage(parseInt(clanId), {
          message: trimmedText,
          timestamp: message.timestamp,
          authorTotem: authorTotem.trim(),
          edited: false,
          deleted: false
        });
      } catch (cacheError) {
        console.warn('Erro ao atualizar cache:', cacheError);
        // Não falha se cache falhar
      }
      
      // Retornar mensagem com texto descriptografado para uso imediato
      return {
        ...message,
        message: trimmedText, // Texto original para exibição
        viaGateway: sentViaGateway,
      };
    } catch (error) {
      console.error('Erro ao adicionar mensagem:', error);
      throw new Error(`Erro ao adicionar mensagem: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Buscar mensagens ordenadas
  // ---------------------------------------------------------
  async getMessages(clanId) {
    if (!clanId) {
      throw new Error('clanId é obrigatório');
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    try {
      const messages = await this.storage.getMessages(parseInt(clanId));
      
      // Descriptografar mensagens e processar burn-after-read (Sprint 6)
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          try {
            // Verificar se mensagem foi deletada (Sprint 6 - ETAPA 5)
            const isDeleted = msg.deleted === 1 || msg.deleted === true;
            let decryptedText = 'Mensagem apagada';
            
            // Se não foi deletada, descriptografar normalmente
            if (!isDeleted) {
              try {
                const encryptedText = await decryptMessage(parseInt(clanId), msg.message);
                // Descomprimir texto após descriptografar (Sprint 7 - ETAPA 6)
                decryptedText = decompressText(encryptedText);
              } catch (error) {
                decryptedText = '[Mensagem criptografada - não foi possível descriptografar]';
              }
            }
            
            // Se burn_after_read, apagar mensagem após ler
            if (msg.burn_after_read === 1 || msg.burn_after_read === true) {
              // Apaga em background (não bloqueia a exibição)
              setTimeout(() => {
                this.storage.deleteMessage(msg.id).catch(err => {
                  console.warn('Erro ao apagar mensagem burn-after-read:', err);
                });
              }, 100);
            }
            
            // Carregar reações da mensagem (Sprint 6 - ETAPA 3)
            const reactions = await ReactionsManager.loadReactions(msg.id);
            
            // Carregar status de entrega (Sprint 6 - ETAPA 4)
            const deliveryStatus = await DeliveryManager.loadStatus(msg.id);
            
            return {
              id: msg.id,
              clanId: msg.clan_id,
              authorTotem: msg.author_totem,
              message: decryptedText,
              timestamp: msg.timestamp,
              selfDestructAt: msg.self_destruct_at,
              burnAfterRead: msg.burn_after_read === 1 || msg.burn_after_read === true,
              reactions: reactions,
              deliveredTo: deliveryStatus.delivered_to || [],
              readBy: deliveryStatus.read_by || [],
              edited: msg.edited === 1 || msg.edited === true,
              deleted: isDeleted,
              editedAt: msg.edited_at || null,
              status: msg.status || 'sent' // PASSO 4: Retornar status (default 'sent' para compatibilidade)
            };
          } catch (error) {
            // Se falhar ao descriptografar, retorna mensagem de erro
            console.warn('Erro ao descriptografar mensagem:', error);
            return {
              id: msg.id,
              clanId: msg.clan_id,
              authorTotem: msg.author_totem,
              message: '[Mensagem criptografada - não foi possível descriptografar]',
              timestamp: msg.timestamp,
              error: true,
              status: msg.status || 'sent' // PASSO 4: Retornar status mesmo em caso de erro
            };
          }
        })
      );
      
      // Atualizar cache com última mensagem (Sprint 7 - ETAPA 6)
      if (decryptedMessages.length > 0) {
        try {
          // Ordena por timestamp e pega a última
          const sortedMessages = [...decryptedMessages].sort((a, b) => b.timestamp - a.timestamp);
          const lastMessage = sortedMessages[0];
          await updateLastMessage(parseInt(clanId), lastMessage);
        } catch (cacheError) {
          console.warn('Erro ao atualizar cache:', cacheError);
          // Não falha se cache falhar
        }
      }
      
      return decryptedMessages;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Deletar mensagem
  // ---------------------------------------------------------
  async deleteMessage(messageId) {
    if (!messageId) {
      throw new Error('messageId é obrigatório');
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    try {
      await this.storage.deleteMessage(messageId);
      return true;
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      throw new Error(`Erro ao deletar mensagem: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Limpar mensagens de um CLANN
  // ---------------------------------------------------------
  async clearMessages(clanId) {
    if (!clanId) {
      throw new Error('clanId é obrigatório');
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    try {
      await this.storage.clearMessages(parseInt(clanId));
      return true;
    } catch (error) {
      console.error('Erro ao limpar mensagens:', error);
      throw new Error(`Erro ao limpar mensagens: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Alternar reação em uma mensagem (Sprint 6 - ETAPA 3)
  // ---------------------------------------------------------
  async toggleReaction(messageId, emoji, totemId) {
    if (!messageId || !emoji || !totemId) {
      throw new Error('messageId, emoji e totemId são obrigatórios');
    }

    try {
      const updatedReactions = await ReactionsManager.toggleReaction(messageId, emoji, totemId);
      return updatedReactions;
    } catch (error) {
      console.error('Erro ao alternar reação:', error);
      throw new Error(`Erro ao alternar reação: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Carregar reações de uma mensagem
  // ---------------------------------------------------------
  async getReactions(messageId) {
    if (!messageId) {
      throw new Error('messageId é obrigatório');
    }

    try {
      const reactions = await ReactionsManager.loadReactions(messageId);
      return reactions;
    } catch (error) {
      console.error('Erro ao carregar reações:', error);
      throw new Error(`Erro ao carregar reações: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Marcar mensagem como entregue (Sprint 6 - ETAPA 4)
  // ---------------------------------------------------------
  async markMessageDelivered(messageId, totemId) {
    if (!messageId || !totemId) {
      throw new Error('messageId e totemId são obrigatórios');
    }

    try {
      const updatedStatus = await DeliveryManager.markDelivered(messageId, totemId);
      return updatedStatus;
    } catch (error) {
      console.error('Erro ao marcar mensagem como entregue:', error);
      throw new Error(`Erro ao marcar mensagem como entregue: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Marcar mensagem como lida (Sprint 6 - ETAPA 4)
  // ---------------------------------------------------------
  async markMessageRead(messageId, totemId) {
    if (!messageId || !totemId) {
      throw new Error('messageId e totemId são obrigatórios');
    }

    try {
      const updatedStatus = await DeliveryManager.markRead(messageId, totemId);
      return updatedStatus;
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      throw new Error(`Erro ao marcar mensagem como lida: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Atualizar status de uma mensagem (PASSO 3/5: Status de envio)
  // ---------------------------------------------------------
  async updateMessageStatus(messageId, newStatus) {
    if (!messageId || !newStatus) {
      // CORREÇÃO: Não lançar erro, apenas logar e retornar (não quebrar fluxo)
      console.warn('[MessagesManager] updateMessageStatus chamado com parâmetros inválidos:', { messageId, newStatus });
      return false;
    }

    // Validar status válido
    const validStatuses = ['sending', 'sent', 'pending_sync'];
    if (!validStatuses.includes(newStatus)) {
      console.warn(`Status inválido: ${newStatus}, usando 'sent' como fallback`);
      newStatus = 'sent';
    }

    try {
      const updated = await this.storage.updateMessageStatus(messageId, newStatus);
      // CORREÇÃO: storage.updateMessageStatus() agora retorna false se não encontrou mensagem
      // Não lançar erro - status é metadata, não crítico
      if (!updated) {
        console.warn(`[MessagesManager] Status da mensagem ${messageId} não foi atualizado (mensagem não encontrada ou erro não crítico)`);
      }
      return updated;
    } catch (error) {
      // CORREÇÃO: Não lançar erro - apenas logar warning e retornar false
      // Envio local não pode falhar por erro de atualização de status
      console.warn('[MessagesManager] Erro ao atualizar status da mensagem (não crítico):', error?.message || error);
      return false; // Retorna false, mas não quebra fluxo
    }
  }

  // ---------------------------------------------------------
  // Marcar múltiplas mensagens como lidas (Sprint 6 - ETAPA 4)
  // ---------------------------------------------------------
  async markMessagesRead(messageIds, totemId) {
    if (!Array.isArray(messageIds) || !totemId) {
      throw new Error('messageIds deve ser um array e totemId é obrigatório');
    }

    try {
      const promises = messageIds.map(msgId => 
        DeliveryManager.markRead(msgId, totemId).catch(err => {
          console.warn(`Erro ao marcar mensagem ${msgId} como lida:`, err);
          return null;
        })
      );
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
      throw new Error(`Erro ao marcar mensagens como lidas: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Editar mensagem (Sprint 6 - ETAPA 5)
  // ---------------------------------------------------------
  async editMessage(messageId, clanId, newText, totemId) {
    if (!messageId || !clanId || !newText || !totemId) {
      throw new Error('messageId, clanId, newText e totemId são obrigatórios');
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Buscar mensagem para validar autor
      const messages = await this.storage.getMessages(clanId);
      const message = messages.find(m => m.id === messageId);

      if (!message) {
        throw new Error('Mensagem não encontrada');
      }

      // Validar que é o autor
      if (message.author_totem !== totemId) {
        throw new Error('Você só pode editar suas próprias mensagens');
      }

      // Validar que não está deletada
      if (message.deleted === 1 || message.deleted === true) {
        throw new Error('Não é possível editar uma mensagem deletada');
      }

      // Validar que não tem autodestruição ativa
      const now = Date.now();
      if (message.self_destruct_at && message.self_destruct_at <= now) {
        throw new Error('Não é possível editar uma mensagem expirada');
      }

      // Validar que não é burn-after-read
      if (message.burn_after_read === 1 || message.burn_after_read === true) {
        throw new Error('Não é possível editar uma mensagem burn-after-read');
      }

      // Criar backup do conteúdo original (criptografado)
      const originalContent = message.message;

      // Comprimir e criptografar novo conteúdo (Sprint 7 - ETAPA 6)
      const compressedNewText = compressText(newText.trim());
      const encryptedNewText = await encryptMessage(parseInt(clanId), compressedNewText);

      // Atualizar mensagem via storage
      await this.storage.updateMessage(messageId, {
        message: encryptedNewText,
        original_content: originalContent,
        edited: 1,
        edited_at: Date.now()
      });

      // Atualizar cache se esta for a última mensagem (Sprint 7 - ETAPA 6)
      try {
        const allMessages = await this.getMessages(clanId);
        if (allMessages.length > 0) {
          const sortedMessages = [...allMessages].sort((a, b) => b.timestamp - a.timestamp);
          const lastMessage = sortedMessages[0];
          if (lastMessage.id === messageId) {
            await updateLastMessage(parseInt(clanId), {
              message: newText.trim(),
              timestamp: lastMessage.timestamp,
              authorTotem: totemId,
              edited: true,
              deleted: false
            });
          }
        }
      } catch (cacheError) {
        console.warn('Erro ao atualizar cache após edição:', cacheError);
      }

      // Registra evento de auditoria (Sprint 7 - ETAPA 3)
      try {
        await logSecurityEvent(SECURITY_EVENTS.MESSAGE_EDITED, {
          messageId,
          clanId,
          messageLength: newText.trim().length
        }, totemId);
      } catch (error) {
        console.error('Erro ao registrar evento de auditoria:', error);
        // Não falha a edição se a auditoria falhar
      }

      return true;
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
      throw new Error(`Erro ao editar mensagem: ${error.message}`);
    }
  }

  // ---------------------------------------------------------
  // Mesclar delta updates (Sprint 6 - ETAPA 6)
  // ---------------------------------------------------------
  async mergeDelta(deltaMessages, currentMessages) {
    if (!Array.isArray(deltaMessages) || deltaMessages.length === 0) {
      return currentMessages;
    }

    // Criar mapa de mensagens atuais para busca rápida
    const messageMap = new Map();
    currentMessages.forEach(msg => {
      messageMap.set(msg.id, { ...msg }); // Clone para evitar mutação
    });

    // Processar cada mensagem do delta
    const processPromises = deltaMessages.map(async (deltaMsg) => {
      const existingMsg = messageMap.get(deltaMsg.id);

      if (!existingMsg) {
        // Nova mensagem - processar e adicionar
        const processedMsg = await this._processMessageForDisplay(deltaMsg);
        if (processedMsg) {
          messageMap.set(processedMsg.id, processedMsg);
        }
      } else {
        // Mensagem existente - atualizar campos alterados
        // Verificar se foi deletada
        const isDeleted = deltaMsg.deleted === 1 || deltaMsg.deleted === true;
        if (isDeleted) {
          existingMsg.deleted = true;
          existingMsg.message = 'Mensagem apagada';
          return;
        }

        // Verificar se foi editada
        if (deltaMsg.edited === 1 || deltaMsg.edited === true) {
          const processedMsg = await this._processMessageForDisplay(deltaMsg);
          if (processedMsg) {
            existingMsg.message = processedMsg.message;
            existingMsg.edited = true;
            existingMsg.editedAt = processedMsg.editedAt;
          }
        }

        // Atualizar reações
        try {
          const reactions = await ReactionsManager.loadReactions(deltaMsg.id);
          existingMsg.reactions = reactions;
        } catch (err) {
          console.warn('Erro ao carregar reações do delta:', err);
        }

        // Atualizar status de entrega/leitura
        try {
          const status = await DeliveryManager.loadStatus(deltaMsg.id);
          existingMsg.deliveredTo = status.delivered_to || [];
          existingMsg.readBy = status.read_by || [];
        } catch (err) {
          console.warn('Erro ao carregar status do delta:', err);
        }
      }
    });

    // Aguardar processamento de todas as mensagens
    await Promise.all(processPromises);

    // Converter mapa de volta para array e ordenar por timestamp
    const mergedMessages = Array.from(messageMap.values());
    mergedMessages.sort((a, b) => a.timestamp - b.timestamp);

    return mergedMessages;
  }

  // ---------------------------------------------------------
  // Processar mensagem para exibição (helper interno)
  // ---------------------------------------------------------
  async _processMessageForDisplay(msg) {
    try {
      const isDeleted = msg.deleted === 1 || msg.deleted === true;
      let decryptedText = 'Mensagem apagada';
      
      if (!isDeleted) {
        try {
          decryptedText = await decryptMessage(parseInt(msg.clan_id), msg.message);
        } catch (error) {
          decryptedText = '[Mensagem criptografada - não foi possível descriptografar]';
        }
      }

      const reactions = await ReactionsManager.loadReactions(msg.id);
      const deliveryStatus = await DeliveryManager.loadStatus(msg.id);

      return {
        id: msg.id,
        clanId: msg.clan_id,
        authorTotem: msg.author_totem,
        message: decryptedText,
        timestamp: msg.timestamp,
        selfDestructAt: msg.self_destruct_at,
        burnAfterRead: msg.burn_after_read === 1 || msg.burn_after_read === true,
        reactions: reactions,
        deliveredTo: deliveryStatus.delivered_to || [],
        readBy: deliveryStatus.read_by || [],
        edited: msg.edited === 1 || msg.edited === true,
        deleted: isDeleted,
        editedAt: msg.edited_at || null
      };
    } catch (error) {
      console.warn('Erro ao processar mensagem:', error);
      return null;
    }
  }

  // ---------------------------------------------------------
  // Deletar mensagem (Sprint 6 - ETAPA 5)
  // ---------------------------------------------------------
  async deleteMessage(messageId, clanId, totemId) {
    if (!messageId || !clanId || !totemId) {
      throw new Error('messageId, clanId e totemId são obrigatórios');
    }

    // Garantir que está inicializado
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Buscar mensagem para validar autor
      const messages = await this.storage.getMessages(clanId);
      const message = messages.find(m => m.id === messageId);

      if (!message) {
        throw new Error('Mensagem não encontrada');
      }

      // Validar que é o autor
      if (message.author_totem !== totemId) {
        throw new Error('Você só pode deletar suas próprias mensagens');
      }

      // Validar que não está deletada
      if (message.deleted === 1 || message.deleted === true) {
        throw new Error('Mensagem já foi deletada');
      }

      // Marcar como deletada (não apagar do banco)
      await this.storage.updateMessage(messageId, {
        deleted: 1,
        message: 'Mensagem apagada', // Texto padrão (não criptografado)
        original_content: null,
        edited: 0
      });

      // Registra evento de auditoria (Sprint 7 - ETAPA 3)
      try {
        await logSecurityEvent(SECURITY_EVENTS.MESSAGE_DELETED, {
          messageId,
          clanId
        }, totemId);
      } catch (error) {
        console.error('Erro ao registrar evento de auditoria:', error);
        // Não falha a exclusão se a auditoria falhar
      }

      return true;
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      throw new Error(`Erro ao deletar mensagem: ${error.message}`);
    }
  }
}

export default new MessagesManager();

