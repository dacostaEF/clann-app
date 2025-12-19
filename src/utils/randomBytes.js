/**
 * Utilitário para gerar bytes aleatórios
 * Funciona tanto no web quanto no React Native
 */

import { Platform } from 'react-native';

/**
 * Gera bytes aleatórios
 * @param {number} length - Número de bytes a gerar
 * @returns {Uint8Array} Array de bytes aleatórios
 */
export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  
  if (Platform.OS === 'web') {
    // Web: usa crypto.getRandomValues (nativo do navegador)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      // Fallback para Math.random (menos seguro, mas funciona)
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  } else {
    // React Native: tenta usar @noble/secp256k1
    try {
      const { utils } = require('@noble/secp256k1');
      if (utils && typeof utils.randomBytes === 'function') {
        const random = utils.randomBytes(length);
        bytes.set(random);
      } else {
        // Fallback: usa crypto do Node.js se disponível
        const crypto = require('crypto');
        const random = crypto.randomBytes(length);
        bytes.set(random);
      }
    } catch (error) {
      // Último fallback: Math.random
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  }
  
  return bytes;
}

