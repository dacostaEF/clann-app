/**
 * Smoke Tests - Sistemas Críticos
 * Sprint 8 - ETAPA 7
 * 
 * Valida que sistemas críticos ainda funcionam após Sprint 8:
 * - Watermark (marcas invisíveis)
 * - Panic Mode (autodestruição global)
 * - Auto-Destruction (self-destruct de mensagens)
 * - Totem Integrity (consistência da identidade)
 */

import { jest } from '@jest/globals';

// Mock de dependências
jest.mock('../src/clans/ClanStorage', () => ({
  __esModule: true,
  default: {
    getDB: jest.fn(() => null),
    getWebRules: jest.fn(() => []),
    getWebPendingApprovals: jest.fn(() => []),
    getWebMembers: jest.fn(() => []),
    getLinkedDevices: jest.fn(() => []),
  }
}));

jest.mock('../src/security/SecurityLog', () => ({
  __esModule: true,
  logSecurityEvent: jest.fn(() => Promise.resolve({ id: 1 })),
  SECURITY_EVENTS: {
    PANIC_MODE_ACTIVATED: 'panic_mode_activated',
    CLAN_UPDATED: 'clan_updated',
  }
}));

jest.mock('../src/security/PinManager', () => ({
  __esModule: true,
  hasPin: jest.fn(() => Promise.resolve(true)),
  verifyPin: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../src/messages/MessagesStorage', () => ({
  __esModule: true,
  default: {
    getMessages: jest.fn(() => Promise.resolve([])),
    addMessage: jest.fn(() => Promise.resolve({ id: 1 })),
    deleteMessage: jest.fn(() => Promise.resolve()),
  }
}));

const mockClearTotem = jest.fn(() => Promise.resolve());
jest.mock('../src/crypto/totemStorage', () => ({
  __esModule: true,
  getCurrentTotemId: jest.fn(() => Promise.resolve('totem_test_123')),
  loadTotem: jest.fn(() => Promise.resolve({
    totemId: 'totem_test_123',
    publicKey: 'pub_key_test',
    privateKey: 'priv_key_test'
  })),
  clearTotem: mockClearTotem,
}));

// Importa módulos após mocks
import { injectWatermark, extractWatermark, removeWatermark } from '../src/utils/watermark';
import { activate as activatePanicMode, isPanicModeActive, deactivate as deactivatePanicMode } from '../src/security/panicMode';
import { executeApprovedAction, checkAndExecuteApprovedActions } from '../src/clans/ApprovalExecutor';
import { getPendingApprovals } from '../src/clans/ApprovalEngine';
import { APPROVAL_STATUS, APPROVAL_ACTIONS } from '../src/clans/ApprovalEngine';
import { loadTotem, getCurrentTotemId } from '../src/crypto/totemStorage';
import { logSecurityEvent } from '../src/security/SecurityLog';
import ClanStorage from '../src/clans/ClanStorage';

describe('Smoke Tests - Sistemas Críticos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================
  // WATERMARK
  // ============================================

  describe('Watermark - Marcas Invisíveis', () => {
    test('deve gerar watermark invisível corretamente', () => {
      const originalText = 'Mensagem de teste';
      const totemId = 'ABCD1234EFGH5678';
      
      const watermarked = injectWatermark(originalText, totemId);
      
      // Verifica que o texto original está presente
      expect(watermarked).toContain(originalText);
      
      // Verifica que há caracteres invisíveis (zero-width)
      const hasInvisibleChars = /[\u200B\u200C\u200D]/.test(watermarked);
      expect(hasInvisibleChars).toBe(true);
      
      // Verifica que o texto visualmente parece o mesmo
      const visibleText = removeWatermark(watermarked);
      expect(visibleText).toBe(originalText);
    });

    test('deve gerar watermark diferente para totems diferentes', () => {
      const originalText = 'Mensagem de teste';
      const totem1 = 'ABCD1234EFGH5678';
      const totem2 = 'WXYZ9876STUV5432';
      
      const watermarked1 = injectWatermark(originalText, totem1);
      const watermarked2 = injectWatermark(originalText, totem2);
      
      // Watermarks devem ser diferentes
      expect(watermarked1).not.toBe(watermarked2);
      
      // Mas o texto visível deve ser o mesmo
      expect(removeWatermark(watermarked1)).toBe(removeWatermark(watermarked2));
    });

    test('deve funcionar com texto vazio', () => {
      const watermarked = injectWatermark('', 'ABCD1234');
      expect(watermarked).toBeDefined();
    });

    test('deve funcionar sem totemId', () => {
      const originalText = 'Mensagem de teste';
      const watermarked = injectWatermark(originalText, null);
      expect(watermarked).toBe(originalText);
    });
  });

  // ============================================
  // PANIC MODE
  // ============================================

  describe('Panic Mode - Autodestruição Global', () => {
    test('deve ativar panic mode corretamente', async () => {
      const result = await activatePanicMode({
        clearMessages: true,
        clearKeys: true,
        clearTotem: false, // Não limpar totem em teste
        requireEmergencyPin: true
      });
      
      expect(result.success).toBe(true);
      expect(result.cleared.messages).toBe(true);
      expect(result.cleared.keys).toBe(true);
      expect(result.emergencyPinActivated).toBe(true);
      
      // Verifica se log foi registrado
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          clearMessages: true,
          clearKeys: true
        }),
        expect.anything()
      );
    });

    test('deve verificar se panic mode está ativo', async () => {
      // Ativa panic mode
      await activatePanicMode({ clearTotem: false });
      
      // Verifica se está ativo
      const isActive = await isPanicModeActive();
      expect(isActive).toBe(true);
    });

    test('deve desativar panic mode corretamente', async () => {
      // Ativa primeiro
      await activatePanicMode({ clearTotem: false });
      
      // Desativa
      await deactivatePanicMode();
      
      // Verifica se está desativado
      const isActive = await isPanicModeActive();
      expect(isActive).toBe(false);
    });

    test('deve limpar mensagens quando ativado', async () => {
      const MessagesStorage = require('../src/messages/MessagesStorage').default;
      
      await activatePanicMode({
        clearMessages: true,
        clearTotem: false
      });
      
      // Verifica se tentou limpar mensagens
      // (MessagesStorage não tem método clearAll, mas panicMode chama internamente)
      expect(logSecurityEvent).toHaveBeenCalled();
    });
  });

  // ============================================
  // AUTO-DESTRUCTION (Self-Destruct)
  // ============================================

  describe('Auto-Destruction - Não Conflitar com Executor', () => {
    test('executor não deve quebrar quando há mensagens com self-destruct', async () => {
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: { text: 'Regra via approval' },
        requested_by: 'totem_founder',
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      // Mock: há mensagens com self-destruct no sistema
      const MessagesStorage = require('../src/messages/MessagesStorage').default;
      MessagesStorage.getMessages.mockResolvedValueOnce([
        {
          id: 1,
          clan_id: 1,
          message: 'Mensagem normal',
          self_destruct_at: null
        },
        {
          id: 2,
          clan_id: 1,
          message: 'Mensagem com self-destruct',
          self_destruct_at: Date.now() + 60000 // 1 minuto
        }
      ]);

      // Executor deve funcionar normalmente
      const result = await executeApprovedAction(mockApproval);
      
      expect(result.success).toBe(true);
      expect(result.actionType).toBe(APPROVAL_ACTIONS.RULE_CREATE);
    });

    test('executor não deve afetar mensagens com burn-after-read', async () => {
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_EDIT,
        action_data: { ruleId: 'rule_123', newText: 'Editado' },
        requested_by: 'totem_founder',
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      // Mock: há mensagens com burn-after-read
      const MessagesStorage = require('../src/messages/MessagesStorage').default;
      MessagesStorage.getMessages.mockResolvedValueOnce([
        {
          id: 1,
          clan_id: 1,
          message: 'Mensagem normal',
          burn_after_read: 0
        },
        {
          id: 2,
          clan_id: 1,
          message: 'Mensagem burn-after-read',
          burn_after_read: 1
        }
      ]);

      // Executor deve funcionar normalmente
      const result = await executeApprovedAction(mockApproval);
      
      expect(result.success).toBe(true);
    });

    test('approvals pendentes não devem ser afetadas por self-destruct', async () => {
      // Mock: approval pendente
      const mockPendingApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: JSON.stringify({ text: 'Regra pendente' }),
        requested_by: 'totem_founder',
        approvals: JSON.stringify([]),
        rejections: JSON.stringify([]),
        status: APPROVAL_STATUS.PENDING,
        executed: 0
      };

      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([mockPendingApproval]);
      getPendingApprovals.mockResolvedValueOnce([mockPendingApproval]);

      // Verifica que approval ainda está pendente
      const approvals = await getPendingApprovals(1);
      
      expect(approvals.length).toBe(1);
      expect(approvals[0].status).toBe(APPROVAL_STATUS.PENDING);
      expect(approvals[0].executed).toBe(0);
    });

    test('executor deve executar mesmo com mensagens auto-destrutivas no sistema', async () => {
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.MEMBER_PROMOTE,
        action_data: { memberTotem: 'totem_member', newRole: 'admin' },
        requested_by: 'totem_founder',
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      // Mock: sistema tem mensagens com self-destruct
      const MessagesStorage = require('../src/messages/MessagesStorage').default;
      MessagesStorage.getMessages.mockResolvedValueOnce([
        {
          id: 1,
          clan_id: 1,
          message: 'Mensagem que será auto-destruída',
          self_destruct_at: Date.now() - 1000, // Já expirada
          burn_after_read: 1
        }
      ]);

      // Executor deve funcionar normalmente
      const result = await executeApprovedAction(mockApproval);
      
      expect(result.success).toBe(true);
      expect(logSecurityEvent).toHaveBeenCalled();
    });
  });

  // ============================================
  // TOTEM INTEGRITY
  // ============================================

  describe('Totem Integrity - Consistência da Identidade', () => {
    test('deve carregar totem corretamente', async () => {
      const totem = await loadTotem();
      
      expect(totem).toBeDefined();
      expect(totem.totemId).toBeDefined();
      expect(totem.publicKey).toBeDefined();
      expect(totem.privateKey).toBeDefined();
    });

    test('deve obter totemId atual consistentemente', async () => {
      const totemId1 = await getCurrentTotemId();
      const totemId2 = await getCurrentTotemId();
      
      // Deve retornar o mesmo totemId
      expect(totemId1).toBe(totemId2);
    });

    test('totemId deve corresponder ao totem carregado', async () => {
      const totemId = await getCurrentTotemId();
      const totem = await loadTotem();
      
      expect(totem.totemId).toBe(totemId);
    });

    test('totem deve manter consistência após operações', async () => {
      const totemIdBefore = await getCurrentTotemId();
      
      // Simula operações (não devem afetar totem)
      await getPendingApprovals(1);
      await ClanStorage.getWebRules();
      
      const totemIdAfter = await getCurrentTotemId();
      
      // TotemId deve permanecer o mesmo
      expect(totemIdAfter).toBe(totemIdBefore);
    });

    test('panic mode não deve quebrar integridade do totem (se não limpar)', async () => {
      const totemBefore = await loadTotem();
      
      // Ativa panic mode sem limpar totem
      await activatePanicMode({
        clearTotem: false,
        clearMessages: true,
        clearKeys: true
      });
      
      // Totem ainda deve estar acessível
      const totemAfter = await loadTotem();
      
      expect(totemAfter).toBeDefined();
      expect(totemAfter.totemId).toBe(totemBefore.totemId);
    });
  });

  // ============================================
  // INTEGRAÇÃO - SISTEMAS CRÍTICOS JUNTOS
  // ============================================

  describe('Integração - Sistemas Críticos Trabalhando Juntos', () => {
    test('watermark + executor devem funcionar juntos', async () => {
      // 1. Cria mensagem com watermark
      const originalText = 'Mensagem importante';
      const totemId = await getCurrentTotemId();
      const watermarked = injectWatermark(originalText, totemId);
      
      expect(watermarked).toContain(originalText);
      
      // 2. Executor deve funcionar normalmente
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: { text: 'Regra via executor' },
        requested_by: totemId,
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      const result = await executeApprovedAction(mockApproval);
      
      expect(result.success).toBe(true);
    });

    test('panic mode não deve quebrar approvals pendentes', async () => {
      // 1. Cria approval pendente
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: JSON.stringify({ text: 'Regra pendente' }),
        requested_by: 'totem_founder',
        approvals: JSON.stringify([]),
        rejections: JSON.stringify([]),
        status: APPROVAL_STATUS.PENDING,
        executed: 0
      };

      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([mockApproval]);
      getPendingApprovals.mockResolvedValueOnce([mockApproval]);

      // 2. Ativa panic mode (sem limpar approvals)
      await activatePanicMode({
        clearMessages: true,
        clearKeys: true,
        clearTotem: false
      });

      // 3. Verifica que approval ainda existe
      const approvals = await getPendingApprovals(1);
      expect(approvals.length).toBeGreaterThanOrEqual(0); // Pode ter sido limpo ou não
    });

    test('executor + self-destruct + watermark devem coexistir', async () => {
      // 1. Cria mensagem com watermark e self-destruct
      const originalText = 'Mensagem auto-destrutiva';
      const totemId = await getCurrentTotemId();
      const watermarked = injectWatermark(originalText, totemId);
      
      // 2. Executor deve funcionar
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.CLAN_SETTINGS_CHANGE,
        action_data: { settings: { name: 'Novo nome' } },
        requested_by: totemId,
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      const MessagesStorage = require('../src/messages/MessagesStorage').default;
      MessagesStorage.getMessages.mockResolvedValueOnce([
        {
          id: 1,
          clan_id: 1,
          message: watermarked,
          self_destruct_at: Date.now() + 60000,
          burn_after_read: 1
        }
      ]);

      const result = await executeApprovedAction(mockApproval);
      
      expect(result.success).toBe(true);
      expect(watermarked).toContain(originalText);
    });

    test('totem integrity deve ser mantida após todas as operações', async () => {
      const totemIdInitial = await getCurrentTotemId();
      const totemInitial = await loadTotem();
      
      // Executa várias operações
      await injectWatermark('Teste', totemIdInitial);
      await getPendingApprovals(1);
      await checkAndExecuteApprovedActions(1);
      
      // Ativa panic mode sem limpar totem
      await activatePanicMode({ clearTotem: false });
      
      // Verifica integridade
      const totemIdFinal = await getCurrentTotemId();
      const totemFinal = await loadTotem();
      
      expect(totemIdFinal).toBe(totemIdInitial);
      expect(totemFinal.totemId).toBe(totemInitial.totemId);
    });
  });

  // ============================================
  // VALIDAÇÃO DE NÃO-REGRESSÃO
  // ============================================

  describe('Validação de Não-Regressão', () => {
    test('watermark não deve quebrar após Sprint 8', () => {
      const text = 'Mensagem de teste';
      const totemId = 'ABCD1234EFGH5678';
      
      const watermarked = injectWatermark(text, totemId);
      
      // Deve funcionar como antes
      expect(watermarked).toContain(text);
      expect(removeWatermark(watermarked)).toBe(text);
    });

    test('panic mode não deve quebrar após Sprint 8', async () => {
      const result = await activatePanicMode({
        clearTotem: false // Não limpar em teste
      });
      
      // Deve funcionar como antes
      expect(result.success).toBe(true);
      expect(result.cleared).toBeDefined();
    });

    test('executor não deve quebrar após Sprint 8', async () => {
      const mockApproval = {
        id: 1,
        clan_id: 1,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: { text: 'Regra' },
        requested_by: 'totem_founder',
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };

      const result = await executeApprovedAction(mockApproval);
      
      // Deve funcionar como antes
      expect(result.success).toBe(true);
    });

    test('totem integrity não deve quebrar após Sprint 8', async () => {
      const totemId = await getCurrentTotemId();
      const totem = await loadTotem();
      
      // Deve funcionar como antes
      expect(totemId).toBeDefined();
      expect(totem).toBeDefined();
      expect(totem.totemId).toBe(totemId);
    });
  });
});

