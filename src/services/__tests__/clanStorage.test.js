/**
 * Testes para clanStorage
 */

import {
  init,
  saveClan,
  getMyClans,
  getClanByInviteCode,
  addMember,
  removeMember,
} from '../clanStorage';
import * as SQLite from 'expo-sqlite';

// Mock do SQLite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('clanStorage', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    };

    SQLite.openDatabaseAsync.mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    test('deve inicializar banco de dados', async () => {
      await init();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('clann.db');
      expect(mockDb.execAsync).toHaveBeenCalled();
    });

    test('não deve inicializar duas vezes', async () => {
      await init();
      await init();

      // Deve chamar openDatabaseAsync apenas uma vez
      expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveClan', () => {
    test('deve salvar CLANN', async () => {
      await init();

      const clan = {
        clanId: 'clan123',
        name: 'Test CLANN',
        description: 'Test description',
        inviteCode: 'ABC123',
        creatorTotemId: 'creator123',
        maxMembers: 10,
        isPrivate: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        members: [
          {
            totemId: 'creator123',
            role: 'founder',
            joinedAt: Date.now(),
          },
        ],
      };

      await saveClan(clan);

      expect(mockDb.runAsync).toHaveBeenCalled();
    });
  });

  describe('getMyClans', () => {
    test('deve retornar lista vazia se totemId não fornecido', async () => {
      await init();

      const result = await getMyClans(null);

      expect(result).toEqual([]);
    });

    test('deve buscar CLANNs do usuário', async () => {
      await init();

      const mockClans = [
        {
          clanId: 'clan123',
          name: 'Test CLANN',
          inviteCode: 'ABC123',
          creatorTotemId: 'creator123',
          maxMembers: 10,
          isPrivate: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          memberCount: 1,
        },
      ];

      mockDb.getAllAsync.mockResolvedValueOnce(mockClans);
      mockDb.getAllAsync.mockResolvedValueOnce([
        { totemId: 'user123', role: 'member', joinedAt: Date.now() },
      ]);

      const result = await getMyClans('user123');

      expect(result).toHaveLength(1);
      expect(result[0].clanId).toBe('clan123');
    });
  });

  describe('getClanByInviteCode', () => {
    test('deve retornar null se código não fornecido', async () => {
      await init();

      const result = await getClanByInviteCode(null);

      expect(result).toBeNull();
    });

    test('deve buscar CLANN por código', async () => {
      await init();

      const mockClan = {
        clanId: 'clan123',
        name: 'Test CLANN',
        inviteCode: 'ABC123',
        creatorTotemId: 'creator123',
        maxMembers: 10,
        isPrivate: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(mockClan);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getClanByInviteCode('ABC123');

      expect(result).not.toBeNull();
      expect(result.clanId).toBe('clan123');
    });

    test('deve retornar null se CLANN não encontrado', async () => {
      await init();

      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getClanByInviteCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('addMember', () => {
    test('deve adicionar membro', async () => {
      await init();

      mockDb.getFirstAsync.mockResolvedValueOnce(null); // Não é membro ainda

      await addMember('clan123', 'user123', 'member');

      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    test('deve lançar erro se já é membro', async () => {
      await init();

      mockDb.getFirstAsync.mockResolvedValueOnce({
        clanId: 'clan123',
        totemId: 'user123',
      });

      await expect(addMember('clan123', 'user123', 'member')).rejects.toThrow('já é membro');
    });
  });

  describe('removeMember', () => {
    test('deve remover membro', async () => {
      await init();

      await removeMember('clan123', 'user123');

      expect(mockDb.runAsync).toHaveBeenCalled();
    });
  });
});

