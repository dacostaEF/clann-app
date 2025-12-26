/**
 * Testes para validação criptográfica do Totem
 */

import { generateTotem, validateTotem, restoreTotem } from '../totem';

describe('validateTotem', () => {
  test('deve validar Totem gerado corretamente', () => {
    const totem = generateTotem();
    expect(validateTotem(totem)).toBe(true);
  });

  test('deve validar Totem restaurado corretamente', () => {
    const totem = generateTotem();
    const restored = restoreTotem(totem.recoveryPhrase);
    expect(validateTotem(restored)).toBe(true);
  });

  test('deve rejeitar Totem com chave pública incorreta', () => {
    const totem = generateTotem();
    const invalidTotem = {
      ...totem,
      publicKey: '000000000000000000000000000000000000000000000000000000000000000000',
    };
    expect(validateTotem(invalidTotem)).toBe(false);
  });

  test('deve rejeitar Totem sem chave privada', () => {
    const totem = generateTotem();
    const invalidTotem = {
      ...totem,
      privateKey: null,
    };
    expect(validateTotem(invalidTotem)).toBe(false);
  });

  test('deve rejeitar Totem sem chave pública', () => {
    const totem = generateTotem();
    const invalidTotem = {
      ...totem,
      publicKey: null,
    };
    expect(validateTotem(invalidTotem)).toBe(false);
  });
});

