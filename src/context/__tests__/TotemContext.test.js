/**
 * Testes para TotemContext
 * Testes básicos de funcionalidade do Context
 */

import { loadTotemSecure } from '../../storage/secureStore';

// Mock do secureStore
jest.mock('../../storage/secureStore', () => ({
  loadTotemSecure: jest.fn(),
}));

describe('TotemContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve exportar TotemProvider e useTotem', () => {
    const TotemContext = require('../TotemContext');
    
    expect(TotemContext.TotemProvider).toBeDefined();
    expect(TotemContext.useTotem).toBeDefined();
  });

  test('loadTotemSecure deve ser chamado', async () => {
    const mockTotem = {
      totemId: 'test123',
      symbolicName: 'Test Totem',
    };

    loadTotemSecure.mockResolvedValue(mockTotem);

    const result = await loadTotemSecure();

    expect(loadTotemSecure).toHaveBeenCalled();
    expect(result).toEqual(mockTotem);
  });
});

