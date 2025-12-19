/**
 * Módulo de geração e gerenciamento de seed para o TOTEM
 * Utiliza BIP39 para geração de frase mnemônica de 12 palavras
 */

import * as bip39 from 'bip39';
import { randomBytes } from '../utils/randomBytes';

/**
 * Gera uma seed aleatória de 128 bits (16 bytes)
 * @returns {Uint8Array} Seed de 16 bytes
 */
export function generateSeed() {
  return randomBytes(16);
}

/**
 * Gera uma frase mnemônica de 12 palavras a partir de uma seed
 * @param {Uint8Array} seed - Seed de 16 bytes
 * @returns {string} Frase mnemônica de 12 palavras
 */
export function seedToMnemonic(seed) {
  return bip39.entropyToMnemonic(Buffer.from(seed).toString('hex'));
}

/**
 * Converte uma frase mnemônica de volta para seed
 * @param {string} mnemonic - Frase mnemônica de 12 palavras
 * @returns {Uint8Array} Seed de 16 bytes
 */
export function mnemonicToSeed(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Frase mnemônica inválida');
  }
  const entropy = bip39.mnemonicToEntropy(mnemonic);
  return new Uint8Array(Buffer.from(entropy, 'hex'));
}

/**
 * Valida uma frase mnemônica
 * @param {string} mnemonic - Frase mnemônica a validar
 * @returns {boolean} True se válida
 */
export function validateMnemonic(mnemonic) {
  return bip39.validateMnemonic(mnemonic);
}





