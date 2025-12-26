/**
 * Testes unitários para ClanManager
 * Dose 3 - Sprint 3
 */

import ClanManager from '../ClanManager';
import ClanStorage from '../ClanStorage';
import { validateClanName, validateClanDescription } from '../../config/ClanTypes';

// Mock do ClanStorage
jest.mock('../ClanStorage', () => ({
  __esModule: true,
  default: {
    createClan: jest.fn(),
    joinClan: jest.fn(),
    getUserClans: jest.fn(),
    getClanById: jest.fn(),
  },
}));

// Mock do ClanTypes
jest.mock('../../config/ClanTypes', () => ({
  validateClanName: jest.fn(),
  validateClanDescription: jest.fn(),
}));

describe('ClanManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClan', () => {
    test('deve criar CLANN com dados válidos', async () => {
      const clanData = {
        name: 'Meu CLANN',
        description: 'Descrição do CLANN',
        icon: '🛡️',
        privacy: 'private',
        maxMembers: 50,
      };

      const creatorTotemId = 'creator123';
      const mockClan = {
        id: 'clan123',
        name: 'Meu CLANN',
        members: 1,
      };

      validateClanName.mockReturnValue(null);
      validateClanDescription.mockReturnValue(null);
      ClanStorage.createClan.mockResolvedValue(mockClan);

      const result = await ClanManager.createClan(clanData, creatorTotemId);

      expect(validateClanName).toHaveBeenCalledWith(clanData.name);
      expect(validateClanDescription).toHaveBeenCalledWith(clanData.description);
      expect(ClanStorage.createClan).toHaveBeenCalledWith(clanData, creatorTotemId);
      expect(result).toEqual(mockClan);
    });

    test('deve lançar erro se nome inválido', async () => {
      const clanData = {
        name: 'AB', // Muito curto
        description: 'Descrição',
      };

      validateClanName.mockReturnValue('Nome muito curto (mínimo 3 caracteres)');
      validateClanDescription.mockReturnValue(null);

      await expect(ClanManager.createClan(clanData, 'creator123')).rejects.toThrow(
        'Nome muito curto (mínimo 3 caracteres)'
      );

      expect(ClanStorage.createClan).not.toHaveBeenCalled();
    });

    test('deve lançar erro se descrição inválida', async () => {
      const clanData = {
        name: 'Meu CLANN',
        description: 'A'.repeat(201), // Muito longa
      };

      validateClanName.mockReturnValue(null);
      validateClanDescription.mockReturnValue('Descrição muito longa (máximo 200 caracteres)');

      await expect(ClanManager.createClan(clanData, 'creator123')).rejects.toThrow(
        'Descrição muito longa (máximo 200 caracteres)'
      );

      expect(ClanStorage.createClan).not.toHaveBeenCalled();
    });
  });

  describe('joinClan', () => {
    test('deve entrar em CLANN com código válido', async () => {
      const inviteCode = 'ABC123';
      const totemId = 'user123';
      const mockClan = {
        id: 'clan123',
        name: 'Test CLANN',
        members: 5,
      };

      ClanStorage.joinClan.mockResolvedValue(mockClan);

      const result = await ClanManager.joinClan(inviteCode, totemId);

      expect(ClanStorage.joinClan).toHaveBeenCalledWith('ABC123', totemId);
      expect(result).toEqual(mockClan);
    });

    test('deve normalizar código (maiúsculas, sem espaços)', async () => {
      const inviteCode = 'abc 123';
      const totemId = 'user123';
      const mockClan = { id: 'clan123' };

      ClanStorage.joinClan.mockResolvedValue(mockClan);

      await ClanManager.joinClan(inviteCode, totemId);

      expect(ClanStorage.joinClan).toHaveBeenCalledWith('ABC123', totemId);
    });

    test('deve lançar erro para código inválido', async () => {
      const invalidCodes = ['ABC', 'ABC1234', 'ABC-12', 'abc@123'];

      for (const code of invalidCodes) {
        await expect(ClanManager.joinClan(code, 'user123')).rejects.toThrow(
          'Código inválido. Use 6 letras/números.'
        );
        expect(ClanStorage.joinClan).not.toHaveBeenCalled();
      }
    });

    test('deve propagar erro do ClanStorage', async () => {
      ClanStorage.joinClan.mockRejectedValue(new Error('CLANN não encontrado'));

      await expect(ClanManager.joinClan('ABC123', 'user123')).rejects.toThrow(
        'CLANN não encontrado'
      );
    });
  });

  describe('findClanByCode', () => {
    test('deve retornar null (placeholder)', async () => {
      const result = await ClanManager.findClanByCode('ABC123');
      expect(result).toBeNull();
    });
  });

  describe('canCreateClan', () => {
    test('deve permitir criar se tiver menos de 5 CLANNs', async () => {
      const totemId = 'user123';
      const mockClans = [
        { id: 'clan1' },
        { id: 'clan2' },
        { id: 'clan3' },
      ];

      ClanStorage.getUserClans.mockResolvedValue(mockClans);

      const result = await ClanManager.canCreateClan(totemId);

      expect(ClanStorage.getUserClans).toHaveBeenCalledWith(totemId);
      expect(result).toEqual({ canCreate: true });
    });

    test('deve bloquear criação se tiver 5 ou mais CLANNs', async () => {
      const totemId = 'user123';
      const mockClans = Array(5).fill(null).map((_, i) => ({ id: `clan${i + 1}` }));

      ClanStorage.getUserClans.mockResolvedValue(mockClans);

      const result = await ClanManager.canCreateClan(totemId);

      expect(result).toEqual({
        canCreate: false,
        reason: 'Limite de CLANNs atingido (máximo 5)',
      });
    });

    test('deve permitir criar se não tiver CLANNs', async () => {
      const totemId = 'user123';
      ClanStorage.getUserClans.mockResolvedValue([]);

      const result = await ClanManager.canCreateClan(totemId);

      expect(result).toEqual({ canCreate: true });
    });
  });

  describe('updateClan', () => {
    test('deve atualizar CLANN se for fundador', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'founder123';
      const updates = {
        name: 'Novo Nome',
        description: 'Nova descrição',
      };

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'founder',
      };

      validateClanName.mockReturnValue(null);
      validateClanDescription.mockReturnValue(null);
      ClanStorage.getClanById.mockResolvedValue(mockClan);

      const result = await ClanManager.updateClan(clanId, updates, requesterTotemId);

      expect(ClanStorage.getClanById).toHaveBeenCalledWith(clanId, requesterTotemId);
      expect(validateClanName).toHaveBeenCalledWith(updates.name);
      expect(validateClanDescription).toHaveBeenCalledWith(updates.description);
      expect(result).toEqual({ success: true, clanId });
    });

    test('deve atualizar CLANN se for admin', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'admin123';
      const updates = { name: 'Novo Nome' };

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'admin',
      };

      validateClanName.mockReturnValue(null);
      ClanStorage.getClanById.mockResolvedValue(mockClan);

      const result = await ClanManager.updateClan(clanId, updates, requesterTotemId);

      expect(result).toEqual({ success: true, clanId });
    });

    test('deve lançar erro se não for membro', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'user123';
      const updates = { name: 'Novo Nome' };

      const mockClan = {
        id: clanId,
        isMember: false,
        userRole: null,
      };

      ClanStorage.getClanById.mockResolvedValue(mockClan);

      await expect(ClanManager.updateClan(clanId, updates, requesterTotemId)).rejects.toThrow(
        'Você não é membro deste CLANN'
      );
    });

    test('deve lançar erro se for apenas membro', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'member123';
      const updates = { name: 'Novo Nome' };

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'member',
      };

      ClanStorage.getClanById.mockResolvedValue(mockClan);

      await expect(ClanManager.updateClan(clanId, updates, requesterTotemId)).rejects.toThrow(
        'Apenas fundadores e admins podem editar o CLANN'
      );
    });

    test('deve validar nome se fornecido', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'founder123';
      const updates = { name: 'AB' }; // Inválido

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'founder',
      };

      validateClanName.mockReturnValue('Nome muito curto (mínimo 3 caracteres)');
      ClanStorage.getClanById.mockResolvedValue(mockClan);

      await expect(ClanManager.updateClan(clanId, updates, requesterTotemId)).rejects.toThrow(
        'Nome muito curto (mínimo 3 caracteres)'
      );
    });

    test('deve validar descrição se fornecida', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'founder123';
      const updates = { description: 'A'.repeat(201) }; // Inválido

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'founder',
      };

      validateClanDescription.mockReturnValue('Descrição muito longa (máximo 200 caracteres)');
      ClanStorage.getClanById.mockResolvedValue(mockClan);

      await expect(ClanManager.updateClan(clanId, updates, requesterTotemId)).rejects.toThrow(
        'Descrição muito longa (máximo 200 caracteres)'
      );
    });

    test('deve funcionar sem validações se updates vazios', async () => {
      const clanId = 'clan123';
      const requesterTotemId = 'founder123';
      const updates = {};

      const mockClan = {
        id: clanId,
        isMember: true,
        userRole: 'founder',
      };

      ClanStorage.getClanById.mockResolvedValue(mockClan);

      const result = await ClanManager.updateClan(clanId, updates, requesterTotemId);

      expect(validateClanName).not.toHaveBeenCalled();
      expect(validateClanDescription).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, clanId });
    });
  });
});

