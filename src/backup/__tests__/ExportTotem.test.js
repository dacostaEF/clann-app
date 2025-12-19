/**
 * Testes para ExportTotem
 */

import { exportTotem } from '../ExportTotem';
import { loadTotemSecure } from '../../storage/secureStore';
import { getAESKey } from '../../security/PinManager';
import { validateTotem } from '../../crypto/totem';
import * as FileSystem from 'expo-file-system';

// Mocks
jest.mock('../../storage/secureStore');
jest.mock('../../security/PinManager');
jest.mock('../../crypto/totem');
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/directory/',
  writeAsStringAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
  },
}));

describe('ExportTotem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve exportar Totem válido', async () => {
    const mockTotem = {
      privateKey: 'mock_private_key',
      publicKey: 'mock_public_key',
      totemId: 'mock_totem_id',
      symbolicName: 'Mock Totem',
      recoveryPhrase: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
    };

    loadTotemSecure.mockResolvedValue(mockTotem);
    validateTotem.mockReturnValue(true);
    getAESKey.mockResolvedValue('mock_aes_key_hex');
    FileSystem.writeAsStringAsync.mockResolvedValue();

    const fileUri = await exportTotem();

    expect(loadTotemSecure).toHaveBeenCalled();
    expect(validateTotem).toHaveBeenCalledWith(mockTotem);
    expect(getAESKey).toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(fileUri).toContain('clan-backup.cln');
  });

  test('deve rejeitar exportação se Totem não existe', async () => {
    loadTotemSecure.mockResolvedValue(null);

    await expect(exportTotem()).rejects.toThrow('Nenhum Totem encontrado');
  });

  test('deve rejeitar exportação se Totem é inválido', async () => {
    const mockTotem = {
      privateKey: 'mock_private_key',
      publicKey: 'mock_public_key',
      totemId: 'mock_totem_id',
      symbolicName: 'Mock Totem',
      recoveryPhrase: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
    };

    loadTotemSecure.mockResolvedValue(mockTotem);
    validateTotem.mockReturnValue(false);

    await expect(exportTotem()).rejects.toThrow('Totem inválido');
  });

  test('deve rejeitar exportação se chave AES não existe', async () => {
    const mockTotem = {
      privateKey: 'mock_private_key',
      publicKey: 'mock_public_key',
      totemId: 'mock_totem_id',
      symbolicName: 'Mock Totem',
      recoveryPhrase: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
    };

    loadTotemSecure.mockResolvedValue(mockTotem);
    validateTotem.mockReturnValue(true);
    getAESKey.mockResolvedValue(null);

    await expect(exportTotem()).rejects.toThrow('Chave AES não encontrada');
  });
});

