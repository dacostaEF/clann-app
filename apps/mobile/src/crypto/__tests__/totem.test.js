/**
 * Testes unitários para o módulo TOTEM
 */

import {
  generateTotem,
  restoreTotem,
  signMessage,
  verifySignature,
} from '../totem';

describe('TOTEM', () => {
  describe('generateTotem', () => {
    it('deve gerar um Totem com todas as propriedades', () => {
      const totem = generateTotem();

      expect(totem).toHaveProperty('privateKey');
      expect(totem).toHaveProperty('publicKey');
      expect(totem).toHaveProperty('totemId');
      expect(totem).toHaveProperty('symbolicName');
      expect(totem).toHaveProperty('recoveryPhrase');

      // Verifica tipos
      expect(typeof totem.privateKey).toBe('string');
      expect(typeof totem.publicKey).toBe('string');
      expect(typeof totem.totemId).toBe('string');
      expect(typeof totem.symbolicName).toBe('string');
      expect(typeof totem.recoveryPhrase).toBe('string');

      // Verifica formatos
      expect(totem.privateKey.length).toBe(64); // 32 bytes em hex
      expect(totem.publicKey.length).toBe(66); // 33 bytes comprimida em hex
      expect(totem.totemId.length).toBe(16); // 16 caracteres hex
      expect(totem.recoveryPhrase.split(' ').length).toBe(12); // 12 palavras
    });

    it('deve gerar Totems diferentes a cada chamada', () => {
      const totem1 = generateTotem();
      const totem2 = generateTotem();

      expect(totem1.privateKey).not.toBe(totem2.privateKey);
      expect(totem1.totemId).not.toBe(totem2.totemId);
    });
  });

  describe('restoreTotem', () => {
    it('deve restaurar um Totem a partir de uma frase válida', () => {
      const originalTotem = generateTotem();
      const restoredTotem = restoreTotem(originalTotem.recoveryPhrase);

      // O Totem restaurado deve ter as mesmas propriedades
      expect(restoredTotem).toHaveProperty('privateKey');
      expect(restoredTotem).toHaveProperty('publicKey');
      expect(restoredTotem).toHaveProperty('totemId');
      expect(restoredTotem).toHaveProperty('symbolicName');
      expect(restoredTotem).toHaveProperty('recoveryPhrase');

      // A frase deve ser a mesma
      expect(restoredTotem.recoveryPhrase).toBe(originalTotem.recoveryPhrase);
    });

    it('deve restaurar o mesmo Totem gerado (chaves idênticas)', () => {
      const originalTotem = generateTotem();
      const restoredTotem = restoreTotem(originalTotem.recoveryPhrase);

      // As chaves devem ser idênticas
      expect(restoredTotem.privateKey).toBe(originalTotem.privateKey);
      expect(restoredTotem.publicKey).toBe(originalTotem.publicKey);
      expect(restoredTotem.totemId).toBe(originalTotem.totemId);
      expect(restoredTotem.symbolicName).toBe(originalTotem.symbolicName);
    });

    it('deve lançar erro para frase inválida', () => {
      expect(() => {
        restoreTotem('palavra inválida frase de teste');
      }).toThrow('Frase de recuperação inválida');
    });

    it('deve restaurar o mesmo Totem com a mesma frase', () => {
      const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const totem1 = restoreTotem(phrase);
      const totem2 = restoreTotem(phrase);

      // O Totem deve ser determinístico
      expect(totem1.totemId).toBe(totem2.totemId);
      expect(totem1.privateKey).toBe(totem2.privateKey);
      expect(totem1.publicKey).toBe(totem2.publicKey);
    });
  });

  describe('signMessage e verifySignature', () => {
    it('deve assinar e verificar uma mensagem corretamente', () => {
      const totem = generateTotem();
      const message = 'Mensagem de teste para assinatura';

      const signature = signMessage(message, totem.privateKey);
      const isValid = verifySignature(message, signature, totem.publicKey);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(isValid).toBe(true);
    });

    it('deve rejeitar assinatura com mensagem diferente', () => {
      const totem = generateTotem();
      const message = 'Mensagem original';
      const wrongMessage = 'Mensagem diferente';

      const signature = signMessage(message, totem.privateKey);
      const isValid = verifySignature(wrongMessage, signature, totem.publicKey);

      expect(isValid).toBe(false);
    });

    it('deve rejeitar assinatura com chave pública diferente', () => {
      const totem1 = generateTotem();
      const totem2 = generateTotem();
      const message = 'Mensagem de teste';

      const signature = signMessage(message, totem1.privateKey);
      const isValid = verifySignature(message, signature, totem2.publicKey);

      expect(isValid).toBe(false);
    });

    it('deve rejeitar assinatura inválida', () => {
      const totem = generateTotem();
      const message = 'Mensagem de teste';
      const invalidSignature = 'assinatura_invalida_hex';

      const isValid = verifySignature(message, invalidSignature, totem.publicKey);

      expect(isValid).toBe(false);
    });
  });
});

