import MessagesStorage from './MessagesStorage';
import ClanStorage from '../clans/ClanStorage';
import { encryptMessage, decryptMessage, initE2E } from '../security/e2e';
import ReactionsManager, { AVAILABLE_REACTIONS } from './ReactionsManager';
import DeliveryManager from './DeliveryManager';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { updateLastMessage } from './MessageCache';
import { compressText, decompressText } from '../utils/compression';

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

    // Criptografar mensagem antes de salvar (Sprint 6)
    try {
      // Comprimir texto antes de criptografar (Sprint 7 - ETAPA 6)
      const compressedText = compressText(trimmedText);
      const encryptedText = await encryptMessage(parseInt(clanId), compressedText);
      
      // Salvar mensagem criptografada com opções de self-destruct (Sprint 6)
      const message = await this.storage.addMessage(
        parseInt(clanId),
        authorTotem.trim(),
        encryptedText,
        { selfDestructAt, burnAfterRead }
      );
      
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
              editedAt: msg.edited_at || null
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
              error: true
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

