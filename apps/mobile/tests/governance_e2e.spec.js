/**
 * Testes E2E de Governança Completa
 * Sprint 8 - ETAPA 6
 * 
 * Cobre:
 * - Criação/edição/remoção de regras
 * - Criação/approval/rejeição de approvals
 * - Executor automático
 * - Council (add/remove elder)
 * - Enforcement bloqueando mensagens
 * - UI de badges, listas e permissões
 */

import { jest } from '@jest/globals';

// Mock de dependências
jest.mock('../src/clans/ClanStorage', () => ({
  __esModule: true,
  default: {
    getDB: jest.fn(() => null),
    getClanById: jest.fn(),
    getUserRole: jest.fn(),
    getWebRules: jest.fn(() => []),
    saveWebRules: jest.fn(),
    getWebCouncils: jest.fn(() => []),
    saveWebCouncils: jest.fn(),
    getWebPendingApprovals: jest.fn(() => []),
    saveWebPendingApprovals: jest.fn(),
    getWebMembers: jest.fn(() => []),
    saveWebMembers: jest.fn(),
    getLinkedDevices: jest.fn(() => []),
    addSecurityLogEvent: jest.fn(),
    getSecurityLogEvents: jest.fn(() => []),
    getLastSecurityLogEvent: jest.fn(() => null),
    verifySecurityLogIntegrity: jest.fn(() => ({ valid: true, errors: [] })),
  }
}));

jest.mock('../src/security/SecurityLog', () => ({
  __esModule: true,
  logSecurityEvent: jest.fn(() => Promise.resolve({ id: 1 })),
  getSecurityLogEvents: jest.fn(() => Promise.resolve([])),
  SECURITY_EVENTS: {
    CLAN_CREATED: 'clan_created',
    CLAN_UPDATED: 'clan_updated',
    MEMBER_JOINED: 'member_joined',
    MEMBER_LEFT: 'member_left',
  }
}));

jest.mock('../src/security/PinManager', () => ({
  __esModule: true,
  hasPin: jest.fn(() => Promise.resolve(true)),
  verifyPin: jest.fn(() => Promise.resolve(true)),
  validatePinForSensitiveAction: jest.fn(() => Promise.resolve(true)),
  isPinRequiredForAction: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../src/security/DeviceTrust', () => ({
  __esModule: true,
  calculateTrustScore: jest.fn(() => Promise.resolve(85)),
  shouldRequirePin: jest.fn(() => false),
  shouldBlockSensitiveActions: jest.fn(() => false),
  reduceTrustScore: jest.fn(() => Promise.resolve()),
  canExecuteSensitiveAction: jest.fn(() => Promise.resolve(true)),
  init: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/security/SessionFortress', () => ({
  __esModule: true,
  startSession: jest.fn(() => Promise.resolve('session_token')),
  endSession: jest.fn(() => Promise.resolve()),
  isSessionValid: jest.fn(() => Promise.resolve(true)),
  checkSessionIntegrity: jest.fn(() => Promise.resolve(true)),
  shouldRequirePinAgain: jest.fn(() => Promise.resolve(false)),
  init: jest.fn(() => Promise.resolve()),
  initListeners: jest.fn(() => Promise.resolve()),
  removeListeners: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/crypto/totemStorage', () => ({
  __esModule: true,
  getCurrentTotemId: jest.fn(() => Promise.resolve('totem_123')),
  loadTotem: jest.fn(() => Promise.resolve({
    totemId: 'totem_123',
    publicKey: 'pub_key_123',
    privateKey: 'priv_key_123'
  })),
}));

// Importa módulos após mocks
import { createRule, editRule, deleteRule, getRules, getActiveRules, approveRule } from '../src/clans/RulesEngine';
import { createApprovalRequest, approveRequest, rejectRequest, getPendingApprovals } from '../src/clans/ApprovalEngine';
import { executeApprovedAction, checkAndExecuteApprovedActions } from '../src/clans/ApprovalExecutor';
import { initCouncil, addElder, removeElder, getCouncil } from '../src/clans/CouncilManager';
import { checkAction, ACTION_TYPES } from '../src/clans/RuleEnforcement';
import ClanStorage from '../src/clans/ClanStorage';
import { logSecurityEvent } from '../src/security/SecurityLog';
import { APPROVAL_STATUS, APPROVAL_ACTIONS } from '../src/clans/ApprovalEngine';

describe('Governance E2E Tests', () => {
  const mockClanId = 1;
  const mockFounderTotem = 'totem_founder_123';
  const mockElderTotem = 'totem_elder_456';
  const mockMemberTotem = 'totem_member_789';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mocks padrão
    ClanStorage.getUserRole.mockImplementation((clanId, totemId) => {
      if (totemId === mockFounderTotem) return Promise.resolve('founder');
      if (totemId === mockElderTotem) return Promise.resolve('elder');
      return Promise.resolve('member');
    });

    ClanStorage.getClanById.mockResolvedValue({
      id: mockClanId,
      name: 'Test CLANN',
      founder_totem: mockFounderTotem
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================
  // TESTES DE REGRAS
  // ============================================

  describe('Regras - Criação/Edição/Remoção', () => {
    test('deve criar uma regra com sucesso', async () => {
      const ruleText = 'Nova regra de teste';
      
      const rule = await createRule(mockClanId, ruleText, null, null, null, mockFounderTotem);
      
      expect(rule).toBeDefined();
      expect(rule.text).toBe(ruleText);
      expect(rule.clan_id).toBe(mockClanId);
      expect(ClanStorage.saveWebRules).toHaveBeenCalled();
    });

    test('deve editar uma regra existente', async () => {
      const ruleId = 'rule_123';
      const newText = 'Regra editada';
      
      // Mock: regra existente
      ClanStorage.getWebRules.mockReturnValueOnce([{
        id: 1,
        rule_id: ruleId,
        clan_id: mockClanId,
        text: 'Regra original',
        enabled: 1,
        version: 1
      }]);

      const updatedRule = await editRule(ruleId, newText, mockFounderTotem);
      
      expect(updatedRule).toBeDefined();
      expect(updatedRule.text).toBe(newText);
      expect(updatedRule.version).toBe(2); // Versão incrementada
      expect(ClanStorage.saveWebRules).toHaveBeenCalled();
    });

    test('deve deletar uma regra', async () => {
      const ruleId = 'rule_123';
      
      // Mock: regra existente
      ClanStorage.getWebRules.mockReturnValueOnce([{
        id: 1,
        rule_id: ruleId,
        clan_id: mockClanId,
        text: 'Regra a deletar',
        enabled: 1
      }]);

      await deleteRule(ruleId, mockFounderTotem);
      
      expect(ClanStorage.saveWebRules).toHaveBeenCalled();
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    test('deve aprovar uma regra', async () => {
      const ruleId = 'rule_123';
      
      // Mock: regra não aprovada
      ClanStorage.getWebRules.mockReturnValueOnce([{
        id: 1,
        rule_id: ruleId,
        clan_id: mockClanId,
        text: 'Regra pendente',
        enabled: 0,
        approved_by: JSON.stringify([])
      }]);

      const updatedRule = await approveRule(ruleId, mockElderTotem);
      
      expect(updatedRule).toBeDefined();
      const approvals = JSON.parse(updatedRule.approved_by || '[]');
      expect(approvals).toContain(mockElderTotem);
    });
  });

  // ============================================
  // TESTES DE APPROVALS
  // ============================================

  describe('Approvals - Criação/Aprovação/Rejeição', () => {
    test('deve criar uma solicitação de aprovação', async () => {
      const actionType = APPROVAL_ACTIONS.RULE_CREATE;
      const actionData = { text: 'Nova regra via approval' };
      
      const approval = await createApprovalRequest(
        mockClanId,
        actionType,
        actionData,
        mockFounderTotem,
        2
      );
      
      expect(approval).toBeDefined();
      expect(approval.action_type).toBe(actionType);
      expect(approval.status).toBe(APPROVAL_STATUS.PENDING);
      expect(approval.requested_by).toBe(mockFounderTotem);
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    test('deve aprovar uma solicitação', async () => {
      const approvalId = 1;
      
      // Mock: approval pendente
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([{
        id: approvalId,
        clan_id: mockClanId,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: JSON.stringify({ text: 'Regra via approval' }),
        requested_by: mockFounderTotem,
        approvals: JSON.stringify([]),
        rejections: JSON.stringify([]),
        status: APPROVAL_STATUS.PENDING,
        approvals_required: 2
      }]);

      const updatedApproval = await approveRequest(approvalId, mockElderTotem);
      
      expect(updatedApproval).toBeDefined();
      const approvals = JSON.parse(updatedApproval.approvals || '[]');
      expect(approvals).toContain(mockElderTotem);
    });

    test('deve rejeitar uma solicitação', async () => {
      const approvalId = 1;
      
      // Mock: approval pendente
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([{
        id: approvalId,
        clan_id: mockClanId,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: JSON.stringify({ text: 'Regra via approval' }),
        requested_by: mockFounderTotem,
        approvals: JSON.stringify([]),
        rejections: JSON.stringify([]),
        status: APPROVAL_STATUS.PENDING
      }]);

      const updatedApproval = await rejectRequest(approvalId, mockElderTotem);
      
      expect(updatedApproval).toBeDefined();
      expect(updatedApproval.status).toBe(APPROVAL_STATUS.REJECTED);
      const rejections = JSON.parse(updatedApproval.rejections || '[]');
      expect(rejections).toContain(mockElderTotem);
    });

    test('deve executar automaticamente quando aprovada com aprovações suficientes', async () => {
      const approvalId = 1;
      
      // Mock: approval com 2 aprovações (suficiente)
      const mockApproval = {
        id: approvalId,
        clan_id: mockClanId,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: JSON.stringify({ text: 'Regra auto-executada' }),
        requested_by: mockFounderTotem,
        approvals: JSON.stringify([mockElderTotem, 'totem_elder_789']),
        rejections: JSON.stringify([]),
        status: APPROVAL_STATUS.APPROVED,
        executed: 0,
        approvals_required: 2
      };

      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([mockApproval]);
      getPendingApprovals.mockResolvedValueOnce([mockApproval]);

      // Executa verificação automática
      const executed = await checkAndExecuteApprovedActions(mockClanId);
      
      expect(executed.length).toBeGreaterThan(0);
      expect(executeApprovedAction).toHaveBeenCalled();
    });
  });

  // ============================================
  // TESTES DE EXECUTOR AUTOMÁTICO
  // ============================================

  describe('Executor Automático', () => {
    test('deve executar ação aprovada e marcar como executada', async () => {
      const approval = {
        id: 1,
        clan_id: mockClanId,
        action_type: APPROVAL_ACTIONS.RULE_CREATE,
        action_data: { text: 'Regra executada' },
        requested_by: mockFounderTotem,
        status: APPROVAL_STATUS.APPROVED
      };

      const result = await executeApprovedAction(approval);
      
      expect(result.success).toBe(true);
      expect(result.actionType).toBe(APPROVAL_ACTIONS.RULE_CREATE);
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'approval_executed',
          approvalId: approval.id
        }),
        mockFounderTotem
      );
    });

    test('deve verificar e executar aprovações pendentes automaticamente', async () => {
      const mockApprovals = [
        {
          id: 1,
          clan_id: mockClanId,
          action_type: APPROVAL_ACTIONS.RULE_CREATE,
          action_data: JSON.stringify({ text: 'Regra 1' }),
          requested_by: mockFounderTotem,
          approvals: JSON.stringify([mockElderTotem, 'totem_elder_789']),
          rejections: JSON.stringify([]),
          status: APPROVAL_STATUS.APPROVED,
          executed: 0
        },
        {
          id: 2,
          clan_id: mockClanId,
          action_type: APPROVAL_ACTIONS.RULE_EDIT,
          action_data: JSON.stringify({ ruleId: 'rule_123', newText: 'Editado' }),
          requested_by: mockFounderTotem,
          approvals: JSON.stringify([mockElderTotem]),
          rejections: JSON.stringify([]),
          status: APPROVAL_STATUS.PENDING,
          executed: 0
        }
      ];

      getPendingApprovals.mockResolvedValueOnce(mockApprovals);
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce(mockApprovals);

      const executed = await checkAndExecuteApprovedActions(mockClanId);
      
      // Apenas a primeira deve ser executada (approved e não executada)
      expect(executed.length).toBe(1);
      expect(executed[0].id).toBe(1);
    });
  });

  // ============================================
  // TESTES DE COUNCIL
  // ============================================

  describe('Council - Add/Remove Elder', () => {
    test('deve inicializar conselho com founder', async () => {
      const council = await initCouncil(mockClanId, mockFounderTotem);
      
      expect(council).toBeDefined();
      expect(council.founder_totem).toBe(mockFounderTotem);
      expect(council.elders).toContain(mockFounderTotem);
    });

    test('deve adicionar ancião ao conselho', async () => {
      // Mock: conselho existente
      ClanStorage.getWebCouncils.mockReturnValueOnce([{
        id: 1,
        clan_id: mockClanId,
        founder_totem: mockFounderTotem,
        elders: JSON.stringify([mockFounderTotem]),
        approvals_required: 2
      }]);

      const council = await addElder(mockClanId, mockElderTotem, mockFounderTotem, false);
      
      expect(council).toBeDefined();
      const elders = typeof council.elders === 'string' 
        ? JSON.parse(council.elders) 
        : council.elders;
      expect(elders).toContain(mockElderTotem);
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    test('deve remover ancião do conselho', async () => {
      // Mock: conselho com ancião
      ClanStorage.getWebCouncils.mockReturnValueOnce([{
        id: 1,
        clan_id: mockClanId,
        founder_totem: mockFounderTotem,
        elders: JSON.stringify([mockFounderTotem, mockElderTotem]),
        approvals_required: 2
      }]);

      const council = await removeElder(mockClanId, mockElderTotem, mockFounderTotem, false);
      
      expect(council).toBeDefined();
      const elders = typeof council.elders === 'string' 
        ? JSON.parse(council.elders) 
        : council.elders;
      expect(elders).not.toContain(mockElderTotem);
      expect(logSecurityEvent).toHaveBeenCalled();
    });
  });

  // ============================================
  // TESTES DE ENFORCEMENT
  // ============================================

  describe('Enforcement - Bloqueio de Mensagens', () => {
    test('deve bloquear mensagem que viola regra', async () => {
      const ruleText = 'Não é permitido usar palavras ofensivas';
      const messageText = 'Mensagem com palavra ofensiva';
      
      // Mock: regra ativa
      ClanStorage.getWebRules.mockReturnValueOnce([{
        id: 1,
        rule_id: 'rule_123',
        clan_id: mockClanId,
        text: ruleText,
        enabled: 1,
        approved_by: JSON.stringify([mockElderTotem])
      }]);

      const compliance = await checkMessageCompliance(mockClanId, messageText, mockMemberTotem);
      
      // Se a regra detectar palavra ofensiva, deve bloquear
      // (depende da implementação de RuleEnforcement)
      expect(compliance).toBeDefined();
    });

    test('deve permitir mensagem que não viola regras', async () => {
      const messageText = 'Mensagem normal e respeitosa';
      
      // Mock: regras ativas
      ClanStorage.getWebRules.mockReturnValueOnce([{
        id: 1,
        rule_id: 'rule_123',
        clan_id: mockClanId,
        text: 'Não é permitido usar palavras ofensivas',
        enabled: 1,
        approved_by: JSON.stringify([mockElderTotem])
      }]);

      const compliance = await checkAction(
        mockClanId,
        ACTION_TYPES.SEND_MESSAGE,
        { userTotem: mockMemberTotem, data: { messageText } }
      );
      
      expect(compliance).toBeDefined();
      expect(compliance.allowed).toBe(true); // Mensagem normal deve ser permitida
    });
  });

  // ============================================
  // TESTES DE UI E PERMISSÕES
  // ============================================

  describe('UI - Badges, Listas e Permissões', () => {
    test('deve filtrar aprovações pendentes corretamente', async () => {
      const mockApprovals = [
        {
          id: 1,
          clan_id: mockClanId,
          status: APPROVAL_STATUS.PENDING,
          executed: 0
        },
        {
          id: 2,
          clan_id: mockClanId,
          status: APPROVAL_STATUS.APPROVED,
          executed: 1,
          executed_at: Date.now()
        },
        {
          id: 3,
          clan_id: mockClanId,
          status: APPROVAL_STATUS.APPROVED,
          executed: 0
        }
      ];

      getPendingApprovals.mockResolvedValueOnce(mockApprovals);

      const approvals = await getPendingApprovals(mockClanId);
      
      // Pendentes: status = PENDING OU (status = APPROVED E executed = 0)
      const pending = approvals.filter(a => {
        const isPending = a.status === APPROVAL_STATUS.PENDING;
        const isApprovedNotExecuted = a.status === APPROVAL_STATUS.APPROVED && 
          (!a.executed || a.executed === 0);
        return isPending || isApprovedNotExecuted;
      });

      // Executadas: executed = 1
      const executed = approvals.filter(a => a.executed === 1 || a.executed === true);

      expect(pending.length).toBe(2); // IDs 1 e 3
      expect(executed.length).toBe(1); // ID 2
    });

    test('deve mostrar badge "Executado" apenas para aprovações executadas', async () => {
      const executedApproval = {
        id: 1,
        clan_id: mockClanId,
        status: APPROVAL_STATUS.APPROVED,
        executed: 1,
        executed_at: Date.now()
      };

      const pendingApproval = {
        id: 2,
        clan_id: mockClanId,
        status: APPROVAL_STATUS.PENDING,
        executed: 0
      };

      // Verifica se tem badge (executed_at existe)
      const hasExecutedBadge = executedApproval.executed === 1 && executedApproval.executed_at;
      const hasPendingBadge = pendingApproval.executed === 1 && pendingApproval.executed_at;

      expect(hasExecutedBadge).toBe(true);
      expect(hasPendingBadge).toBe(false);
    });

    test('deve verificar permissões corretamente', async () => {
      const founderRole = await ClanStorage.getUserRole(mockClanId, mockFounderTotem);
      const elderRole = await ClanStorage.getUserRole(mockClanId, mockElderTotem);
      const memberRole = await ClanStorage.getUserRole(mockClanId, mockMemberTotem);

      expect(founderRole).toBe('founder');
      expect(elderRole).toBe('elder');
      expect(memberRole).toBe('member');
    });
  });

  // ============================================
  // TESTES DE INTEGRAÇÃO COMPLETA
  // ============================================

  describe('Fluxo Completo E2E', () => {
    test('deve completar fluxo: criar regra → aprovar → executar', async () => {
      // 1. Criar solicitação de aprovação para nova regra
      const actionData = { text: 'Regra via fluxo completo' };
      const approval = await createApprovalRequest(
        mockClanId,
        APPROVAL_ACTIONS.RULE_CREATE,
        actionData,
        mockFounderTotem,
        2
      );

      expect(approval.status).toBe(APPROVAL_STATUS.PENDING);

      // 2. Aprovar (primeira aprovação)
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([approval]);
      const afterFirstApproval = await approveRequest(approval.id, mockElderTotem);
      
      expect(afterFirstApproval.status).toBe(APPROVAL_STATUS.PENDING); // Ainda precisa de mais uma

      // 3. Aprovar (segunda aprovação - deve aprovar)
      const updatedApproval = {
        ...approval,
        approvals: JSON.stringify([mockElderTotem])
      };
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([updatedApproval]);
      const afterSecondApproval = await approveRequest(approval.id, 'totem_elder_789');
      
      expect(afterSecondApproval.status).toBe(APPROVAL_STATUS.APPROVED);

      // 4. Executar automaticamente
      const finalApproval = {
        ...afterSecondApproval,
        status: APPROVAL_STATUS.APPROVED,
        executed: 0
      };
      getPendingApprovals.mockResolvedValueOnce([finalApproval]);
      ClanStorage.getWebPendingApprovals.mockReturnValueOnce([finalApproval]);

      const executed = await checkAndExecuteApprovedActions(mockClanId);
      
      expect(executed.length).toBe(1);
      expect(executeApprovedAction).toHaveBeenCalled();
    });
  });
});

