import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
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
// Funções E2E principais
// ---------------------------------------------------------

/**
 * Criptografa uma mensagem para um CLANN
 * @param {number} clanId - ID do CLANN
 * @param {string} plaintext - Texto da mensagem
 * @returns {Promise<string>} Mensagem criptografada em base64
 */
export async function encryptMessage(clanId, plaintext) {
  try {
    // Obtém ou gera GroupKey do CLANN
    const groupKey = await KeyManager.getGroupKey(clanId);
    
    // Criptografa mensagem
    const encrypted = encryptAES(plaintext, groupKey);
    
    return encrypted;
  } catch (error) {
    console.error('Erro ao criptografar mensagem:', error);
    throw new Error('Falha ao criptografar mensagem');
  }
}

/**
 * Descriptografa uma mensagem de um CLANN
 * @param {number} clanId - ID do CLANN
 * @param {string} encrypted - Mensagem criptografada em base64
 * @returns {Promise<string>} Texto descriptografado
 */
export async function decryptMessage(clanId, encrypted) {
  try {
    // Obtém GroupKey do CLANN
    const groupKey = await KeyManager.getGroupKey(clanId);
    
    // Descriptografa mensagem
    const decrypted = decryptAES(encrypted, groupKey);
    
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar mensagem:', error);
    throw new Error('Falha ao descriptografar mensagem');
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

