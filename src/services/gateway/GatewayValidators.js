/**
 * GatewayValidators.js - VALIDAÇÕES CRÍTICAS
 * 
 * 🔒 VALIDAÇÕES DE SEGURANÇA DO GATEWAY CLANN
 * 
 * Estas validações garantem que os princípios de segurança
 * não sejam violados inadvertidamente.
 */

export class GatewayValidators {
  /**
   * Valida que uma chave de criptografia é LOCAL
   * ⚠️ CRÍTICO: Chaves NUNCA devem sair do dispositivo
   */
  static validateEncryptionKey(key, context = 'unknown') {
    if (!key) {
      throw new Error(`[SECURITY] Chave de criptografia vazia (${context})`);
    }

    if (typeof key !== 'string') {
      throw new Error(`[SECURITY] Chave de criptografia deve ser string (${context})`);
    }

    // Chaves locais são tipicamente longas
    if (key.length < 32) {
      console.warn(`[SECURITY] Chave de criptografia muito curta: ${key.length} chars (${context})`);
    }

    // Sinais de que a chave NÃO é local (indicativos apenas)
    const remoteKeyIndicators = [
      key.startsWith('http'),
      key.includes('api.'),
      key.includes('key='),
      key.includes('token='),
      key.length > 1000, // Chaves assimétricas são longas, simétricas não
    ];

    if (remoteKeyIndicators.some((indicator) => indicator)) {
      throw new Error(`[SECURITY] Chave de criptografia parece remota (${context})`);
    }

    return true;
  }

  /**
   * Valida payload antes de enviar ao Gateway
   * O Gateway deve receber apenas dados criptografados como opacos
   */
  static validateOutgoingPayload(payload) {
    const { clannId, recipientTotemId, encryptedPayload } = payload;

    if (!clannId || !recipientTotemId || !encryptedPayload) {
      throw new Error('[VALIDATION] Payload incompleto');
    }

    // encryptedPayload deve parecer criptografado (não texto plano)
    if (encryptedPayload.length < 16) {
      throw new Error('[VALIDATION] Payload muito curto para ser criptografado');
    }

    // Texto plano ASCII é suspeito
    const asciiRegex = /^[\x00-\x7F]*$/;
    if (asciiRegex.test(encryptedPayload) && encryptedPayload.includes(' ')) {
      console.warn('[SECURITY] Payload parece texto plano, não criptografado');
    }

    return true;
  }

  /**
   * Valida que o Gateway NÃO está recebendo chaves
   */
  static validateNoKeysInGatewayData(data) {
    const keyIndicators = [
      'privateKey',
      'encryptionKey',
      'secret',
      'password',
      'passphrase',
      'mnemonic',
      'seed',
    ];

    const jsonString = JSON.stringify(data).toLowerCase();

    for (const indicator of keyIndicators) {
      if (jsonString.includes(indicator.toLowerCase())) {
        throw new Error(`[SECURITY] Dado parece conter chave: ${indicator}`);
      }
    }

    return true;
  }

  /**
   * Valida formato do totemId
   */
  static validateTotemId(totemId) {
    if (!totemId) {
      throw new Error('[VALIDATION] totemId é obrigatório');
    }

    if (typeof totemId !== 'string') {
      throw new Error('[VALIDATION] totemId deve ser string');
    }

    if (totemId.length < 10) {
      throw new Error('[VALIDATION] totemId muito curto');
    }

    // totemId não deve parecer um número de telefone ou email
    const phoneRegex = /^[\d\+\(\)\s\-]+$/;
    const emailRegex = /@/;

    if (phoneRegex.test(totemId)) {
      console.warn('[SECURITY] totemId parece número de telefone');
    }

    if (emailRegex.test(totemId)) {
      console.warn('[SECURITY] totemId parece email');
    }

    return true;
  }
}

/**
 * 🔐 DECLARAÇÃO DE PRINCÍPIOS DE SEGURANÇA
 * 
 * Estas regras devem ser seguidas em TODO o código do CLANN
 */
export const SECURITY_PRINCIPLES = `
PRINCÍPIOS DE SEGURANÇA CLANN - FASE 2

1. 🔒 PRINCÍPIO DO GATEWAY CEGO
   - O Gateway NUNCA vê chaves de criptografia
   - O Gateway NUNCA vê conteúdo descriptografado
   - O Gateway apenas roteia payloads opacos

2. 🔑 PRINCÍPIO DA CHAVE LOCAL
   - Chaves de criptografia são geradas LOCALMENTE
   - Chaves NUNCA saem do dispositivo
   - Cada Clann tem sua própria chave simétrica

3. 🏭 PRINCÍPIO DA IDENTIDADE SOBERANA
   - Totem é a identidade raiz
   - Não depende de email/telefone/terceiros
   - Recuperação via frase mnemônica

4. ⚠️ LIMITAÇÕES CONSCIENTES
   - Autenticação por identificação apenas (Fase 2)
   - Comunicação 1:1 apenas (Fase 2)
   - Sem assinatura digital (Fase 3)

VIOLAÇÕES A ESTES PRINCÍPIOS SÃO BUGS CRÍTICOS DE SEGURANÇA.
`;

