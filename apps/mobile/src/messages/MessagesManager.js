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
import logger from '../utils/logger';

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
   * @param {Object} options - Opções de inicialização
   * @param {boolean} options.required - Se true, lança erro em caso de falha. Se false, retorna false silenciosamente
   * @returns {Promise<boolean>} true se conectado com sucesso, false se falhou e não é obrigatório
   */
  async initializeGateway(clannId = null, options = { required: false }) {
    // === ✅ LOG DE ENTRADA IRREFUTÁVEL ===
    console.log('🔴 [GATEWAY-DEBUG-ENTRY] FUNÇÃO CHAMADA. clannId:', clannId, 'required:', options.required);
    console.log('🔴 [GATEWAY-DEBUG-ENTRY] Tipo de clannId:', typeof clannId, 'Valor:', clannId);
    console.log('🔴 [GATEWAY-DEBUG-ENTRY] Tipo de options:', typeof options, 'Valor:', JSON.stringify(options));
    
    // Log antes da primeira validação crítica
    console.log('🔴 [GATEWAY-DEBUG-STEP1] Antes de qualquer validação...');
    console.log('🔴 [GATEWAY-DEBUG-STEP1a] __DEV__:', __DEV__);
    console.log('🔴 [GATEWAY-DEBUG-STEP1b] process existe?', typeof process !== 'undefined');
    console.log('🔴 [GATEWAY-DEBUG-STEP1c] process.env existe?', typeof process !== 'undefined' && !!process?.env);

    try {
      console.log('🔴 [GATEWAY-DEBUG-STEP1d] Entrando no bloco try...');

      // Verificar se logger está disponível antes de usar
      console.log('🔍 [GATEWAY-STEP-0e] Verificando logger...');
      if (logger?.gateway) {
        logger.gateway('Inicializando Gateway', { clannId });
        console.log('🔍 [GATEWAY-STEP-0f] Logger usado com sucesso');
      } else {
        console.warn('⚠️ [GATEWAY-STEP-0f] logger.gateway indisponível, continuando sem logger');
      }

      // ✅ ETAPA 1: VALIDAÇÃO DA URL (PONTO CRÍTICO DE FALHA)
      console.log('🔍 [GATEWAY-STEP-1] Validando URL do Gateway...');
      const envValue = typeof process !== 'undefined' && process.env 
        ? process.env.EXPO_PUBLIC_GATEWAY_URL 
        : undefined;
      console.log('🔍 [GATEWAY-STEP-1a] envValue:', envValue || 'undefined');
      
      const gatewayUrl = envValue;
      console.log('🔍 [GATEWAY-STEP-1b] gatewayUrl final:', gatewayUrl || 'NENHUMA');
      
      if (!gatewayUrl) {
        console.error('❌ [GATEWAY-STEP-1c] EARLY RETURN: gatewayUrl é undefined ou vazia.');
        const error = new Error('Gateway URL ausente: EXPO_PUBLIC_GATEWAY_URL deve ser definida no .env');
        if (options.required) {
          throw error;
        }
        return false; // ⚠️ Ponto de retorno antecipado
      }
      console.log('🔍 [GATEWAY-STEP-1d] URL válida:', gatewayUrl);
      
      // 🌐 VALIDAÇÃO: Detectar URLs inválidas para LAN
      if (__DEV__) {
        const invalidPatterns = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          'ws://localhost',
          'ws://127.0.0.1',
          'ws://0.0.0.0'
        ];
        
        const isInvalid = invalidPatterns.some(pattern => gatewayUrl.includes(pattern));
        if (isInvalid) {
          console.warn('⚠️ [GATEWAY-STEP-1e] Gateway URL pode ser inválida para LAN:', gatewayUrl);
          console.warn('   Use o IP real da sua máquina: ws://192.168.x.x:8080');
        } else {
          console.log('🔍 [GATEWAY-STEP-1e] URL parece válida para LAN');
        }
      }

      // ✅ ETAPA 2: OBTENÇÃO DO TOTEM (OUTRO PONTO CRÍTICO)
      console.log('🔍 [GATEWAY-STEP-2] Obtendo dados do Totem...');
      let totemData;
      try {
        totemData = await loadTotemSecure();
        console.log('🔍 [GATEWAY-STEP-2a] Totem obtido?', totemData ? 'SIM' : 'NÃO');
        console.log('🔍 [GATEWAY-STEP-2b] TotemId:', totemData?.totemId || 'null/undefined');
        console.log('🔍 [GATEWAY-STEP-2c] PublicKey existe?', totemData?.publicKey ? 'SIM' : 'NÃO');
      } catch (error) {
        console.error('❌ [GATEWAY-STEP-2d] ERRO ao obter Totem:', error.message);
        console.error('❌ [GATEWAY-STEP-2e] Stack:', error.stack);
        if (options.required) {
          throw error;
        }
        return false; // ⚠️ Outro ponto de retorno antecipado
      }

      if (!totemData || !totemData.totemId || !totemData.publicKey) {
        console.warn('⚠️ [GATEWAY-STEP-2f] Totem incompleto:', {
          temTotemData: !!totemData,
          temTotemId: !!totemData?.totemId,
          temPublicKey: !!totemData?.publicKey
        });
        
        if (options.required) {
          throw new Error('Totem não encontrado ou incompleto');
        }
        console.warn('⚠️ [GATEWAY-STEP-2g] Continuando sem totemId válido (pode falhar na conexão)');
      } else {
        console.log('🔍 [GATEWAY-STEP-2h] Totem válido, prosseguindo...');
      }

      // ✅ ETAPA 3: CRIAÇÃO DO GATEWAYCLIENT (O OBJETIVO FINAL)
      console.log('🔍 [GATEWAY-STEP-3] VERIFICANDO/CRIANDO gatewayClient...');
      console.log('🔍 [GATEWAY-STEP-3a] gatewayClient atual existe?', this.gatewayClient ? 'SIM' : 'NÃO');
      
      if (!this.gatewayClient) {
        console.log('🔧 [GATEWAY-STEP-3b] INSTANCIANDO NOVO GatewayClient AGORA.');
        console.log('🔧 [GATEWAY-STEP-3c] Parâmetros:', { 
          gatewayUrl, 
          clannId, 
          totemId: totemData?.totemId || 'null' 
        });
        try {
          this.gatewayClient = createGatewayClient({
            gatewayUrl,
          });
          console.log('✅ [GATEWAY-STEP-3d] GatewayClient INSTANCIADO com sucesso.');
          console.log('✅ [GATEWAY-STEP-3e] gatewayClient é null?', this.gatewayClient ? 'NÃO' : 'SIM');
          console.log('✅ [GATEWAY-STEP-3f] Tipo do gatewayClient:', typeof this.gatewayClient);
        } catch (error) {
          console.error('❌ [GATEWAY-STEP-3g] ERRO ao instanciar GatewayClient:', error.message);
          console.error('❌ [GATEWAY-STEP-3h] Stack:', error.stack);
          throw error; // Não tem fallback aqui
        }
      } else {
        console.log('🔧 [GATEWAY-STEP-3b] Reutilizando gatewayClient existente.');
      }

      // ✅ ETAPA 4: CONEXÃO (SE O CLIENTE JÁ EXISTIR E TOTEM VÁLIDO)
      console.log('🔍 [GATEWAY-STEP-4] Verificando se precisa conectar...');
      console.log('🔍 [GATEWAY-STEP-4a] isGatewayConnected atual:', this.isGatewayConnected);
      console.log('🔍 [GATEWAY-STEP-4b] gatewayClient existe?', this.gatewayClient ? 'SIM' : 'NÃO');
      console.log('🔍 [GATEWAY-STEP-4c] totemData válido?', (totemData && totemData.totemId && totemData.publicKey) ? 'SIM' : 'NÃO');
      
      if (this.gatewayClient && !this.isGatewayConnected) {
        // Só tenta conectar se tiver totemData válido
        if (totemData && totemData.totemId && totemData.publicKey) {
          console.log('🔌 [GATEWAY-STEP-4d] Tentando conectar...');
          console.log('🔌 [GATEWAY-STEP-4e] Parâmetros de conexão:', {
            totemId: totemData.totemId.substring(0, 8) + '...',
            publicKey: totemData.publicKey ? 'existe' : 'null',
            clannId: clannId || 'null'
          });
          
          try {
            await this.gatewayClient.connect(
              totemData.totemId, 
              totemData.publicKey, 
              clannId
            );
            this.isGatewayConnected = true;
            console.log('✅ [GATEWAY-STEP-4f] Conexão ESTABELECIDA com sucesso.');
          } catch (error) {
            console.error('❌ [GATEWAY-STEP-4g] ERRO na conexão:', error.message);
            console.error('❌ [GATEWAY-STEP-4h] Stack:', error.stack);
            this.isGatewayConnected = false;
            // Não joga o cliente fora! Mantém a instância.
            if (options.required) {
              throw error;
            }
            console.warn('⚠️ [GATEWAY-STEP-4i] Conexão falhou, mas gatewayClient mantido para tentativas futuras');
          }
        } else {
          console.warn('⚠️ [GATEWAY-STEP-4d] TotemData inválido, não é possível conectar agora.');
          console.warn('⚠️ [GATEWAY-STEP-4e] gatewayClient foi criado, mas conexão será feita quando totemData estiver disponível.');
          this.isGatewayConnected = false;
        }
      } else {
        if (!this.gatewayClient) {
          console.log('🔌 [GATEWAY-STEP-4d] Cliente não existe, não pode conectar.');
        } else {
          console.log('🔌 [GATEWAY-STEP-4d] Já conectado (isGatewayConnected = true).');
        }
      }

      // ETAPA 5: CONFIGURAÇÃO PÓS-CONEXÃO
      if (this.isGatewayConnected) {
        console.log('🔍 [GATEWAY-STEP-5] Configurando handlers pós-conexão...');
        this.setupGatewayHandlers();
        console.log('🔍 [GATEWAY-STEP-5a] Handlers configurados');

        // MVP 1: Inicializar KeyExchangeService
        console.log('🔍 [GATEWAY-STEP-5b] Inicializando KeyExchangeService...');
        this.initKeyExchangeService();
        console.log('🔍 [GATEWAY-STEP-5c] KeyExchangeService inicializado');
      } else {
        console.warn('⚠️ [GATEWAY-STEP-5] Gateway não conectado, pulando configuração de handlers');
      }

      console.log('✅ [GATEWAY-FINAL] initializeGateway concluído.');
      console.log('✅ [GATEWAY-FINALa] isGatewayConnected:', this.isGatewayConnected);
      console.log('✅ [GATEWAY-FINALb] gatewayClient existe?', this.gatewayClient ? 'SIM' : 'NÃO');
      return this.isGatewayConnected;
    } catch (error) {
      // === ✅ LOG COMPLETO E EXPLÍCITO DO ERRO ===
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] ERRO COMPLETO NA INICIALIZAÇÃO:');
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Mensagem:', error?.message || 'SEM MENSAGEM');
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Stack:', error?.stack || 'SEM STACK');
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Tipo:', typeof error);
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] String:', error?.toString() || 'SEM toString()');
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Nome:', error?.name || 'SEM NOME');
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] ClannId:', clannId);
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Required:', options.required);
      console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] gatewayClient existe?', !!this.gatewayClient);
      
      // Tentar extrair mais informações do erro
      if (error) {
        try {
          console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Error completo (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        } catch (e) {
          console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Não foi possível serializar erro:', e.message);
        }
      }
      
      this.isGatewayConnected = false;

      // ⚠️ IMPORTANTE: NÃO destruir o gatewayClient em caso de erro!
      // Mantém a instância para tentativas futuras ou uso em modo offline
      // this.gatewayClient permanece disponível mesmo se desconectado

      // Se for obrigatório, lança erro para o chamador tratar
      if (options.required) {
        console.error('❌❌❌ [GATEWAY-ERROR-DETAILS] Erro é obrigatório, RELANÇANDO.');
        throw error; // Relança o erro original
      }

      // Se não for obrigatório, retorna false silenciosamente
      console.warn('⚠️ [GATEWAY] Erro não obrigatório, retornando false.');
      return false;
    }
  }

  /**
   * MVP 1: Inicializar KeyExchangeService
   */
  initKeyExchangeService() {
    try {
      // Import dinâmico para evitar dependência circular
      const KeyExchangeService = require('../services/KeyExchangeService').default;
      KeyExchangeService.init(this.gatewayClient);
      console.log('🔑 KeyExchangeService inicializado');
    } catch (error) {
      console.warn('⚠️ KeyExchangeService não disponível:', error.message);
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
   * ✅ Verificação de segurança contra null
   */
  async registerClannGatewayHandler(clanId) {
    const normalizedClanId = clanId.toString();

    // ✅ VERIFICAÇÃO CRÍTICA DE SEGURANÇA
    if (!this.gatewayClient) {
      console.warn('⚠️ [Gateway] gatewayClient é null ao tentar registrar handler. Inicialização pode estar incompleta.');
      console.warn('⚠️ [Gateway] Tentando inicializar Gateway sob demanda...');
      
      // Tentar inicializar sob demanda
      try {
        const success = await this.initializeGateway(normalizedClanId, { required: false });
        if (!success || !this.gatewayClient) {
          console.warn('⚠️ [Gateway] Não foi possível inicializar Gateway. Handler não registrado.');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ [Gateway] Erro ao inicializar Gateway sob demanda:', error.message);
        return false;
      }
    }

    // ✅ Verificar se já está registrado (evita duplicatas)
    if (this.registeredGatewayHandlers.has(normalizedClanId)) {
      console.log(`📡 Handler já registrado para CLANN ${normalizedClanId}`);
      return true;
    }

    // Se Gateway não está disponível, inicializar com clannId
    if (!this.isGatewayAvailable()) {
      try {
        const success = await this.initializeGateway(normalizedClanId, { required: false });
        if (!success || !this.gatewayClient) {
          console.warn('⚠️ Gateway não disponível, não é possível registrar handler');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ Gateway não disponível, não é possível registrar handler:', error.message);
        return false;
      }
    }

    // ✅ Verificação final antes de usar
    if (!this.gatewayClient || typeof this.gatewayClient.registerClannHandler !== 'function') {
      console.error('❌ [Gateway] gatewayClient inválido ou método registerClannHandler não existe');
      return false;
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
      const decryptResult = await decryptMessage(
        parseInt(payload.clannId),
        payload.encryptedPayload
      );

      // Se descriptografia falhou, não processar mensagem
      if (!decryptResult.ok) {
        console.warn('⚠️ Mensagem do Gateway não pôde ser descriptografada (sem envelope ou HMAC inválido)');
        return;
      }

      // 3. Descomprimir texto
      const decompressedText = decompressText(decryptResult.text);

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
              // ✅ PASSO 3: decryptMessage agora retorna {ok: boolean, text?: string}
              const result = await decryptMessage(parseInt(clanId), msg.message);
              
              if (!result.ok) {
                // Mensagem sem envelope ou HMAC inválido = descartar
                decryptedText = '[Mensagem indisponível]';
              } else {
                // Mensagem válida, descomprimir texto após descriptografar (Sprint 7 - ETAPA 6)
                decryptedText = decompressText(result.text);
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
            
            // ✅ PASSO 3: Flag interna para indicar se mensagem foi descartada
            const isDiscarded = decryptedText === '[Mensagem indisponível]';
            
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
              status: msg.status || 'sent', // PASSO 4: Retornar status (default 'sent' para compatibilidade)
              _discarded: isDiscarded // Flag interna (não expor na UI)
            };
          } catch (error) {
            // Se falhar ao processar mensagem, retorna mensagem indisponível
            console.warn('Erro ao processar mensagem:', error);
            return {
              id: msg.id,
              clanId: msg.clan_id,
              authorTotem: msg.author_totem,
              message: '[Mensagem indisponível]',
              timestamp: msg.timestamp,
              error: true,
              status: msg.status || 'sent', // PASSO 4: Retornar status mesmo em caso de erro
              _discarded: true // Flag interna
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
          const decryptResult = await decryptMessage(parseInt(msg.clan_id), msg.message);
          if (!decryptResult.ok) {
            decryptedText = '[Mensagem indisponível]';
          } else {
            decryptedText = decryptResult.text;
          }
        } catch (error) {
          decryptedText = '[Mensagem indisponível]';
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

