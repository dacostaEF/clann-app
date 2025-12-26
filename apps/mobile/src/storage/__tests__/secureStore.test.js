/**
 * Testes unitários para o módulo de armazenamento seguro
 */

import {
  saveTotemSecure,
  loadTotemSecure,
  deleteTotemSecure,
  hasTotemSecure,
} from '../secureStore';

// Mock do expo-secure-store
jest.mock('expo-secure-store', () => {
  let store = {};
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    getItemAsync: jest.fn(async (key) => {
      return store[key] || null;
    }),
    deleteItemAsync: jest.fn(async (key) => {
      delete store[key];
    }),
  };
});

describe('SecureStore', () => {
  beforeEach(() => {
    // Limpa o store antes de cada teste
    jest.clearAllMocks();
  });

  describe('saveTotemSecure', () => {
    it('deve salvar dados do Totem', async () => {
      const totemData = {
        privateKey: 'test_private_key',
        publicKey: 'test_public_key',
        totemId: 'test_id',
        symbolicName: 'Test Totem',
        recoveryPhrase: 'test phrase',
      };

      await expect(saveTotemSecure(totemData)).resolves.not.toThrow();
    });
  });

  describe('loadTotemSecure', () => {
    it('deve carregar dados do Totem salvos', async () => {
      const totemData = {
        privateKey: 'test_private_key',
        publicKey: 'test_public_key',
        totemId: 'test_id',
        symbolicName: 'Test Totem',
        recoveryPhrase: 'test phrase',
      };

      await saveTotemSecure(totemData);
      const loaded = await loadTotemSecure();

      expect(loaded).toEqual(totemData);
    });

    it('deve retornar null se não houver Totem salvo', async () => {
      const loaded = await loadTotemSecure();
      expect(loaded).toBeNull();
    });
  });

  describe('deleteTotemSecure', () => {
    it('deve deletar dados do Totem', async () => {
      const totemData = {
        privateKey: 'test_private_key',
        publicKey: 'test_public_key',
        totemId: 'test_id',
        symbolicName: 'Test Totem',
        recoveryPhrase: 'test phrase',
      };

      await saveTotemSecure(totemData);
      await deleteTotemSecure();
      const loaded = await loadTotemSecure();

      expect(loaded).toBeNull();
    });
  });

  describe('hasTotemSecure', () => {
    it('deve retornar true se existe Totem salvo', async () => {
      const totemData = {
        privateKey: 'test_private_key',
        publicKey: 'test_public_key',
        totemId: 'test_id',
        symbolicName: 'Test Totem',
        recoveryPhrase: 'test phrase',
      };

      await saveTotemSecure(totemData);
      const hasTotem = await hasTotemSecure();

      expect(hasTotem).toBe(true);
    });

    it('deve retornar false se não existe Totem salvo', async () => {
      const hasTotem = await hasTotemSecure();
      expect(hasTotem).toBe(false);
    });
  });
});





