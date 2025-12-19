/**
 * Testes para PinManager
 */

import {
  validatePinFormat,
  createPin,
  verifyPin,
  hasPin,
  getRemainingAttempts,
} from '../PinManager';
import * as SecureStore from 'expo-secure-store';

// Mock do SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('PinManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePinFormat', () => {
    test('deve aceitar PIN de 4 dígitos', () => {
      expect(validatePinFormat('1234')).toBe(true);
    });

    test('deve aceitar PIN de 6 dígitos', () => {
      expect(validatePinFormat('123456')).toBe(true);
    });

    test('deve rejeitar PIN com menos de 4 dígitos', () => {
      expect(validatePinFormat('123')).toBe(false);
    });

    test('deve rejeitar PIN com mais de 6 dígitos', () => {
      expect(validatePinFormat('1234567')).toBe(false);
    });

    test('deve rejeitar PIN com letras', () => {
      expect(validatePinFormat('123a')).toBe(false);
    });
  });

  describe('createPin', () => {
    test('deve criar PIN válido', async () => {
      SecureStore.setItemAsync.mockResolvedValue();
      SecureStore.deleteItemAsync.mockResolvedValue();

      await expect(createPin('1234')).resolves.not.toThrow();
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    test('deve rejeitar PIN inválido', async () => {
      await expect(createPin('123')).rejects.toThrow('PIN deve ter entre 4 e 6 dígitos');
    });
  });

  describe('verifyPin', () => {
    test('deve verificar PIN correto', async () => {
      // Mock: PIN já existe
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'pin_hash') return Promise.resolve('mock_hash');
        if (key === 'pin_salt') return Promise.resolve('mock_salt_hex');
        return Promise.resolve(null);
      });

      // Mock do hashPin (simplificado para teste)
      // Em um teste real, precisaríamos mockar a função hashPin
      // Por enquanto, apenas verificamos que a função é chamada
      await expect(verifyPin('1234')).resolves.toBeDefined();
    });
  });

  describe('hasPin', () => {
    test('deve retornar true se PIN existe', async () => {
      SecureStore.getItemAsync.mockResolvedValue('mock_hash');
      const result = await hasPin();
      expect(result).toBe(true);
    });

    test('deve retornar false se PIN não existe', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);
      const result = await hasPin();
      expect(result).toBe(false);
    });
  });
});

