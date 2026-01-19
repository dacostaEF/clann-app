/**
 * KeyExchangeService - Serviço de troca de chaves para CLANN (MVP 1)
 * 
 * Coordena o fluxo JOIN_REQUEST / JOIN_ACCEPT entre joiner e fundador
 */

import { loadTotemSecure } from '../storage/secureStore';
import KeyManager from '../security/keyManager';
import ClanStorage from '../clans/ClanStorage';
import {
  generateRequestId,
  encryptGroupKeyForJoiner,
  decryptGroupKeyFromFounder,
  registerPendingRequest,
  resolvePendingRequest,
  rejectPendingRequest,
  hasPendingRequest
} from '../security/keyExchange';

class KeyExchangeService {
  constructor() {
    this.gatewayClient = null;
    this.statusHandlerUnregister = null;
  }

  /**
   * Inicializa o serviço com o GatewayClient
   * @param {Object} gatewayClient - Instância do GatewayClient
   */
  init(gatewayClient) {
    if (this.gatewayClient === gatewayClient) {
      return; // Já inicializado com este client
    }

    // Remove handler anterior se existir
    if (this.statusHandlerUnregister) {
      this.statusHandlerUnregister();
    }

    this.gatewayClient = gatewayClient;

    // Registra handler para eventos de key exchange
    this.statusHandlerUnregister = gatewayClient.registerStatusHandler(
      this.handleStatusEvent.bind(this)
    );
  }

  /**
   * Handler para eventos de status do Gateway
   * @param {Object} event - Evento de status
   */
  async handleStatusEvent(event) {
    if (event.type === 'join_request') {
      await this.handleJoinRequest(event);
    } else if (event.type === 'join_accept') {
      await this.handleJoinAccept(event);
    }
  }

  /**
   * Inicia o fluxo de JOIN como joiner
   * @param {string} inviteCode - Código de convite
   * @param {number|null} clannId - ID do CLANN (opcional, null para convidado novo)
   * @returns {Promise<Object>} Resultado do join com groupKey e clannId
   */
  async initiateJoin(inviteCode, clannId = null) {
    // 1. Carregar dados do meu Totem
    const myTotem = await loadTotemSecure();
    if (!myTotem || !myTotem.totemId || !myTotem.publicKey) {
      throw new Error('Totem não encontrado');
    }

    // 2. Gerar requestId
    const requestId = generateRequestId();

    // 3. Registrar request pendente (para validação de replay)
    // Armazenar inviteCode para criar CLANN após JOIN_ACCEPT
    const resultPromise = registerPendingRequest(requestId, inviteCode);

    // 4. Enviar JOIN_REQUEST via Gateway
    // 🚫 NÃO INCLUIR 'clannId' AQUI. O fundador o identificará pelo inviteCode.
    this.gatewayClient.sendJoinRequest({
      inviteCode,
      joinerTotemId: myTotem.totemId,
      joinerPublicKey: myTotem.publicKey,
      requestId
      // clannId removido: fundador identificará pelo inviteCode
    });

    // 5. Aguardar JOIN_ACCEPT (ou timeout)
    return resultPromise;
  }

  /**
   * Handler para JOIN_REQUEST recebido (sou fundador/admin)
   * @param {Object} payload - Dados do JOIN_REQUEST
   */
  async handleJoinRequest(payload) {
    const { inviteCode, joinerTotemId, joinerPublicKey, requestId, clannId } = payload;

    try {
      // 1. Validar se o inviteCode existe e corresponde ao clannId
      const clan = await ClanStorage.getClanByInviteCode(inviteCode);
      if (!clan) {
        console.warn(`[KeyExchange] Código de convite inválido: ${inviteCode}`);
        return;
      }

      // Verificar se clannId corresponde (se fornecido)
      if (clannId && clan.id.toString() !== clannId.toString()) {
        console.warn(`[KeyExchange] clannId não corresponde ao inviteCode`);
        return;
      }

      // 2. Carregar meu Totem (fundador)
      const myTotem = await loadTotemSecure();
      if (!myTotem || !myTotem.totemId || !myTotem.privateKey) {
        console.warn('[KeyExchange] Totem do fundador não encontrado');
        return;
      }

      // 3. Verificar se sou fundador/admin do CLANN
      const myRole = await ClanStorage.getUserRole(clan.id, myTotem.totemId);
      if (myRole !== 'founder' && myRole !== 'admin') {
        // Não sou fundador/admin, ignorar (outro membro responderá)
        return;
      }

      // 4. Obter groupKey do CLANN
      const groupKey = await KeyManager.getGroupKey(clan.id);

      // 5. Cifrar groupKey para o joiner usando ECDH
      const encryptedGroupKey = encryptGroupKeyForJoiner(
        groupKey,
        joinerPublicKey,
        myTotem.privateKey
      );

      // 6. Enviar JOIN_ACCEPT com dados do CLANN para o joiner criar localmente
      this.gatewayClient.sendJoinAccept({
        clannId: clan.id.toString(),
        toTotemId: joinerTotemId,
        fromTotemId: myTotem.totemId,
        encryptedGroupKey,
        requestId,
        // ✅ Dados do CLANN para o joiner criar localmente
        clanName: clan.name,
        inviteCode: inviteCode,
        clanDescription: clan.description || null,
        clanIcon: clan.icon || '🏛️'
      });

      console.log(`[KeyExchange] JOIN_ACCEPT enviado para ${joinerTotemId.substring(0, 10)}...`);

    } catch (error) {
      console.error('[KeyExchange] Erro ao processar JOIN_REQUEST:', error);
    }
  }

  /**
   * Handler para JOIN_ACCEPT recebido (sou joiner)
   * @param {Object} payload - Dados do JOIN_ACCEPT
   */
  async handleJoinAccept(payload) {
    const { 
      clannId, 
      fromTotemId, 
      encryptedGroupKey, 
      requestId,
      clanName,
      inviteCode,
      clanDescription,
      clanIcon
    } = payload;

    try {
      // 1. Validar requestId (proteção contra replay)
      if (!hasPendingRequest(requestId)) {
        console.warn('[KeyExchange] JOIN_ACCEPT com requestId inválido ou expirado');
        return;
      }

      // 2. Carregar meu Totem
      const myTotem = await loadTotemSecure();
      if (!myTotem || !myTotem.privateKey) {
        rejectPendingRequest(requestId, new Error('Totem não encontrado'));
        return;
      }

      // 3. Obter publicKey do fundador
      // Para MVP, usamos o fromTotemId para buscar a publicKey
      // Em produção, a publicKey deveria vir no payload ou ser buscada de forma segura
      const founderPublicKey = await this.getPublicKeyForTotem(fromTotemId, clannId);
      if (!founderPublicKey) {
        rejectPendingRequest(requestId, new Error('PublicKey do fundador não encontrada'));
        return;
      }

      // 4. Decifrar groupKey usando ECDH
      const groupKey = decryptGroupKeyFromFounder(
        encryptedGroupKey,
        founderPublicKey,
        myTotem.privateKey
      );

      // 5. ✅ CRIAR CLANN LOCALMENTE (após JOIN_ACCEPT)
      // Verificar se CLANN já existe localmente (caso raro de rejoin)
      let clan = await ClanStorage.getClanByInviteCode(inviteCode);
      
      if (!clan) {
        // Criar CLANN localmente com dados recebidos do fundador
        const clanData = {
          name: clanName || `CLANN ${clannId}`,
          description: clanDescription || '',
          icon: clanIcon || '🏛️',
          privacy: 'public',
          invite_code: inviteCode, // ✅ Usar inviteCode recebido do fundador
          external_clann_id: clannId // Armazenar ID do fundador como referência
        };
        
        // Criar CLANN localmente (sem fundador específico, pois é entrada via convite)
        clan = await ClanStorage.createClanForInvite(clanData, myTotem.totemId);
        
        // Atualizar o ID local para corresponder ao clannId recebido (se necessário)
        // O clannId recebido é o ID do fundador, mas localmente temos um ID diferente
        // Por enquanto, mantemos o ID local e armazenamos o clannId como referência
      }
      
      // 6. Adicionar como membro (se ainda não for)
      const totemId = myTotem.totemId;
      const userClans = await ClanStorage.getUserClans(totemId);
      const isMember = userClans.some(uc => uc.id === clan.id);
      
      if (!isMember) {
        await ClanStorage.addMember(clan.id, totemId, 'member');
        // Recarregar o CLANN para ter os dados atualizados
        clan = await ClanStorage.getClanById(clan.id);
      }

      // 7. Salvar groupKey no KeyManager (usando ID local do CLANN)
      await KeyManager.saveGroupKey(clan.id, groupKey);

      // 8. Resolver o request pendente com dados do CLANN criado
      resolvePendingRequest(requestId, {
        clannId: clan.id.toString(), // ID local do CLANN criado
        groupKeyReceived: true,
        clan: clan
      });

      console.log(`[KeyExchange] GroupKey recebida e CLANN criado localmente: ${clan.id}`);

    } catch (error) {
      console.error('[KeyExchange] Erro ao processar JOIN_ACCEPT:', error);
      rejectPendingRequest(requestId, error);
    }
  }

  /**
   * Obtém a publicKey de um Totem
   * Para MVP, busca do membro do CLANN ou usa a que veio no JOIN_REQUEST
   * @param {string} totemId - ID do Totem
   * @param {string} clannId - ID do CLANN
   * @returns {Promise<string|null>} PublicKey em hex ou null
   */
  async getPublicKeyForTotem(totemId, clannId) {
    try {
      // Buscar membro do CLANN que tem essa publicKey
      const members = await ClanStorage.getClanMembers(parseInt(clannId));
      const member = members?.find(m => m.totem_id === totemId);
      
      if (member && member.public_key) {
        return member.public_key;
      }

      // Fallback: buscar do clan info (fundador)
      const clan = await ClanStorage.getClanById(parseInt(clannId));
      if (clan && clan.founder_totem === totemId && clan.founder_public_key) {
        return clan.founder_public_key;
      }

      return null;
    } catch (error) {
      console.error('[KeyExchange] Erro ao buscar publicKey:', error);
      return null;
    }
  }

  /**
   * Limpa recursos
   */
  cleanup() {
    if (this.statusHandlerUnregister) {
      this.statusHandlerUnregister();
      this.statusHandlerUnregister = null;
    }
    this.gatewayClient = null;
  }
}

export default new KeyExchangeService();
