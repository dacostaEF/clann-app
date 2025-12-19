/**
 * Módulo TOTEM - Identidade Criptográfica
 * Sistema de identidade local baseado em chaves secp256k1
 */

import { getPublicKey, sign, verify } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { generateSeed, seedToMnemonic, mnemonicToSeed, validateMnemonic } from './seed.js';

// Lista de nomes simbólicos para o Totem
const SYMBOLIC_NAMES = [
  'Corvo de Ferro', 'Lobo Prateado', 'Águia Dourada', 'Serpente Verde',
  'Leão de Bronze', 'Falcão Negro', 'Urso Branco', 'Tigre Vermelho',
  'Dragão Azul', 'Fênix Dourada', 'Cervo Prateado', 'Pantera Negra',
  'Grifo de Aço', 'Unicórnio Branco', 'Basilisco Verde', 'Quimera Flamejante'
];

/**
 * Gera um nome simbólico aleatório para o Totem
 * @param {string} totemId - ID do Totem (16 caracteres)
 * @returns {string} Nome simbólico (ex: "Corvo de Ferro #7F3A")
 */
function generateSymbolicName(totemId) {
  const nameIndex = parseInt(totemId.substring(0, 2), 16) % SYMBOLIC_NAMES.length;
  const name = SYMBOLIC_NAMES[nameIndex];
  const shortId = totemId.substring(0, 4).toUpperCase();
  return `${name} #${shortId}`;
}

/**
 * Gera o ID do Totem a partir da chave pública
 * @param {Uint8Array} publicKey - Chave pública (33 bytes comprimida)
 * @returns {string} ID do Totem (16 caracteres hex)
 */
function generateTotemId(publicKey) {
  const hash = sha256(publicKey);
  return Buffer.from(hash).toString('hex').substring(0, 16);
}

/**
 * Gera um novo Totem
 * @returns {Object} Objeto Totem com todas as propriedades
 */
export function generateTotem() {
  // Gera seed aleatória
  const seed = generateSeed();
  
  // Gera chave privada determinística a partir da seed (32 bytes)
  // Usa hash SHA256 da seed para gerar 32 bytes
  const hash = sha256(seed);
  const privateKey = new Uint8Array(hash);
  
  // Deriva chave pública (33 bytes comprimida)
  const publicKey = getPublicKey(privateKey, true);
  
  // Gera ID do Totem (hash SHA256 da chave pública → 16 caracteres)
  const totemId = generateTotemId(publicKey);
  
  // Gera nome simbólico
  const symbolicName = generateSymbolicName(totemId);
  
  // Gera frase de recuperação (12 palavras BIP39)
  const recoveryPhrase = seedToMnemonic(seed);
  
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    totemId,
    symbolicName,
    recoveryPhrase
  };
}

/**
 * Restaura um Totem a partir de uma frase de recuperação
 * @param {string} phrase - Frase mnemônica de 12 palavras
 * @returns {Object} Objeto Totem restaurado
 */
export function restoreTotem(phrase) {
  // Valida a frase
  if (!validateMnemonic(phrase)) {
    throw new Error('Frase de recuperação inválida');
  }
  
  // Converte frase para seed
  const seed = mnemonicToSeed(phrase);
  
  // Gera chave privada determinística a partir da seed
  // Usa hash SHA256 da seed para gerar 32 bytes
  const hash = sha256(seed);
  const privateKey = new Uint8Array(hash);
  
  // Deriva chave pública
  const publicKey = getPublicKey(privateKey, true);
  
  // Gera ID do Totem
  const totemId = generateTotemId(publicKey);
  
  // Gera nome simbólico
  const symbolicName = generateSymbolicName(totemId);
  
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    totemId,
    symbolicName,
    recoveryPhrase: phrase
  };
}

/**
 * Assina uma mensagem com a chave privada do Totem
 * @param {string} message - Mensagem a ser assinada
 * @param {string} privateKeyHex - Chave privada em hex
 * @returns {string} Assinatura em hex
 */
export function signMessage(message, privateKeyHex) {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const messageHash = sha256(new TextEncoder().encode(message));
  const signature = sign(messageHash, privateKey);
  return Buffer.from(signature.toCompactRawBytes()).toString('hex');
}

/**
 * Verifica uma assinatura
 * @param {string} message - Mensagem original
 * @param {string} signatureHex - Assinatura em hex
 * @param {string} publicKeyHex - Chave pública em hex
 * @returns {boolean} True se a assinatura é válida
 */
export function verifySignature(message, signatureHex, publicKeyHex) {
  try {
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');
    const messageHash = sha256(new TextEncoder().encode(message));
    
    return verify(signature, messageHash, publicKey);
  } catch (error) {
    return false;
  }
}

/**
 * Valida a integridade criptográfica de um Totem
 * Verifica se a chave pública deriva corretamente da chave privada
 * @param {Object} totem - Objeto Totem a validar
 * @returns {boolean} True se o Totem é válido
 */
export function validateTotem(totem) {
  try {
    const { privateKey, publicKey } = totem;
    
    if (!privateKey || !publicKey) {
      return false;
    }
    
    // Deriva a chave pública a partir da chave privada
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    const derivedPublicKey = getPublicKey(privateKeyBuffer, true);
    const derivedPublicKeyHex = Buffer.from(derivedPublicKey).toString('hex');
    
    // Compara com a chave pública armazenada
    return derivedPublicKeyHex === publicKey;
  } catch (error) {
    return false;
  }
}

