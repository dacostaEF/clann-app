/**
 * Testes para clanService
 */

import {
  validateClan,
  createClan,
  validateInviteCode,
  joinClan,
} from '../clanService';
import { getClanByInviteCode } from '../clanStorage';

// Mock do clanStorage
jest.mock('../clanStorage', () => ({
  getClanByInviteCode: jest.fn(),
}));

describe('clanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateClan', () => {
    test('deve validar CLANN válido', () => {
      const data = {
        name: 'Meu CLANN',
        maxMembers: 10,
        isPrivate: false,
      };

      const result = validateClan(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('deve rejeitar nome vazio', () => {
      const data = {
        name: '   ',
        maxMembers: 10,
      };

      const result = validateClan(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nome do CLANN não pode estar vazio');
    });

    test('deve rejeitar maxMembers menor que 2', () => {
      const data = {
        name: 'Meu CLANN',
        maxMembers: 1,
      };

      const result = validateClan(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Máximo de membros deve ser pelo menos 2');
    });

    test('deve rejeitar maxMembers maior que 100', () => {
      const data = {
        name: 'Meu CLANN',
        maxMembers: 101,
      };

      const result = validateClan(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Máximo de membros não pode ser maior que 100');
    });
  });

  describe('createClan', () => {
    test('deve criar CLANN com ID e inviteCode', () => {
      const data = {
        name: 'Meu CLANN',
        maxMembers: 10,
        isPrivate: false,
      };

      const creatorTotemId = 'creator123';

      const clan = createClan(data, creatorTotemId);

      expect(clan).toHaveProperty('clanId');
      expect(clan.clanId).toHaveLength(16);
      expect(clan).toHaveProperty('inviteCode');
      expect(clan.inviteCode).toHaveLength(6);
      expect(clan.name).toBe('Meu CLANN');
      expect(clan.creatorTotemId).toBe(creatorTotemId);
      expect(clan.members).toHaveLength(1);
      expect(clan.members[0].totemId).toBe(creatorTotemId);
      expect(clan.members[0].role).toBe('founder');
    });

    test('deve lançar erro para dados inválidos', () => {
      const data = {
        name: '',
        maxMembers: 1,
      };

      expect(() => createClan(data, 'creator123')).toThrow();
    });
  });

  describe('validateInviteCode', () => {
    test('deve validar código correto', () => {
      expect(validateInviteCode('ABC123')).toBe(true);
      expect(validateInviteCode('XYZ789')).toBe(true);
    });

    test('deve rejeitar código com menos de 6 caracteres', () => {
      expect(validateInviteCode('ABC12')).toBe(false);
    });

    test('deve rejeitar código com mais de 6 caracteres', () => {
      expect(validateInviteCode('ABC1234')).toBe(false);
    });

    test('deve rejeitar código com caracteres inválidos', () => {
      expect(validateInviteCode('ABC-12')).toBe(false);
      expect(validateInviteCode('abc123')).toBe(false);
    });
  });

  describe('joinClan', () => {
    test('deve juntar-se a CLANN existente', async () => {
      const mockClan = {
        clanId: 'clan123',
        name: 'Test CLANN',
        inviteCode: 'ABC123',
        memberCount: 5,
        maxMembers: 10,
        members: [
          { totemId: 'other123', role: 'member' },
        ],
      };

      getClanByInviteCode.mockResolvedValue(mockClan);

      const result = await joinClan('ABC123', 'newuser123');

      expect(result).toEqual(mockClan);
      expect(getClanByInviteCode).toHaveBeenCalledWith('ABC123');
    });

    test('deve lançar erro para código inválido', async () => {
      await expect(joinClan('INVALID', 'user123')).rejects.toThrow('Código de convite inválido');
    });

    test('deve lançar erro para CLANN não encontrado', async () => {
      getClanByInviteCode.mockResolvedValue(null);

      await expect(joinClan('ABC123', 'user123')).rejects.toThrow('CLANN não encontrado');
    });

    test('deve lançar erro se já é membro', async () => {
      const mockClan = {
        clanId: 'clan123',
        name: 'Test CLANN',
        inviteCode: 'ABC123',
        memberCount: 5,
        maxMembers: 10,
        members: [
          { totemId: 'user123', role: 'member' },
        ],
      };

      getClanByInviteCode.mockResolvedValue(mockClan);

      await expect(joinClan('ABC123', 'user123')).rejects.toThrow('já é membro');
    });

    test('deve lançar erro se CLANN está cheio', async () => {
      const mockClan = {
        clanId: 'clan123',
        name: 'Test CLANN',
        inviteCode: 'ABC123',
        memberCount: 10,
        maxMembers: 10,
        members: Array(10).fill({ totemId: 'member', role: 'member' }),
      };

      getClanByInviteCode.mockResolvedValue(mockClan);

      await expect(joinClan('ABC123', 'newuser123')).rejects.toThrow('CLANN está cheio');
    });
  });
});

