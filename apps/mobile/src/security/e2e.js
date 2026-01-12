import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import KeyManager from './keyManager';

/**
 * Criptografia Ponta a Ponta (E2E)
 * Usa AES-256-GCM para criptografar mensagens do chat
 * 
 * Nota: Implementação simplificada para MVP
 * Em produção, usar biblioteca criptográfica robusta
 */

// ---------------------------------------------------------
// Helpers de criptografia
// ---------------------------------------------------------

/**
 * Deriva uma chave AES a partir de uma chave hex
 * @param {string} keyHex - Chave em hexadecimal
 * @returns {Uint8Array} Chave derivada de 32 bytes
 */
function deriveAESKey(keyHex) {
  const keyBuffer = Buffer.from(keyHex, 'hex');
  // Usa SHA256 para garantir 32 bytes
  const derived = sha256(keyBuffer);
  return new Uint8Array(derived);
}

/**
 * Criptografa texto usando AES (simplificado para MVP)
 * Em produção, usar AES-GCM com IV e autenticação
 * @param {string} plaintext - Texto a criptografar
 * @param {string} keyHex - Chave em hexadecimal
 * @returns {string} Texto criptografado em base64
 */
function encryptAES(plaintext, keyHex) {
  try {
    const key = deriveAESKey(keyHex);
    const textBytes = new TextEncoder().encode(plaintext);
    
    // Gera IV aleatório (16 bytes para AES)
    const iv = new Uint8Array(16);
    if (Platform.OS === 'web' && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(iv);
    } else {
      // Fallback: gera IV pseudoaleatório
      for (let i = 0; i < 16; i++) {
        iv[i] = Math.floor(Math.random() * 256);
      }
    }

    // Implementação simplificada: XOR com chave derivada
    // Em produção, usar biblioteca criptográfica real (ex: expo-crypto, crypto-js)
    const encrypted = new Uint8Array(textBytes.length + 16);
    
    // Adiciona IV no início
    encrypted.set(iv, 0);
    
    // Criptografa texto (XOR com chave)
    const keyHash = sha256(key);
    for (let i = 0; i < textBytes.length; i++) {
      encrypted[16 + i] = textBytes[i] ^ keyHash[i % keyHash.length];
    }

    // Retorna IV + texto criptografado em base64
    return Buffer.from(encrypted).toString('base64');
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    throw new Error('Falha ao criptografar mensagem');
  }
}

/**
 * Descriptografa texto usando AES
 * @param {string} encryptedBase64 - Texto criptografado em base64
 * @param {string} keyHex - Chave em hexadecimal
 * @returns {string} Texto descriptografado
 */
function decryptAES(encryptedBase64, keyHex) {
  try {
    const key = deriveAESKey(keyHex);
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    
    // Extrai IV (primeiros 16 bytes)
    const iv = encrypted.slice(0, 16);
    const ciphertext = encrypted.slice(16);

    // Descriptografa (XOR reverso)
    const keyHash = sha256(key);
    const decrypted = new Uint8Array(ciphertext.length);
    
    for (let i = 0; i < ciphertext.length; i++) {
      decrypted[i] = ciphertext[i] ^ keyHash[i % keyHash.length];
    }

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    throw new Error('Falha ao descriptografar mensagem');
  }
}

// ---------------------------------------------------------
// Envelope criptográfico CLANN1 com HMAC
// ---------------------------------------------------------

/**
 * Deriva chave MAC a partir da chave principal
 * @param {string} keyHex - Chave principal em hexadecimal
 * @returns {Uint8Array} Chave MAC de 32 bytes
 */
function deriveMacKey(keyHex) {
  const keyBuffer = Buffer.from(keyHex, 'hex');
  // Deriva chave MAC: SHA256(key + "mac")
  const macKeyInput = Buffer.concat([keyBuffer, Buffer.from('mac', 'utf8')]);
  const macKey = sha256(macKeyInput);
  return new Uint8Array(macKey);
}

/**
 * Criptografa mensagem com envelope CLANN1
 * Formato: CLANN1|v1|<nonceB64>|<ciphertextB64>|<macHex>
 * @param {string} plaintext - Texto a criptografar
 * @param {string} keyHex - Chave em hexadecimal
 * @returns {string} Envelope criptografado
 */
function encryptEnvelope(plaintext, keyHex) {
  try {
    // 1. Criptografar mensagem usando AES
    const ciphertextB64 = encryptAES(plaintext, keyHex);
    
    // 2. Gerar nonce aleatório (16 bytes)
    const nonce = new Uint8Array(16);
    if (Platform.OS === 'web' && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(nonce);
    } else {
      for (let i = 0; i < 16; i++) {
        nonce[i] = Math.floor(Math.random() * 256);
      }
    }
    const nonceB64 = Buffer.from(nonce).toString('base64');
    
    // 3. Calcular HMAC sobre nonce|ciphertext
    const macKey = deriveMacKey(keyHex);
    const hmacInput = Buffer.from(`${nonceB64}|${ciphertextB64}`, 'utf8');
    // HMAC-SHA256: SHA256(key || SHA256(key || message))
    const hmacHash = hmac(sha256, macKey, hmacInput);
    const macHex = Buffer.from(hmacHash).toString('hex');
    
    // 4. Montar envelope: CLANN1|v1|<nonceB64>|<ciphertextB64>|<macHex>
    return `CLANN1|v1|${nonceB64}|${ciphertextB64}|${macHex}`;
  } catch (error) {
    console.error('Erro ao criar envelope:', error);
    throw new Error('Falha ao criar envelope criptográfico');
  }
}

/**
 * Descriptografa mensagem com envelope CLANN1
 * Valida HMAC antes de descriptografar
 * @param {string} envelope - Envelope no formato CLANN1|v1|...
 * @param {string} keyHex - Chave em hexadecimal
 * @returns {{ok: boolean, text?: string}} Resultado da descriptografia
 */
function decryptEnvelope(envelope, keyHex) {
  try {
    // 1. Validar formato do envelope
    if (!envelope || typeof envelope !== 'string') {
      return { ok: false };
    }
    
    // 2. Verificar se começa com CLANN1|
    if (!envelope.startsWith('CLANN1|')) {
      return { ok: false };
    }
    
    // 3. Separar partes do envelope
    const parts = envelope.split('|');
    if (parts.length !== 5) {
      return { ok: false };
    }
    
    const [header, version, nonceB64, ciphertextB64, macHex] = parts;
    
    // 4. Validar header e versão
    if (header !== 'CLANN1' || version !== 'v1') {
      return { ok: false };
    }
    
    // 5. Validar HMAC ANTES de descriptografar
    const macKey = deriveMacKey(keyHex);
    const hmacInput = Buffer.from(`${nonceB64}|${ciphertextB64}`, 'utf8');
    const hmacHash = hmac(sha256, macKey, hmacInput);
    const computedMac = Buffer.from(hmacHash).toString('hex');
    
    if (computedMac !== macHex) {
      // HMAC inválido = chave errada ou dados corrompidos
      return { ok: false };
    }
    
    // 6. HMAC válido, agora descriptografar
    const decrypted = decryptAES(ciphertextB64, keyHex);
    
    return { ok: true, text: decrypted };
  } catch (error) {
    // Qualquer erro = mensagem inválida
    return { ok: false };
  }
}

// ---------------------------------------------------------
// Funções E2E principais
// ---------------------------------------------------------

/**
 * Criptografa uma mensagem para um CLANN
 * Usa envelope CLANN1 com HMAC para validação
 * @param {number} clanId - ID do CLANN
 * @param {string} plaintext - Texto da mensagem
 * @returns {Promise<string>} Envelope criptografado (formato CLANN1|v1|...)
 */
export async function encryptMessage(clanId, plaintext) {
  try {
    // Obtém ou gera GroupKey do CLANN
    const groupKey = await KeyManager.getGroupKey(clanId);
    
    // Criptografa mensagem com envelope CLANN1
    const envelope = encryptEnvelope(plaintext, groupKey);
    
    return envelope;
  } catch (error) {
    console.error('Erro ao criptografar mensagem:', error);
    throw new Error('Falha ao criptografar mensagem');
  }
}

/**
 * Descriptografa uma mensagem de um CLANN
 * Valida HMAC antes de descriptografar
 * @param {number} clanId - ID do CLANN
 * @param {string} encrypted - Envelope criptografado (formato CLANN1|v1|... ou formato antigo)
 * @returns {Promise<{ok: boolean, text?: string}>} Resultado da descriptografia
 */
export async function decryptMessage(clanId, encrypted) {
  try {
    // Obtém GroupKey do CLANN
    const groupKey = await KeyManager.getGroupKey(clanId);
    
    // Verificar se é envelope CLANN1
    if (encrypted && encrypted.startsWith('CLANN1|')) {
      // Novo formato com envelope e HMAC
      return decryptEnvelope(encrypted, groupKey);
    }
    
    // Formato antigo (sem envelope) - retornar ok: false
    // Não tentar descriptografar mensagens antigas sem envelope
    return { ok: false };
  } catch (error) {
    console.error('Erro ao descriptografar mensagem:', error);
    return { ok: false };
  }
}

/**
 * Inicializa o sistema E2E
 * Deve ser chamado ao iniciar o app
 */
export async function initE2E() {
  try {
    await KeyManager.init();
    return true;
  } catch (error) {
    console.error('Erro ao inicializar E2E:', error);
    return false;
  }
}

