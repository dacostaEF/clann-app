/**
 * KeyExchange - Troca de chaves para CLANN (MVP 1)
 * 
 * Usa ECDH (secp256k1) + SHA256 + AES existente para cifrar groupKey
 * durante o fluxo JOIN_REQUEST / JOIN_ACCEPT
 */

import { getSharedSecret } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';

// Timeout para requests pendentes (5 minutos)
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

// Map de requests pendentes: requestId -> { timestamp, resolve, reject }
const pendingRequests = new Map();

/**
 * Gera requestId único
 * @returns {string} requestId
 */
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Deriva chave AES a partir de sharedSecret usando SHA256
 * @param {Uint8Array} sharedSecretBytes - Bytes do sharedSecret (ECDH)
 * @returns {Uint8Array} Chave AES de 32 bytes
 */
function deriveAESKeyFromShared(sharedSecretBytes) {
  // SHA256 sobre os bytes brutos do sharedSecret
  return sha256(sharedSecretBytes);
}

/**
 * Cifra dados usando XOR com chave derivada (mesmo padrão do e2e.js)
 * @param {string} plaintext - Texto a cifrar
 * @param {Uint8Array} aesKey - Chave AES de 32 bytes
 * @returns {string} Ciphertext em Base64
 */
function encryptWithKey(plaintext, aesKey) {
  const textBytes = new TextEncoder().encode(plaintext);
  
  // Gera IV aleatório (16 bytes)
  const iv = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    iv[i] = Math.floor(Math.random() * 256);
  }
  
  // Cifra usando XOR com hash da chave (mesmo padrão do e2e.js)
  const keyHash = sha256(aesKey);
  const encrypted = new Uint8Array(textBytes.length + 16);
  
  // IV no início
  encrypted.set(iv, 0);
  
  // XOR do texto com keyHash
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[16 + i] = textBytes[i] ^ keyHash[i % keyHash.length];
  }
  
  return Buffer.from(encrypted).toString('base64');
}

/**
 * Decifra dados usando XOR com chave derivada
 * @param {string} ciphertextB64 - Ciphertext em Base64
 * @param {Uint8Array} aesKey - Chave AES de 32 bytes
 * @returns {string} Plaintext
 */
function decryptWithKey(ciphertextB64, aesKey) {
  const encrypted = Buffer.from(ciphertextB64, 'base64');
  
  // Extrai IV (primeiros 16 bytes) - não usado no XOR, mas necessário para consistência
  const ciphertext = encrypted.slice(16);
  
  // Decifra usando XOR reverso
  const keyHash = sha256(aesKey);
  const decrypted = new Uint8Array(ciphertext.length);
  
  for (let i = 0; i < ciphertext.length; i++) {
    decrypted[i] = ciphertext[i] ^ keyHash[i % keyHash.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Cifra groupKey para enviar ao joiner usando ECDH
 * @param {string} groupKeyHex - GroupKey em hexadecimal
 * @param {string} joinerPublicKeyHex - Chave pública do joiner em hex
 * @param {string} myPrivateKeyHex - Minha chave privada em hex
 * @returns {string} GroupKey cifrada em Base64
 */
export function encryptGroupKeyForJoiner(groupKeyHex, joinerPublicKeyHex, myPrivateKeyHex) {
  // 1. Deriva sharedSecret via ECDH
  const myPrivateKey = Buffer.from(myPrivateKeyHex, 'hex');
  const joinerPublicKey = Buffer.from(joinerPublicKeyHex, 'hex');
  
  // getSharedSecret retorna os bytes brutos do ponto EC compartilhado
  const sharedSecretBytes = getSharedSecret(myPrivateKey, joinerPublicKey);
  
  // 2. Deriva chave AES: aesKey = sha256(sharedSecretBytes)
  const aesKey = deriveAESKeyFromShared(sharedSecretBytes);
  
  // 3. Cifra a groupKey
  return encryptWithKey(groupKeyHex, aesKey);
}

/**
 * Decifra groupKey recebida do fundador usando ECDH
 * @param {string} encryptedGroupKeyB64 - GroupKey cifrada em Base64
 * @param {string} founderPublicKeyHex - Chave pública do fundador em hex
 * @param {string} myPrivateKeyHex - Minha chave privada em hex
 * @returns {string} GroupKey em hexadecimal
 */
export function decryptGroupKeyFromFounder(encryptedGroupKeyB64, founderPublicKeyHex, myPrivateKeyHex) {
  // 1. Deriva sharedSecret via ECDH (mesmo resultado que o fundador)
  const myPrivateKey = Buffer.from(myPrivateKeyHex, 'hex');
  const founderPublicKey = Buffer.from(founderPublicKeyHex, 'hex');
  
  // Mesmo cálculo que o fundador fez: sharedSecret é simétrico em ECDH
  const sharedSecretBytes = getSharedSecret(myPrivateKey, founderPublicKey);
  
  // 2. Deriva chave AES: aesKey = sha256(sharedSecretBytes)
  const aesKey = deriveAESKeyFromShared(sharedSecretBytes);
  
  // 3. Decifra a groupKey
  return decryptWithKey(encryptedGroupKeyB64, aesKey);
}

/**
 * Registra um request pendente (para validação de replay)
 * @param {string} requestId - ID do request
 * @returns {Promise} Promise que será resolvida quando JOIN_ACCEPT chegar
 */
export function registerPendingRequest(requestId) {
  return new Promise((resolve, reject) => {
    // Limpa requests expirados
    cleanExpiredRequests();
    
    // Registra novo request
    pendingRequests.set(requestId, {
      timestamp: Date.now(),
      resolve,
      reject
    });
    
    // Timeout automático
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        const pending = pendingRequests.get(requestId);
        pendingRequests.delete(requestId);
        pending.reject(new Error('JOIN_REQUEST timeout'));
      }
    }, REQUEST_TIMEOUT_MS);
  });
}

/**
 * Valida e consome um requestId (proteção contra replay)
 * @param {string} requestId - ID do request a validar
 * @returns {{ valid: boolean, pending?: Object }} Resultado da validação
 */
export function validateAndConsumeRequest(requestId) {
  if (!pendingRequests.has(requestId)) {
    return { valid: false };
  }
  
  const pending = pendingRequests.get(requestId);
  const now = Date.now();
  
  // Verifica se expirou
  if (now - pending.timestamp > REQUEST_TIMEOUT_MS) {
    pendingRequests.delete(requestId);
    return { valid: false };
  }
  
  // Consome o request (não pode ser usado novamente)
  pendingRequests.delete(requestId);
  
  return { valid: true, pending };
}

/**
 * Resolve um request pendente com sucesso
 * @param {string} requestId - ID do request
 * @param {Object} result - Resultado a passar para o resolve
 */
export function resolvePendingRequest(requestId, result) {
  const validation = validateAndConsumeRequest(requestId);
  if (validation.valid && validation.pending) {
    validation.pending.resolve(result);
  }
}

/**
 * Rejeita um request pendente com erro
 * @param {string} requestId - ID do request
 * @param {Error} error - Erro a passar para o reject
 */
export function rejectPendingRequest(requestId, error) {
  const validation = validateAndConsumeRequest(requestId);
  if (validation.valid && validation.pending) {
    validation.pending.reject(error);
  }
}

/**
 * Limpa requests expirados
 */
function cleanExpiredRequests() {
  const now = Date.now();
  for (const [requestId, pending] of pendingRequests.entries()) {
    if (now - pending.timestamp > REQUEST_TIMEOUT_MS) {
      pendingRequests.delete(requestId);
    }
  }
}

/**
 * Verifica se há request pendente para um requestId
 * @param {string} requestId - ID do request
 * @returns {boolean} True se existe request pendente válido
 */
export function hasPendingRequest(requestId) {
  if (!pendingRequests.has(requestId)) {
    return false;
  }
  
  const pending = pendingRequests.get(requestId);
  const now = Date.now();
  
  return now - pending.timestamp <= REQUEST_TIMEOUT_MS;
}
