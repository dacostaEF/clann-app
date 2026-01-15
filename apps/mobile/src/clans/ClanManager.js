import ClanStorage from './ClanStorage';
import { validateClanName, validateClanDescription } from '../config/ClanTypes';
import { logSecurityEvent, SECURITY_EVENTS } from '../security/SecurityLog';
import { loadTotemSecure } from '../storage/secureStore';

export default class ClanManager {
  // Cria novo CLANN
  static async createClan(clanData, creatorTotemId) {
    // Validações
    const nameError = validateClanName(clanData.name);
    if (nameError) throw new Error(nameError);
    
    const descError = validateClanDescription(clanData.description);
    if (descError) throw new Error(descError);
    
    // MVP 1: Obter publicKey do fundador para Key Exchange
    let founderPublicKey = null;
    try {
      const totem = await loadTotemSecure();
      if (totem && totem.publicKey) {
        founderPublicKey = totem.publicKey;
      }
    } catch (e) {
      console.warn('[ClanManager] Não foi possível obter publicKey do fundador');
    }
    
    // Cria CLANN com publicKey do fundador
    const clan = await ClanStorage.createClan(clanData, creatorTotemId, founderPublicKey);
    
    // Registra evento de auditoria (Sprint 7 - ETAPA 3)
    try {
      await logSecurityEvent(SECURITY_EVENTS.CLAN_CREATED, {
        clanId: clan.id,
        clanName: clan.name,
        inviteCode: clan.invite_code
      }, creatorTotemId);
    } catch (error) {
      console.error('Erro ao registrar evento de auditoria:', error);
      // Não falha a criação se a auditoria falhar
    }
    
    return clan;
  }

  // Entra em CLANN
  static async joinClan(inviteCode, totemId) {
    // Normaliza código (maiúsculas, sem espaços)
    const normalizedCode = inviteCode.toUpperCase().replace(/\s/g, '');
    
    if (!normalizedCode.match(/^[A-Z0-9]{6}$/)) {
      throw new Error('Código inválido. Use 6 letras/números.');
    }
    
    const clan = await ClanStorage.joinClan(normalizedCode, totemId);
    
    // Registra evento de auditoria (Sprint 7 - ETAPA 3)
    try {
      await logSecurityEvent(SECURITY_EVENTS.MEMBER_JOINED, {
        clanId: clan.id,
        clanName: clan.name,
        inviteCode: normalizedCode
      }, totemId);
    } catch (error) {
      console.error('Erro ao registrar evento de auditoria:', error);
      // Não falha o join se a auditoria falhar
    }
    
    return clan;
  }

  // Busca CLANN por código
  static async findClanByCode(inviteCode) {
    // Implementação simplificada - busca local
    // Em versão futura, buscará em servidor
    return null; // Placeholder
  }

  // Verifica se usuário pode criar mais CLANNs
  static async canCreateClan(totemId) {
    const userClans = await ClanStorage.getUserClans(totemId);
    
    // Limite de 5 CLANNs por usuário
    if (userClans.length >= 5) {
      return {
        canCreate: false,
        reason: 'Limite de CLANNs atingido (máximo 5)'
      };
    }
    
    return { canCreate: true };
  }

  // Atualiza informações do CLANN
  static async updateClan(clanId, updates, requesterTotemId) {
    // Verifica permissões
    const clan = await ClanStorage.getClanById(clanId, requesterTotemId);
    
    if (!clan.isMember) {
      throw new Error('Você não é membro deste CLANN');
    }
    
    if (clan.userRole !== 'founder' && clan.userRole !== 'admin') {
      throw new Error('Apenas fundadores e admins podem editar o CLANN');
    }
    
    // Validações
    if (updates.name) {
      const nameError = validateClanName(updates.name);
      if (nameError) throw new Error(nameError);
    }
    
    if (updates.description) {
      const descError = validateClanDescription(updates.description);
      if (descError) throw new Error(descError);
    }
    
    // Atualiza (implementação simplificada)
    // Em produção, usar ClanStorage.updateClan()
    return { success: true, clanId };
  }

  /**
   * DOSE 2: Entra em CLANN usando apenas clannId (do Gateway)
   * 🔒 REGRA: Esta função deve funcionar APENAS com clannId
   * 🔒 REGRA: NUNCA buscar dados do Gateway aqui
   * 🔒 REGRA: Todas validações são locais
   * 
   * @param {string} clannId - ID do CLANN vindo do Gateway (ex: "clann_lab_secreto")
   * @param {string} totemId - ID do Totem local
   * @returns {Promise<Object>} CLANN criado/encontrado
   */
  static async joinClanByClannId(clannId, totemId) {
    // 🔒 VALIDAÇÃO 1: clannId é obrigatório
    if (!clannId || typeof clannId !== 'string') {
      throw new Error('CLANN ID inválido');
    }

    // 🔒 VALIDAÇÃO 2: Verificar Totem LOCALMENTE
    if (!totemId) {
      throw new Error('Totem local não encontrado');
    }

    // ClanStorage é uma instância única exportada
    // init() já foi chamado na inicialização do app, mas chamamos novamente para garantir
    if (ClanStorage.init) {
      await ClanStorage.init();
    }

    // 🔒 VALIDAÇÃO 3: Verificar se já é membro (local)
    const userClans = await ClanStorage.getUserClans(totemId);
    const existingClan = userClans.find(clan => {
      // Verifica se o CLANN tem o clannId externo armazenado
      return clan.external_clann_id === clannId || clan.clann_id === clannId;
    });

    if (existingClan) {
      console.log('Já é membro deste CLANN');
      return existingClan;
    }

    try {
      // 1. Verificar se CLANN já existe localmente (por clannId externo)
      const allClans = await ClanStorage.getAllClans();
      let clan = allClans.find(c => {
        return c.external_clann_id === clannId || c.clann_id === clannId;
      });

      if (!clan) {
        // 2. Criar estrutura local para o CLANN (se não existe)
        // Usa o clannId como nome temporário se não tiver nome
        const clanData = {
          name: `CLANN ${clannId.substring(0, 8)}`,
          description: '',
          icon: '🏛️',
          privacy: 'public',
          external_clann_id: clannId // Armazena o clannId do Gateway
        };

        // Cria o CLANN localmente (sem fundador específico, pois é entrada via convite)
        clan = await ClanStorage.createClanForInvite(clanData, totemId);
      }

      // 3. Adicionar como membro (se ainda não for)
      const isMember = userClans.some(uc => uc.id === clan.id);
      if (!isMember) {
        await ClanStorage.addMember(clan.id, totemId, 'member');
        // Recarrega o CLANN para ter os dados atualizados
        clan = await ClanStorage.getClanById(clan.id);
      }

      // 4. Registrar entrada localmente
      await logSecurityEvent(SECURITY_EVENTS.MEMBER_JOINED, {
        clanId: clan.id,
        clanName: clan.name,
        clannId: clannId
      }, totemId);

      console.log(`✅ Entrou no CLANN localmente: ${clannId} (ID local: ${clan.id})`);
      return clan;

    } catch (error) {
      console.error('Erro na entrada local no CLANN:', error);
      throw error;
    }
  }
}

